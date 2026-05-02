"""Knowledge graph API: CRUD + AI-powered diagnose / recommend / mastery check.

Endpoints:
    GET    /api/v1/knowledge-graph                       → full graph (public)
    PUT    /api/v1/knowledge-graph                       → replace graph (admin)
    GET    /api/v1/knowledge-graph/progress              → my progress (member)
    POST   /api/v1/knowledge-graph/progress              → upsert one node's status
    DELETE /api/v1/knowledge-graph/progress              → reset all (or single via body)
    POST   /api/v1/knowledge-graph/recommend-next        → next nodes (pure graph algo)
    POST   /api/v1/knowledge-graph/diagnose              → LLM-driven mastery diagnosis
    POST   /api/v1/knowledge-graph/check-mastery         → LLM judge a transcript on a node
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deeptutor.api.routers.auth import (
    UserInfo,
    get_current_user,
    get_optional_user,
    require_admin,
)
from deeptutor.services.auth import get_member_store
from deeptutor.services.llm import complete as llm_complete
from deeptutor.services.settings.antitao_knowledge_graph import (
    get_node_by_id,
    load_antitao_knowledge_graph,
    recommend_next_nodes,
    save_antitao_knowledge_graph,
)

router = APIRouter()


# ─── Models ──────────────────────────────────────────────────────────────


class GraphPayload(BaseModel):
    graph: dict[str, Any]


class ProgressUpsertPayload(BaseModel):
    node_id: str
    status: Literal["in_progress", "mastered", "skipped"]
    notes: str = ""


class ResetPayload(BaseModel):
    node_id: str | None = None


class RecommendPayload(BaseModel):
    track_id: str | None = None
    limit: int = 5


class DiagnoseMessage(BaseModel):
    role: Literal["assistant", "user"]
    content: str


class DiagnosePayload(BaseModel):
    track_id: str | None = None
    messages: list[DiagnoseMessage] = []


class ResourceViewMeta(BaseModel):
    url: str
    title: str
    viewedAt: int = 0


class MasteryCheckPayload(BaseModel):
    node_id: str
    transcript: list[DiagnoseMessage]
    viewed_resources: list[ResourceViewMeta] = []


class TutorPayload(BaseModel):
    node_id: str
    messages: list[DiagnoseMessage] = []
    viewed_resources: list[ResourceViewMeta] = []


class AskPayload(BaseModel):
    """Free-form Q&A about reverse cross-border (NOT tied to a specific node)."""
    messages: list[DiagnoseMessage] = []


class AdoptResourcePayload(BaseModel):
    node_id: str
    url: str
    title: dict[str, str]  # {"zh": "...", "en": "..."}
    type: str = "feishu_doc"  # doc, video, link, feishu_doc, etc.
    section: str = ""
    page_title: str = ""


class BatchAdoptPayload(BaseModel):
    adoptions: list[AdoptResourcePayload]


class EvaluateTaskPayload(BaseModel):
    node_id: str
    task_answer: str


# ─── CRUD ────────────────────────────────────────────────────────────────


@router.get("")
async def get_graph() -> dict[str, Any]:
    return {"graph": load_antitao_knowledge_graph()}


@router.put("")
async def update_graph(
    payload: GraphPayload,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    try:
        graph = save_antitao_knowledge_graph(payload.graph)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"graph": graph}


# ─── Resource Adoption ──────────────────────────────────────────────────


@router.post("/adopt-resource")
async def adopt_resource(
    payload: AdoptResourcePayload,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    graph = load_antitao_knowledge_graph()
    node = get_node_by_id(graph, payload.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="node_not_found")

    resource = {
        "type": payload.type,
        "title": payload.title,
        "url": payload.url,
        "summary": {
            "zh": f"飞书文档：{payload.section}/{payload.page_title}" if payload.section else payload.url,
            "en": f"Feishu doc: {payload.section}/{payload.page_title}" if payload.section else payload.url,
        },
    }
    node.setdefault("resources", []).append(resource)
    try:
        save_antitao_knowledge_graph(graph)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"node_id": payload.node_id, "resource": resource, "total_resources": len(node["resources"])}


@router.post("/adopt-resources-batch")
async def adopt_resources_batch(
    payload: BatchAdoptPayload,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    graph = load_antitao_knowledge_graph()
    adopted: list[dict[str, Any]] = []
    for item in payload.adoptions:
        node = get_node_by_id(graph, item.node_id)
        if not node:
            continue
        resource = {
            "type": item.type,
            "title": item.title,
            "url": item.url,
            "summary": {
                "zh": f"飞书文档：{item.section}/{item.page_title}" if item.section else item.url,
                "en": f"Feishu doc: {item.section}/{item.page_title}" if item.section else item.url,
            },
        }
        node.setdefault("resources", []).append(resource)
        adopted.append({"node_id": item.node_id, "resource": resource})
    try:
        save_antitao_knowledge_graph(graph)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"adopted_count": len(adopted), "adopted": adopted}


# ─── Progress (per logged-in member) ─────────────────────────────────────


@router.get("/progress")
async def get_my_progress(user: UserInfo = Depends(get_current_user)) -> dict[str, Any]:
    store = get_member_store()
    rows = store.get_user_progress(user.email)
    mastered = [r["node_id"] for r in rows if r["status"] == "mastered"]
    return {"progress": rows, "mastered_node_ids": mastered}


@router.get("/progress/{email}")
async def get_user_progress_as_admin(
    email: str,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    """Admin-only: fetch any user's progress for preview purposes."""
    store = get_member_store()
    rows = store.get_user_progress(email)
    mastered = [r["node_id"] for r in rows if r["status"] == "mastered"]
    return {"progress": rows, "mastered_node_ids": mastered, "email": email}


@router.post("/progress")
async def upsert_progress(
    payload: ProgressUpsertPayload,
    user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    graph = load_antitao_knowledge_graph()
    if not get_node_by_id(graph, payload.node_id):
        raise HTTPException(status_code=404, detail="node_not_found")
    store = get_member_store()
    row = store.upsert_node_progress(
        user.email, payload.node_id, payload.status, payload.notes
    )
    store.log_activity(
        user.email,
        f"node_{payload.status}",
        json.dumps({"node_id": payload.node_id}),
    )
    return {"progress": row}


@router.delete("/progress")
async def reset_progress(
    payload: ResetPayload,
    user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    store = get_member_store()
    deleted = store.reset_node_progress(user.email, payload.node_id)
    return {"deleted": deleted}


# ─── Recommendation (pure graph algorithm — fast, no LLM) ────────────────


@router.post("/recommend-next")
async def recommend_next(
    payload: RecommendPayload,
    user: UserInfo | None = Depends(get_optional_user),
) -> dict[str, Any]:
    graph = load_antitao_knowledge_graph()
    mastered: list[str] = []
    if user:
        mastered = get_member_store().get_mastered_node_ids(user.email)
    candidates = recommend_next_nodes(
        graph,
        mastered,
        track_id=payload.track_id,
        limit=payload.limit,
    )
    return {
        "mastered_node_ids": mastered,
        "candidates": candidates,
    }


# ─── AI: Diagnose user's current mastery from a short conversation ───────


_DIAGNOSE_SYSTEM = """你是反淘知识图谱的「诊断师」。
你的任务：根据用户在对话里说出的内容，判断他/她已经掌握了图谱里的哪些节点。

请严格按以下规则判定：
1. 只在用户能用自己的话讲清节点的「mastery_criteria」时，才判定为 mastered
2. 含糊、模糊、复述名词不算掌握
3. 如果信息不足，宁可不判定，也不要乱猜
4. 返回 JSON 格式，不要其他文字

输出格式：
{
  "mastered_node_ids": ["node-id-1", "node-id-2"],
  "uncertain_node_ids": ["node-id-3"],
  "next_question": "为了进一步判定，下一个最值得问的问题（中文，简短）"
}"""


@router.post("/diagnose")
async def diagnose(payload: DiagnosePayload) -> dict[str, Any]:
    graph = load_antitao_knowledge_graph()
    nodes = graph.get("nodes", [])
    if payload.track_id:
        nodes = [n for n in nodes if payload.track_id in (n.get("track_ids") or [])]

    # Compact node list for the prompt
    summary = [
        {
            "id": n["id"],
            "title": n["title"]["zh"],
            "mastery_criteria": n.get("mastery_criteria", {}).get("zh", ""),
        }
        for n in nodes
    ]

    transcript = "\n".join(
        f"[{m.role}] {m.content}" for m in payload.messages
    ) or "（用户尚未说话）"

    user_prompt = f"""图谱节点列表（节选必要字段）：
{json.dumps(summary, ensure_ascii=False, indent=2)}

最近的对话：
{transcript}

请输出 JSON。"""

    try:
        text = await llm_complete(prompt=user_prompt, system_prompt=_DIAGNOSE_SYSTEM)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"llm_error: {e}")

    parsed = _safe_parse_json(text)
    if not parsed:
        # fall back: return raw text so the caller can debug
        return {
            "mastered_node_ids": [],
            "uncertain_node_ids": [],
            "next_question": "我来重新问一下：你最想从反淘里搞清楚哪个具体问题？",
            "raw": text,
        }
    return parsed


# ─── AI: Judge whether a single node is mastered from transcript ─────────


_MASTERY_SYSTEM = """你是反淘知识图谱的「掌握判定官」。
任务：根据给定的「目标节点」和「对话记录」，判定用户是否已经达到该节点的掌握标准。

判定规则：
1. 用户必须能用自己的话讲清楚 mastery_criteria 描述的内容
2. 仅复述名词、含糊解释、答非所问 → 未掌握
3. 严格但公平。理由要有引用点（用户的哪句话支持/不支持）
4. 如果对话记录不足以判断，必须判定为未掌握，并给出一个最该追问的问题

输出 JSON：
{
  "mastered": true / false,
  "status": "mastered" / "partial" / "not_mastered",
  "confidence": 0.0 ~ 1.0,
  "reasoning": "简短理由（中文，1-2 句）",
  "missing_points": ["还缺的关键理解点，中文短句"],
  "next_followup": "如果未掌握，下一个该追问的问题"
}"""


@router.post("/check-mastery")
async def check_mastery(
    payload: MasteryCheckPayload,
    user: UserInfo | None = Depends(get_optional_user),
) -> dict[str, Any]:
    graph = load_antitao_knowledge_graph()
    node = get_node_by_id(graph, payload.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="node_not_found")

    transcript = "\n".join(
        f"[{m.role}] {m.content}" for m in payload.transcript
    ) or "（无对话记录）"
    quick_result = _quick_mastery_check_result(node, payload.transcript)
    if quick_result:
        return quick_result

    viewed_section = ""
    if payload.viewed_resources:
        lines = ["用户最近浏览过的学习资源："]
        for vr in payload.viewed_resources[:5]:
            lines.append(f"  · {vr.title}")
        viewed_section = "\n" + "\n".join(lines)

    user_prompt = f"""目标节点：
- id: {node['id']}
- 标题: {node['title']['zh']}
- 掌握标准: {node.get('mastery_criteria', {}).get('zh', '')}
- 验证问题: {[q['zh'] for q in node.get('validation_questions', [])]}
{viewed_section}

对话记录：
{transcript}

请输出 JSON 判定。"""

    try:
        text = await llm_complete(prompt=user_prompt, system_prompt=_MASTERY_SYSTEM)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"llm_error: {e}")

    parsed = _safe_parse_json(text)
    if not parsed:
        parsed = {
            "mastered": False,
            "status": "not_mastered",
            "confidence": 0.0,
            "reasoning": "无法解析模型返回",
            "missing_points": ["需要重新表达对这个节点的理解"],
            "next_followup": "请重新表达一次你对这个问题的理解",
            "raw": text,
        }

    mastered = bool(parsed.get("mastered"))
    status = str(
        parsed.get("status") or ("mastered" if mastered else "not_mastered")
    )
    confidence = _coerce_float(parsed.get("confidence"), default=0.0)
    track_id = (node.get("track_ids") or [None])[0]
    mastered_ids: list[str] = []
    if user:
        mastered_ids = get_member_store().get_mastered_node_ids(user.email)

    recommendation_mastered_ids = list(mastered_ids)
    if mastered and payload.node_id not in recommendation_mastered_ids:
        recommendation_mastered_ids.append(payload.node_id)

    if mastered:
        candidates = recommend_next_nodes(
            graph,
            recommendation_mastered_ids,
            track_id=track_id,
            limit=1,
        )
        next_node = candidates[0] if candidates else None
    else:
        next_node = node

    resources_source = next_node if next_node else node
    review_resources = [
        _resource_preview(r, node_id=resources_source.get("id", ""))
        for r in (resources_source.get("resources") or [])[:3]
        if isinstance(r, dict)
    ]

    return {
        "mastered": mastered,
        "status": status,
        "confidence": confidence,
        "reasoning": str(parsed.get("reasoning") or ""),
        "missing_points": parsed.get("missing_points") or [],
        "next_followup": str(parsed.get("next_followup") or ""),
        "next_node": _node_preview(next_node) if next_node else None,
        "review_resources": review_resources,
        **({"raw": text} if "raw" in parsed else {}),
    }


# ─── AI: Evaluate practical task submission ──────────────────────────────


_TASK_EVALUATOR_SYSTEM = """你是反淘知识图谱的「实操任务判官」。用中文回复。

根据给定节点的实操任务描述和评估标准，评估用户提交的任务完成情况。

判定要求：
1. 严格对照 evaluation_criteria 逐条判断每条是否达标
2. 给出 0-100 分：每条标准通过得对应分数，全部通过 → 85-100，基本通过 → 60-84，大半未通过 → 0-59
3. 写 2-3 句简短的综合评语（中文）
4. 列出做得好的 1-2 个具体点（不是泛泛的"做得不错"）
5. 列出需要改进的 1-2 个具体点

输出 JSON：
{
  "passed": true/false,
  "score": 0-100,
  "feedback": "2-3句综合评语",
  "strengths": ["具体强项1", "具体强项2"],
  "improvements": ["具体改进点1"],
  "next_step": "下一句简短建议"
}"""


@router.post("/evaluate-task")
async def evaluate_task(
    payload: EvaluateTaskPayload,
    _user: UserInfo | None = Depends(get_optional_user),
) -> dict[str, Any]:
    graph = load_antitao_knowledge_graph()
    node = get_node_by_id(graph, payload.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="node_not_found")

    task = node.get("practical_task")
    if not task:
        raise HTTPException(status_code=400, detail="node_has_no_practical_task")

    user_prompt = f"""实操任务：
{task.get('zh', task.get('en', ''))}

评估标准：
{task.get('evaluation_criteria', {}).get('zh', task.get('evaluation_criteria', {}).get('en', '无具体标准'))}

用户提交的答案：
{payload.task_answer}

请输出 JSON 判定。"""

    try:
        text = await llm_complete(prompt=user_prompt, system_prompt=_TASK_EVALUATOR_SYSTEM)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"llm_error: {e}")

    parsed = _safe_parse_json(text)
    if not parsed:
        parsed = {
            "passed": False,
            "score": 0,
            "feedback": "无法解析AI评估结果，请重试",
            "strengths": [],
            "improvements": ["系统评估异常，建议重新提交"],
            "next_step": "请重新提交你的任务答案",
        }

    return {
        "node_id": payload.node_id,
        "passed": bool(parsed.get("passed", False)),
        "score": max(0, min(100, int(parsed.get("score", 0)))),
        "feedback": str(parsed.get("feedback", "")),
        "strengths": parsed.get("strengths") or [],
        "improvements": parsed.get("improvements") or [],
        "next_step": str(parsed.get("next_step", "")),
    }


# ─── AI Tutor mode: actively teach a node (NOT a quiz) ──────────────────


_TUTOR_SYSTEM_TEMPLATE = """你是反淘知识图谱的「AI 导师」，专注教学，不是考官。

当前节点信息：
- 标题：{title}
- 摘要：{summary}
- 掌握标准：{mastery_criteria}
- 验证问题（仅供你自己心里参考）：{validation_questions}
{resources_section}
{viewed_resources_section}

教学规则：
1. 主动讲解。如果用户还没说话，直接开口讲这个节点的核心概念。
2. 简洁：每次回复 ≤ 5 句话。优先用例子、比喻、反问。
3. 检测到用户已经能讲清「掌握标准」描述的内容时，在回复末尾追加标记 [MASTERY_SIGNAL]
4. 如果用户问的问题超出本节点范围，简短解释后引导回本节点
5. 用中文，口语化，避免列大纲式回答
6. 不要说「我是 AI」、「请允许我」这类机器化开场
7. 基础概念里必须把「平台」和「代理」收束为「代理平台」一个概念。代理平台负责代采、仓储、QC/质检、合箱、国际转运和客服，主要收采购/仓储/质检/集运/物流相关服务费；一般不要说代理平台从商品价格里抽佣。
8. 如果用户最近浏览过相关资源，可以主动引用：「你之前看过的那篇《xxx》里提到…」这样会让教学更自然
"""


@router.post("/tutor")
async def tutor(
    payload: TutorPayload,
    _user: UserInfo | None = Depends(get_optional_user),
) -> dict[str, Any]:
    graph = load_antitao_knowledge_graph()
    node = get_node_by_id(graph, payload.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="node_not_found")

    resources = node.get("resources", [])
    resources_section = ""
    if resources:
        lines = ["可引用的学习资源（如有需要请提及）："]
        for r in resources:
            title = r.get("title", {}).get("zh", "")
            url = r.get("url", "")
            summary = r.get("summary", {}).get("zh", "")
            lines.append(f"  · [{r.get('type', 'doc')}] {title} — {summary} ({url})")
        resources_section = "\n" + "\n".join(lines) + "\n"

    viewed_resources_section = ""
    if payload.viewed_resources:
        lines = ["用户最近浏览过的学习资源（可以主动引用）："]
        for vr in payload.viewed_resources[:5]:
            lines.append(f"  · {vr.title} ({vr.url})")
        viewed_resources_section = "\n" + "\n".join(lines) + "\n"

    system_prompt = _TUTOR_SYSTEM_TEMPLATE.format(
        title=node["title"]["zh"],
        summary=node["summary"]["zh"],
        mastery_criteria=node.get("mastery_criteria", {}).get("zh", ""),
        validation_questions=[q["zh"] for q in node.get("validation_questions", [])],
        resources_section=resources_section,
        viewed_resources_section=viewed_resources_section,
    )

    # ⚠️ llm.complete 在传 messages 时会忽略 system_prompt，需手动注入 system 消息
    api_messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
    ]
    if not payload.messages:
        # Cold start: ask LLM to deliver a 3-5 sentence teaching opener
        api_messages.append({
            "role": "user",
            "content": "请用 3-5 句话开始教这个节点。先讲核心概念，再用一个简单例子。结尾问一个能引出用户思考的问题。",
        })
    else:
        for m in payload.messages:
            api_messages.append({"role": m.role, "content": m.content})

    try:
        text = await llm_complete(
            prompt="",
            system_prompt=system_prompt,
            messages=api_messages,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"llm_error: {e}")

    mastery_signal = "[MASTERY_SIGNAL]" in (text or "")
    cleaned = (text or "").replace("[MASTERY_SIGNAL]", "").strip()
    return {
        "reply": cleaned,
        "mastery_signal": mastery_signal,
    }


# ─── Free-form Q&A about reverse cross-border (general 反淘 tutor) ──────


_ASK_SYSTEM = """你是「反淘 AI 导师」，专门回答 **反淘 / 反向海淘 / reverse cross-border** 行业问题。

【关键定义 —— 必须按这个理解，不要按字面解读「反淘」】
"反淘" = "反向海淘" = 海外用户购买中国电商平台（淘宝、1688、微店、Yupoo 等）商品的业务模式。
角色：卖家（中国卖家/工厂）/ 代理平台（采购代理、仓储、QC、集运、国际转运、客服）/ 海外买家。不要把「平台」和「代理」拆成两个角色。
收入口径：代理平台主要收采购/仓储/质检/合箱/国际物流等服务费，一般不收商品佣金，不要默认说“平台抽商品佣金”。

你的职责：
- 回答关于反淘业务的任何问题（流量、转化、KOL、Discord、Reddit、代理平台、物流、口碑、工具等）
- 像一个友好的师傅一样，口语化、直接、不绕弯
- 涉及数字时给区间（如「转化率通常 1%-4%」），别编造确切数字
- 可以举具体平台/工具名（Pandabuy / Yupoo / Weidian / r/FashionReps / Discord 群等）

【风格】
- 中文为主，每次回复 ≤ 5 句话
- 多用比喻、举例、反问引导
- 不列大纲，不开「请允许我...」「我是 AI...」这种机器化开场
- 用户问到反淘以外的话题，简短一句话回应后引导回反淘"""


@router.post("/ask")
async def ask(
    payload: AskPayload,
    _user: UserInfo | None = Depends(get_optional_user),
) -> dict[str, Any]:
    """General 反淘 Q&A — used by the floating AI tutor widget."""
    if not payload.messages:
        return {"reply": "👋 我是反淘 AI 导师。你想了解什么？"}

    # ⚠️ 注意：llm.complete 在传 messages 时会忽略 system_prompt 参数，
    # 必须手动把 system 消息塞进消息列表第一条
    api_messages: list[dict[str, Any]] = [
        {"role": "system", "content": _ASK_SYSTEM},
    ]
    for m in payload.messages:
        api_messages.append({"role": m.role, "content": m.content})

    try:
        text = await llm_complete(
            prompt="",
            system_prompt=_ASK_SYSTEM,
            messages=api_messages,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"llm_error: {e}")

    return {"reply": (text or "").strip()}


# ─── Resource Proxy (inline reading via Feishu Open API) ───────────────────

class FetchResourcePayload(BaseModel):
    url: str


_FEISHU_URL_RE = re.compile(r"^https?://[a-zA-Z0-9.-]+\.feishu\.cn/")
_WIKI_TOKEN_RE = re.compile(r"/wiki/([A-Za-z0-9]+)")

# Token cache: (token, expires_at)
_feishu_token_cache: tuple[str, float] | None = None


def _get_feishu_config() -> tuple[str, str]:
    """Read Feishu app credentials from environment."""
    app_id = os.getenv("ANTITAO_FEISHU_APP_ID", "")
    app_secret = os.getenv("ANTITAO_FEISHU_APP_SECRET", "")
    if not app_id or not app_secret:
        raise HTTPException(status_code=500, detail="feishu_not_configured")
    return app_id, app_secret


async def _get_feishu_tenant_token() -> str:
    """Get a cached Feishu tenant_access_token, refreshing if expired."""
    global _feishu_token_cache
    if _feishu_token_cache and time.time() < _feishu_token_cache[1] - 60:
        return _feishu_token_cache[0]

    app_id, app_secret = _get_feishu_config()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            json={"app_id": app_id, "app_secret": app_secret},
        )
        data = resp.json()
        if data.get("code") != 0:
            raise HTTPException(
                status_code=502,
                detail=f"feishu_auth_failed: {data.get('msg', 'unknown')}",
            )
        token: str = data["tenant_access_token"]
        expire: int = data.get("expire", 7200)
        _feishu_token_cache = (token, time.time() + expire)
        return token


async def _feishu_api_get(path: str, **params: Any) -> dict[str, Any]:
    """Make an authenticated GET request to the Feishu Open API."""
    token = await _get_feishu_tenant_token()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"https://open.feishu.cn{path}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        data = resp.json()
        if data.get("code") != 0:
            raise HTTPException(
                status_code=502,
                detail=f"feishu_api_error: {data.get('msg', 'unknown')}",
            )
        return data


async def _get_wiki_node(wiki_token: str) -> dict[str, Any]:
    """Resolve a wiki page token to its node metadata."""
    data = await _feishu_api_get(
        "/open-apis/wiki/v2/spaces/get_node",
        token=wiki_token,
    )
    return data["data"]["node"]


async def _get_doc_blocks(document_id: str) -> list[dict[str, Any]]:
    """Fetch all top-level blocks of a Feishu document."""
    all_blocks: list[dict[str, Any]] = []
    page_token: str | None = None
    token = await _get_feishu_tenant_token()

    async with httpx.AsyncClient(timeout=15.0) as client:
        while True:
            params: dict[str, Any] = {"page_size": 500}
            if page_token:
                params["page_token"] = page_token
            resp = await client.get(
                f"https://open.feishu.cn/open-apis/docx/v1/documents/{document_id}/blocks",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
            data = resp.json()
            if data.get("code") != 0:
                raise HTTPException(
                    status_code=502,
                    detail=f"feishu_doc_error: {data.get('msg', 'unknown')}",
                )
            items: list[dict[str, Any]] = data["data"].get("items", [])
            all_blocks.extend(items)
            if not data["data"].get("has_more"):
                break
            page_token = data["data"].get("page_token")
            if not page_token:
                break

    return all_blocks


# ─── Feishu block → our output format ──────────────────────────────────

_HEADING_BLOCK_TYPES: dict[int, int] = {
    3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9,
}
_BLOCK_TYPE_KEY: dict[int, str] = {
    2: "text", 3: "heading1", 4: "heading2", 5: "heading3",
    6: "heading4", 7: "heading5", 8: "heading6", 9: "heading7",
    10: "heading8", 11: "heading9",
    12: "bullet", 13: "ordered", 14: "code", 15: "quote",
    20: "divider", 21: "callout",
}


def _extract_elements(block: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract inline elements (text_run) from a Feishu block's text content."""
    bt = block.get("block_type", 0)
    type_key = _BLOCK_TYPE_KEY.get(bt, "")
    if not type_key:
        return []

    content = block.get(type_key, {})
    if isinstance(content, dict):
        fe = content.get("elements", [])
    elif isinstance(content, list):
        # Some blocks have the content directly as a list
        fe = content
    else:
        return []

    result: list[dict[str, Any]] = []
    for elem in fe:
        if not isinstance(elem, dict):
            continue
        tr = elem.get("text_run")
        if tr:
            style = tr.get("text_element_style", {}) or {}
            link = style.get("link", {}) or {}
            result.append({
                "text": tr.get("content", ""),
                "bold": style.get("bold", False),
                "italic": style.get("italic", False),
                "code": style.get("inline_code", False),
                "link": link.get("url") if link else None,
            })
    return result


def _feishu_block_to_output(block: dict[str, Any]) -> dict[str, Any] | None:
    """Convert a single Feishu block to our simplified output block."""
    bt = block.get("block_type", 0)

    # Skip page container (type 1) — it has children but no visible content
    if bt == 1:
        return None

    # Headings (3–11 → level 1–9)
    if bt in _HEADING_BLOCK_TYPES:
        level = _HEADING_BLOCK_TYPES[bt]
        return {"type": "heading", "level": level, "elements": _extract_elements(block)}

    # Paragraph
    if bt == 2:
        return {"type": "paragraph", "elements": _extract_elements(block)}

    # Bullet list item
    if bt == 12:
        return {"type": "list", "ordered": False, "elements": _extract_elements(block)}

    # Ordered list item
    if bt == 13:
        return {"type": "list", "ordered": True, "elements": _extract_elements(block)}

    # Code block
    if bt == 14:
        code_data = block.get("code", {})
        elements = code_data.get("elements", [])
        text = "".join(
            (e.get("text_run", {}).get("content", "") if isinstance(e, dict) else "")
            for e in elements
        )
        style = code_data.get("style", {}) or {}
        lang = style.get("language", 0) if isinstance(style, dict) else 0
        return {"type": "code", "text": text, "language": lang}

    # Blockquote
    if bt == 15:
        return {"type": "blockquote", "elements": _extract_elements(block)}

    # Divider
    if bt == 20:
        return {"type": "divider"}

    # Callout (info/warning/tip boxes)
    if bt == 21:
        return {"type": "callout", "elements": _extract_elements(block)}

    # Unknown — try to extract from any field with elements
    for key, val in block.items():
        if isinstance(val, dict) and "elements" in val:
            elements = _extract_elements(block)
            if elements:
                return {"type": "paragraph", "elements": elements}

    return None


def _blocks_to_plain_text(output_blocks: list[dict[str, Any]]) -> str:
    """Render output blocks to plain text (backward compat / search)."""
    lines: list[str] = []
    for b in output_blocks:
        t = b.get("type", "")
        elements: list[dict[str, Any]] = b.get("elements", [])
        text = "".join(e.get("text", "") for e in elements)
        if t == "heading":
            lines.append("#" * b.get("level", 1) + " " + text)
        elif t == "paragraph":
            lines.append(text)
        elif t == "list":
            prefix = "- " if not b.get("ordered") else "1. "
            lines.append(prefix + text)
        elif t == "code":
            lines.append(b.get("text", ""))
        elif t == "blockquote":
            lines.append("> " + text)
        elif t == "divider":
            lines.append("---")
        elif t == "callout":
            lines.append("💡 " + text)
    return "\n\n".join(lines)


# ─── Internal Linking ─────────────────────────────────────────────────────

def _build_related_links(
    plain_text: str,
    current_url: str,
    graph: dict[str, Any] | None = None,
    max_links: int = 5,
) -> list[dict[str, str]]:
    """Scan plain_text for concepts matching knowledge graph node/resource titles.

    Builds a match index from the graph, scans the text for each concept, scores
    matches by specificity (exact > case-insensitive > substring), excludes the
    current document, and returns the top N links.

    Returns: [{"concept": str, "doc_url": str, "doc_title": str, "node_id": str}]
    """
    if not plain_text or not graph:
        return []

    # ── Build match index ──────────────────────────────────────────────────
    # Each entry: (search_key, concept_label, doc_url, doc_title, node_id, priority)
    # priority is a heuristic of how "important" the match is
    index: list[tuple[str, str, str, str, str, int]] = []

    # Normalize current URL for self-exclusion
    current_url_norm = current_url.rstrip("/").lower()

    for node in graph.get("nodes", []):
        node_id = node.get("id", "")
        node_title_zh = (node.get("title") or {}).get("zh", "")
        node_title_en = (node.get("title") or {}).get("en", "")
        resources = node.get("resources") or []

        # Node titles as matchable concepts
        for title, prio in [(node_title_zh, 3), (node_title_en, 1)]:
            if not title or len(title) < 3:
                continue
            # Use the first resource as the link target for node-level matches
            first_res = resources[0] if resources else None
            if first_res:
                res_url = (first_res.get("url") or "").rstrip("/").lower()
                if res_url == current_url_norm:
                    continue
                res_title = (first_res.get("title") or {}).get("zh", "") or (first_res.get("title") or {}).get("en", "")
                index.append((title, title, first_res.get("url", ""), res_title, node_id, prio))

        # Resource titles as matchable concepts
        for res in resources:
            res_url = (res.get("url") or "").rstrip("/").lower()
            if res_url == current_url_norm:
                continue
            res_title_zh = (res.get("title") or {}).get("zh", "")
            res_title_en = (res.get("title") or {}).get("en", "")
            for res_title, prio in [(res_title_zh, 2), (res_title_en, 1)]:
                if not res_title or len(res_title) < 3:
                    continue
                index.append((res_title, res_title, res.get("url", ""), res_title, node_id, prio))

    # ── Deduplicate by concept label (keep highest priority) ───────────────
    seen: dict[str, tuple[str, str, str, str, str, int]] = {}
    for entry in index:
        concept = entry[1]
        if concept not in seen or entry[5] > seen[concept][5]:
            seen[concept] = entry

    # ── Score each candidate against the plain text ───────────────────────
    text_lower = plain_text.lower()
    scored: list[tuple[int, str, str, str, str]] = []  # (score, concept, doc_url, doc_title, node_id)

    for search_key, concept, doc_url, doc_title, node_id, priority in seen.values():
        search_lower = search_key.lower()
        score = 0

        # Exact match (highest confidence)
        if search_key in plain_text:
            score = 30 + priority * 5 + min(len(search_key), 15)
        elif search_lower in text_lower:
            # Case-insensitive match
            score = 20 + priority * 3 + min(len(search_key), 10)
        elif len(search_key) >= 4 and search_key[:4] in plain_text:
            # Partial match (first 4 chars)
            score = 10 + priority
        elif len(search_key) >= 4 and search_key[:2] in plain_text:
            # Minimal substring match
            score = 5 + priority
        else:
            # Check individual words
            words = search_key.split()
            if len(words) >= 2:
                matched_words = sum(1 for w in words if len(w) >= 2 and w.lower() in text_lower)
                if matched_words >= 2:
                    score = 10 + priority + matched_words * 2

        if score > 0:
            scored.append((score, concept, doc_url, doc_title, node_id))

    # ── Sort by score desc, take top N ────────────────────────────────────
    scored.sort(key=lambda x: x[0], reverse=True)

    # Deduplicate by doc_url in results
    seen_urls: set[str] = set()
    result: list[dict[str, str]] = []
    for _, concept, doc_url, doc_title, node_id in scored:
        url_norm = doc_url.rstrip("/").lower()
        if url_norm in seen_urls:
            continue
        seen_urls.add(url_norm)
        result.append({
            "concept": concept,
            "doc_url": doc_url,
            "doc_title": doc_title,
            "node_id": node_id,
        })
        if len(result) >= max_links:
            break

    return result


# ─── Endpoint ────────────────────────────────────────────────────────────

@router.post("/fetch-resource")
async def fetch_resource(payload: FetchResourcePayload) -> dict[str, Any]:
    """Fetch a Feishu wiki/doc page via the Open API and return structured content.

    Uses the Feishu Docx API to get typed blocks (headings, paragraphs, lists,
    code, quotes, dividers) — no HTML scraping needed.
    """
    if not _FEISHU_URL_RE.match(payload.url):
        raise HTTPException(status_code=400, detail="only_feishu_urls_allowed")

    # Extract wiki token from URL
    wiki_token_match = _WIKI_TOKEN_RE.search(payload.url)
    if not wiki_token_match:
        return {
            "url": payload.url, "title": "", "content": "", "blocks": [],
            "related_links": [], "error": "invalid_feishu_url_format",
        }
    wiki_token = wiki_token_match.group(1)

    try:
        node = await _get_wiki_node(wiki_token)
    except HTTPException:
        raise
    except Exception as e:
        return {
            "url": payload.url, "title": "", "content": "", "blocks": [],
            "related_links": [], "error": f"wiki_lookup_error: {e}",
        }

    obj_type = node.get("obj_type", "")
    obj_token = node.get("obj_token", "")
    title: str = node.get("title", "")

    if obj_type not in ("doc", "docx"):
        return {
            "url": payload.url, "title": title, "content": "", "blocks": [],
            "related_links": [], "error": f"unsupported_feishu_type: {obj_type}",
        }
    if not obj_token:
        return {
            "url": payload.url, "title": title, "content": "", "blocks": [],
            "related_links": [], "error": "no_document_token",
        }

    try:
        feishu_blocks = await _get_doc_blocks(obj_token)
    except HTTPException:
        raise
    except Exception as e:
        return {
            "url": payload.url, "title": title, "content": "", "blocks": [],
            "related_links": [], "error": f"doc_fetch_error: {e}",
        }

    output_blocks = [_feishu_block_to_output(b) for b in feishu_blocks]
    output_blocks = [b for b in output_blocks if b is not None]

    plain_text = _blocks_to_plain_text(output_blocks)
    if len(plain_text) > 12000:
        plain_text = plain_text[:12000] + "…"

    # Build related links from knowledge graph
    try:
        graph = load_antitao_knowledge_graph()
    except Exception:
        graph = None
    related_links = _build_related_links(plain_text, payload.url, graph)

    return {
        "url": payload.url,
        "title": title,
        "content": plain_text,
        "blocks": output_blocks,
        "related_links": related_links,
        "error": "",
    }


# ─── Document Explainer (inline AI assistant) ───────────────────────────

class ExplainPayload(BaseModel):
    node_id: str
    document_url: str = ""
    document_title: str = ""
    document_content: str = ""
    question: str
    conversation_history: list[dict[str, str]] = []


_DOC_EXPLAINER_SYSTEM = """你是一个文档助读助手，服务于"反淘淘金通关系统"的学习者。

## 你的唯一职责
帮助用户理解他们正在阅读的文档中的概念、术语和内容。

## 你应该做的
- 用通俗的语言解释不熟悉的概念
- 对容易混淆的段落做澄清
- 提供具体的例子帮助理解
- 关联文档内不同位置的相关内容
- 回答用户的追问

## 你绝对不能做的
- 不要建议用户下一步该学什么
- 不要评价用户的理解水平
- 不要说"通关""掌握""评估""成绩""达标"等任何教学评判语言
- 不要规划学习路线
- 保持回答简洁（2-4 句），除非用户要求详细展开

## 你可以参考的上下文
1. 用户正在阅读的文档全文
2. 文档所属知识节点的概要
3. 同一节点下的其他资料（可在解释中引用，例如"同一节点的《xxx》里也提到…"）

始终基于文档内容来回答，引用具体段落时会更有说服力。"""


@router.post("/explain")
async def explain_document(payload: ExplainPayload) -> dict[str, Any]:
    """Answer questions about a document the user is reading inline.

    Lightweight endpoint — does NOT plan curriculum, evaluate mastery, or
    suggest next steps. Pure document comprehension assistant.
    """
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="question_required")

    # ── Build context from node & document ──
    context_blocks: list[str] = []

    if payload.document_title:
        context_blocks.append(f"# 用户正在阅读的文档\n标题：{payload.document_title}")

    if payload.document_content:
        # Truncate to keep context manageable
        content = payload.document_content
        if len(content) > 6000:
            content = content[:6000] + "…(内容已截断)"
        context_blocks.append(f"\n## 文档内容\n{content}")

    # Node-level context
    graph = load_antitao_knowledge_graph()
    node = get_node_by_id(graph, payload.node_id)
    if node:
        node_title = (node.get("title") or {}).get("zh", "")
        node_summary = (node.get("summary") or {}).get("zh", "")
        context_blocks.append(f"\n## 所在知识节点\n节点名：{node_title}\n概要：{node_summary}")

        # Other resources in same node (for cross-referencing)
        resources = node.get("resources") or []
        other_res = [
            r for r in resources
            if r.get("url") != payload.document_url
        ]
        if other_res:
            lines = ["\n## 同一节点的其他资料（可在回答中引用）"]
            for r in other_res[:5]:
                r_title = (r.get("title") or {}).get("zh", "")
                r_summary = (r.get("summary") or {}).get("zh", "")
                lines.append(f"- 《{r_title}》：{r_summary}")
            context_blocks.append("\n".join(lines))

    context = "\n\n".join(context_blocks)

    # ── Build messages ──
    messages: list[dict[str, str]] = [
        {"role": "system", "content": _DOC_EXPLAINER_SYSTEM},
        {"role": "user", "content": context},
        {"role": "assistant", "content": "我准备好了。请告诉我在阅读中遇到的疑问，我会结合文档内容帮你理解。"},
    ]

    for msg in payload.conversation_history:
        if msg.get("role") in ("user", "assistant") and msg.get("content", "").strip():
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": payload.question})

    try:
        reply = await llm_complete("", messages=messages)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"llm_error: {e}")


# ─── Helpers ─────────────────────────────────────────────────────────────


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _node_preview(node: dict[str, Any] | None) -> dict[str, Any] | None:
    if not node:
        return None
    return {
        "id": node.get("id", ""),
        "track_ids": node.get("track_ids") or [],
        "title": node.get("title") or {"zh": "", "en": ""},
        "summary": node.get("summary") or {"zh": "", "en": ""},
        "mastery_criteria": node.get("mastery_criteria") or {"zh": "", "en": ""},
    }


def _resource_preview(resource: dict[str, Any], node_id: str) -> dict[str, Any]:
    return {
        "node_id": node_id,
        "type": resource.get("type", "doc"),
        "title": resource.get("title") or {"zh": "", "en": ""},
        "url": resource.get("url", ""),
        "summary": resource.get("summary") or {"zh": "", "en": ""},
    }


def _quick_mastery_check_result(
    node: dict[str, Any],
    transcript: list[DiagnoseMessage],
) -> dict[str, Any] | None:
    """Skip the slow LLM judge when the user clearly has not answered yet."""
    user_text = " ".join(
        (m.content or "").strip() for m in transcript if m.role == "user"
    ).strip()
    compact = "".join(user_text.split()).lower()
    unclear_answers = {
        "不清楚",
        "不知道",
        "不会",
        "没懂",
        "不懂",
        "不明白",
        "不知道怎么说",
        "idontknow",
        "dontknow",
    }
    if not compact or compact in unclear_answers or len(compact) <= 3:
        resources = [
            _resource_preview(r, node_id=node.get("id", ""))
            for r in (node.get("resources") or [])[:3]
            if isinstance(r, dict)
        ]
        return {
            "mastered": False,
            "status": "not_mastered",
            "confidence": 0.96,
            "reasoning": "你还没有用自己的话解释这个节点，所以先不判定为通关。",
            "missing_points": [
                "需要用自己的话说清核心角色",
                "需要说明钱、货或服务费在链路里如何流转",
            ],
            "next_followup": "请用自己的话简单说一遍：这个节点里每个角色分别做什么、靠什么获得价值？",
            "next_node": _node_preview(node),
            "review_resources": resources,
        }
    return None



def _safe_parse_json(text: str) -> dict[str, Any] | None:
    """Tolerantly extract a JSON object from an LLM reply."""
    text = (text or "").strip()
    # Strip code fences if present
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to grab the first {...} block
    start = text.find("{")
    end = text.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None

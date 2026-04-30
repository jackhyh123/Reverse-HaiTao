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
from typing import Any, Literal

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


class MasteryCheckPayload(BaseModel):
    node_id: str
    transcript: list[DiagnoseMessage]


class TutorPayload(BaseModel):
    node_id: str
    messages: list[DiagnoseMessage] = []


class AskPayload(BaseModel):
    """Free-form Q&A about reverse cross-border (NOT tied to a specific node)."""
    messages: list[DiagnoseMessage] = []


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


# ─── Progress (per logged-in member) ─────────────────────────────────────


@router.get("/progress")
async def get_my_progress(user: UserInfo = Depends(get_current_user)) -> dict[str, Any]:
    store = get_member_store()
    rows = store.get_user_progress(user.email)
    mastered = [r["node_id"] for r in rows if r["status"] == "mastered"]
    return {"progress": rows, "mastered_node_ids": mastered}


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

    user_prompt = f"""目标节点：
- id: {node['id']}
- 标题: {node['title']['zh']}
- 掌握标准: {node.get('mastery_criteria', {}).get('zh', '')}
- 验证问题: {[q['zh'] for q in node.get('validation_questions', [])]}

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


# ─── AI Tutor mode: actively teach a node (NOT a quiz) ──────────────────


_TUTOR_SYSTEM_TEMPLATE = """你是反淘知识图谱的「AI 导师」，专注教学，不是考官。

当前节点信息：
- 标题：{title}
- 摘要：{summary}
- 掌握标准：{mastery_criteria}
- 验证问题（仅供你自己心里参考）：{validation_questions}
{resources_section}

教学规则：
1. 主动讲解。如果用户还没说话，直接开口讲这个节点的核心概念。
2. 简洁：每次回复 ≤ 5 句话。优先用例子、比喻、反问。
3. 检测到用户已经能讲清「掌握标准」描述的内容时，在回复末尾追加标记 [MASTERY_SIGNAL]
4. 如果用户问的问题超出本节点范围，简短解释后引导回本节点
5. 用中文，口语化，避免列大纲式回答
6. 不要说「我是 AI」、「请允许我」这类机器化开场
7. 基础概念里必须把「平台」和「代理」收束为「代理平台」一个概念。代理平台负责代采、仓储、QC/质检、合箱、国际转运和客服，主要收采购/仓储/质检/集运/物流相关服务费；一般不要说代理平台从商品价格里抽佣。
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

    system_prompt = _TUTOR_SYSTEM_TEMPLATE.format(
        title=node["title"]["zh"],
        summary=node["summary"]["zh"],
        mastery_criteria=node.get("mastery_criteria", {}).get("zh", ""),
        validation_questions=[q["zh"] for q in node.get("validation_questions", [])],
        resources_section=resources_section,
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

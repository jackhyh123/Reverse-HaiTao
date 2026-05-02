"""Explore API: AI-driven ecosystem navigation + focus graph generation.

Endpoints:
    POST /api/v1/explore/chat  →  conversation + focus graph + action steps
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deeptutor.api.routers.auth import UserInfo, get_optional_user
from deeptutor.services.llm import complete as llm_complete

router = APIRouter()


# ─── Models ──────────────────────────────────────────────────────────────


class ExploreMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ExploreGraphNode(BaseModel):
    id: str
    domain: str
    title: dict[str, str]  # {"zh": "...", "en": "..."}
    summary: dict[str, str]
    tags: list[str] = []
    connections: list[dict[str, str]] = []  # [{target, relation}]


class ExploreGraphDomain(BaseModel):
    id: str
    label: dict[str, str]
    summary: dict[str, str]
    color: str


class ExploreGraphContext(BaseModel):
    domains: list[ExploreGraphDomain] = []
    nodes: list[ExploreGraphNode] = []


class ExploreChatPayload(BaseModel):
    messages: list[ExploreMessage] = []
    graph_context: ExploreGraphContext | None = None


# ─── System prompt ───────────────────────────────────────────────────────

_EXPLORE_SYSTEM = """你是「反淘生态导航助手」，专门帮助用户理解反向海淘（反淘）的行业生态，并生成个性化的行动路径。

## 你的能力
用户会描述他想在反淘行业里做的事情（比如"我想做 TikTok 带货"、"怎么找靠谱的货源"、"怎么搞定跨境物流"），你需要：

1. **理解用户意图**：判断他关心反淘生态的哪个环节（流量/交易/履约/基建）
2. **关联生态节点**：从提供的生态图谱中找出与用户问题相关的节点
3. **生成行动步骤**：给用户 3-6 个具体的、可执行的行动步骤

## 反淘生态四大域
- **流量层**：达人/KOL、私域社区、独立社区（Reddit）、平台自有流量 → 买家从哪来
- **交易层**：电商平台、代理平台、独立站/直销、社交电商/直播带货 → 在哪成交
- **履约层**：代购/分销卖家、仓储集运国际物流、质检验货 → 货怎么交付
- **基建层**：跨境支付API、国内电商供应链API、供应链上游/工厂、换汇税务合规 → 底层靠什么

## 行动步骤要求
- 每个步骤必须具体可执行，是"去做XX"而不是"了解XX"
- 如果能关联到具体的平台或工具，一定要写出来（如 Pandabuy、1688、Stripe、Shopify 等）
- 步骤有逻辑顺序，从第一步到第N步形成完整路径
- 如果用户意图不明确，先追问 1-2 个关键问题再生成路径

## 输出格式（严格遵守 JSON）
你的回复必须是一个 JSON 对象，不要有任何其他文字：

```json
{
  "reply": "你的中文文本回复（友好、直接、口语化，≤ 5 句话）",
  "highlighted_nodes": ["node_id_1", "node_id_2"],
  "action_steps": [
    {
      "title": "行动步骤标题（简短，动词开头）",
      "description": "具体怎么做（1-2句话）",
      "resource_url": "如果有推荐的具体链接就写，否则留空字符串"
    }
  ]
}
```

## 规则
- 如果用户说的话跟反淘完全无关，引导回反淘话题
- highlighted_nodes 只包含确实相关的节点 ID（从提供的图谱中选）
- 如果用户问题太宽泛（如"跟我说说反淘"），选出 3-5 个核心节点高亮，并给出一个入门路径
- 每条 reply 都要有实质信息，不要只说"好的我来帮你"这种废话"""


# ─── Helper ──────────────────────────────────────────────────────────────


def _safe_parse_json(text: str) -> dict[str, Any] | None:
    """Tolerantly extract a JSON object from an LLM reply."""
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None


def _build_graph_section(graph_context: ExploreGraphContext | None) -> str:
    """Build a compact text representation of the explore graph for the LLM prompt."""
    if not graph_context or not graph_context.nodes:
        return "（无图谱数据）"

    lines: list[str] = []

    # Domains
    lines.append("## 生态域")
    for d in graph_context.domains:
        lines.append(f"- {d.id}: {d.label.get('zh', '')} — {d.summary.get('zh', '')}")

    # Nodes
    lines.append("\n## 生态节点（可用作 highlighted_nodes 的 ID 列表）")
    for n in graph_context.nodes:
        conn_targets = [c.get("target", "") for c in n.connections] if n.connections else []
        conn_str = " → ".join(conn_targets) if conn_targets else "无"
        lines.append(
            f"- [{n.id}] {n.title.get('zh', '')}（域: {n.domain}）\n"
            f"  概要: {n.summary.get('zh', '')}\n"
            f"  关联: {conn_str}"
        )

    return "\n".join(lines)


# ─── Endpoint ────────────────────────────────────────────────────────────


@router.post("/chat")
async def explore_chat(
    payload: ExploreChatPayload,
    _user: UserInfo | None = Depends(get_optional_user),
) -> dict[str, Any]:
    """AI-powered explore chat with ecosystem focus and action step generation."""

    if not payload.messages:
        return {
            "reply": "👋 我是反淘生态导航助手。告诉我你想做什么，我帮你梳理路径。",
            "highlighted_nodes": [],
            "action_steps": [],
        }

    graph_section = _build_graph_section(payload.graph_context)

    # Build messages for LLM
    api_messages: list[dict[str, Any]] = [
        {"role": "system", "content": _EXPLORE_SYSTEM},
        {"role": "user", "content": f"以下是当前反淘生态图谱数据：\n\n{graph_section}"},
        {
            "role": "assistant",
            "content": "我已理解生态图谱结构。请告诉我你想在反淘行业里做什么，我会帮你聚焦相关节点并生成行动路径。",
        },
    ]

    for m in payload.messages:
        api_messages.append({"role": m.role, "content": m.content})

    try:
        text = await llm_complete(
            prompt="",
            system_prompt=_EXPLORE_SYSTEM,
            messages=api_messages,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"llm_error: {e}")

    parsed = _safe_parse_json(text)

    if parsed and "reply" in parsed:
        return {
            "reply": str(parsed.get("reply", "")).strip(),
            "highlighted_nodes": parsed.get("highlighted_nodes") or [],
            "action_steps": parsed.get("action_steps") or [],
        }

    # Fallback: LLM didn't return valid JSON — return the raw text as reply
    return {
        "reply": (text or "抱歉，我暂时无法回答这个问题，请换个问法试试。").strip(),
        "highlighted_nodes": [],
        "action_steps": [],
    }

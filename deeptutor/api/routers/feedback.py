"""Public feedback endpoints with optional Feishu webhook notification."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from deeptutor.api.routers.auth import UserInfo, require_admin
from deeptutor.services.feedback import list_feedback, save_feedback

router = APIRouter()

FEISHU_WEBHOOK_URL = os.environ.get("FEISHU_WEBHOOK_URL", "").strip()


class FeedbackCreate(BaseModel):
    rating: str | None = None
    role: str | None = None
    message: str
    contact: str | None = None
    page_url: str | None = None
    user_agent: str | None = None


def _build_feishu_card(record: dict[str, Any]) -> dict[str, Any]:
    """Build a Feishu interactive card for a feedback submission."""
    rating = record.get("rating") or "未填写"
    role = record.get("role") or "未填写"
    message = record.get("message", "")
    contact = record.get("contact") or "未填写"
    page_url = record.get("page_url") or "—"

    # Truncate long messages
    if len(message) > 500:
        message = message[:500] + "..."

    return {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": "📢 反淘淘金 — 新用户反馈"},
                "template": "blue",
            },
            "elements": [
                {
                    "tag": "div",
                    "fields": [
                        {"is_short": True, "text": {"tag": "lark_md", "content": f"**评分**\n{rating}"}},
                        {"is_short": True, "text": {"tag": "lark_md", "content": f"**角色**\n{role}"}},
                    ],
                },
                {"tag": "hr"},
                {
                    "tag": "div",
                    "text": {"tag": "lark_md", "content": f"**反馈内容**\n{message}"},
                },
                {"tag": "hr"},
                {
                    "tag": "div",
                    "fields": [
                        {"is_short": True, "text": {"tag": "lark_md", "content": f"**联系方式**\n{contact}"}},
                        {"is_short": True, "text": {"tag": "lark_md", "content": f"**页面**\n{page_url}"}},
                    ],
                },
                {
                    "tag": "note",
                    "elements": [{"tag": "plain_text", "content": f"ID: {record.get('id', '—')} | {record.get('created_at', '')}"}],
                },
            ],
        },
    }


async def _notify_feishu(record: dict[str, Any]) -> None:
    """Send feedback notification to Feishu group via webhook (non-blocking to caller)."""
    if not FEISHU_WEBHOOK_URL:
        return
    try:
        card = _build_feishu_card(record)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(FEISHU_WEBHOOK_URL, json=card)
            if resp.status_code >= 400:
                # Log but don't fail — notification is best-effort
                import logging
                logging.getLogger("deeptutor.feedback").warning(
                    f"Feishu webhook returned {resp.status_code}: {resp.text[:300]}"
                )
    except Exception:
        import logging
        logging.getLogger("deeptutor.feedback").warning(
            "Feishu webhook notification failed", exc_info=True
        )


@router.post("")
async def create_feedback(payload: FeedbackCreate, request: Request) -> dict[str, Any]:
    data = payload.model_dump()
    if not data.get("user_agent"):
        data["user_agent"] = request.headers.get("user-agent", "")
    try:
        record = save_feedback(data)
    except ValueError as exc:
        if str(exc) == "message_required":
            raise HTTPException(status_code=400, detail="message_required")
        raise

    # Fire-and-forget Feishu notification (best-effort, won't block response)
    await _notify_feishu(record)

    return {"feedback": record}


@router.get("")
async def get_feedback(
    limit: int = 100,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    return {"items": list_feedback(max(1, min(limit, 500)))}

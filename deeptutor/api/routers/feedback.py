"""Public feedback endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from deeptutor.api.routers.auth import UserInfo, require_admin
from deeptutor.services.feedback import list_feedback, save_feedback


router = APIRouter()


class FeedbackCreate(BaseModel):
    rating: str | None = None
    role: str | None = None
    message: str
    contact: str | None = None
    page_url: str | None = None
    user_agent: str | None = None


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
    return {"feedback": record}


@router.get("")
async def get_feedback(
    limit: int = 100,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    return {"items": list_feedback(max(1, min(limit, 500)))}

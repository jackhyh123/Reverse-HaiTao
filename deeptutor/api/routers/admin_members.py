"""Admin-only API: member list, detail, create, update, delete.

All endpoints require an admin session cookie.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deeptutor.api.routers.auth import UserInfo, require_admin
from deeptutor.services.auth import get_member_store
from deeptutor.services.session import get_sqlite_session_store

router = APIRouter()


class CreateMemberPayload(BaseModel):
    email: str
    status: str = "active"
    is_premium: bool = False


class UpdateMemberPayload(BaseModel):
    status: str | None = None
    is_premium: bool | None = None
    note: str | None = None


@router.get("/members")
async def list_members(
    _admin: UserInfo = Depends(require_admin),
    limit: int = 200,
) -> dict[str, Any]:
    store = get_member_store()
    members = store.list_members(limit=limit)
    enriched: list[dict[str, Any]] = []
    for m in members:
        stats = store.get_member_stats(m["email"])
        enriched.append({**m, **stats})
    return {"members": enriched, "total": len(enriched)}


@router.post("/members")
async def create_member(
    payload: CreateMemberPayload,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    store = get_member_store()
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="invalid_email")
    try:
        member = store.create_member(
            email=email,
            status=payload.status,
            is_premium=payload.is_premium,
        )
    except ValueError as exc:
        if str(exc) == "member_exists":
            raise HTTPException(status_code=409, detail="member_exists")
        raise
    return {"member": member}


@router.get("/members/{email}")
async def get_member_detail(
    email: str,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    store = get_member_store()
    member = store.get_member(email)
    if not member:
        raise HTTPException(status_code=404, detail="member_not_found")
    stats = store.get_member_stats(email)

    sessions: list[dict[str, Any]] = []
    try:
        unified = get_sqlite_session_store()
        all_sessions = await unified.list_sessions(limit=200, offset=0)
        sessions = list(all_sessions)[:20]
    except Exception:
        sessions = []

    return {
        "member": member,
        "stats": stats,
        "recent_sessions": sessions,
    }


@router.patch("/members/{email}")
async def update_member(
    email: str,
    payload: UpdateMemberPayload,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    store = get_member_store()
    if not store.get_member(email):
        raise HTTPException(status_code=404, detail="member_not_found")

    if payload.status is not None:
        store.update_status(email, payload.status)
    if payload.is_premium is not None:
        store.toggle_premium(email, payload.is_premium)

    return {"member": store.get_member(email)}


@router.delete("/members/{email}")
async def delete_member(
    email: str,
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    store = get_member_store()
    if not store.get_member(email):
        raise HTTPException(status_code=404, detail="member_not_found")
    store.delete_member(email)
    return {"deleted": True}

"""Admin-only API: member list and per-member detail.

All endpoints require an admin session cookie.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from deeptutor.api.routers.auth import UserInfo, require_admin
from deeptutor.services.auth import get_member_store
from deeptutor.services.session import get_sqlite_session_store

router = APIRouter()


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

    # Try to surface chat sessions if they were tagged with this user.
    # (Existing sessions table doesn't yet have user_email column; fall back to
    # an empty list — wired in Day 5 when sessions get user-scoped.)
    sessions: list[dict[str, Any]] = []
    try:
        unified = get_sqlite_session_store()
        all_sessions = await unified.list_sessions(limit=200, offset=0)
        # placeholder filter: nothing to filter by yet, return latest 20
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
    payload: dict[str, Any],
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    store = get_member_store()
    if not store.get_member(email):
        raise HTTPException(status_code=404, detail="member_not_found")
    if "status" in payload:
        store.update_status(email, str(payload["status"]))
    return {"member": store.get_member(email)}

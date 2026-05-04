"""Admin-only API: AI usage logs (daily aggregate per user + model)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from deeptutor.api.routers.auth import UserInfo, require_admin
from deeptutor.services.usage import get_usage_store

router = APIRouter()


@router.get("/usage")
async def get_usage(
    email: str | None = Query(default=None, description="Filter by user email"),
    date_from: str | None = Query(default=None, description="YYYY-MM-DD start date"),
    date_to: str | None = Query(default=None, description="YYYY-MM-DD end date"),
    limit: int = Query(default=200, ge=1, le=1000),
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    store = get_usage_store()
    rows = store.get_daily_usage(email=email, date_from=date_from, date_to=date_to, limit=limit)
    totals = store.get_totals(date_from=date_from, date_to=date_to)
    return {"items": rows, "total": len(rows), "totals": totals}

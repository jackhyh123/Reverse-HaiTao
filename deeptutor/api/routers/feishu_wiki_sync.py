"""Admin APIs for syncing local AntiTao wiki pages into Feishu Wiki."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from deeptutor.api.routers.auth import UserInfo, require_admin
from deeptutor.services.feishu_wiki_sync import (
    FeishuWikiSyncError,
    get_sync_status,
    sync_local_wiki_to_feishu,
)

router = APIRouter()


@router.get("/feishu-wiki-sync")
async def get_feishu_wiki_sync_status(
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    return get_sync_status()


@router.post("/feishu-wiki-sync")
async def run_feishu_wiki_sync(
    _admin: UserInfo = Depends(require_admin),
) -> dict[str, Any]:
    try:
        return sync_local_wiki_to_feishu()
    except FeishuWikiSyncError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"feishu_sync_failed: {e}")

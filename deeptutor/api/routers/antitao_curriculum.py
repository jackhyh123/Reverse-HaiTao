from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from deeptutor.services.settings.antitao_curriculum import (
    load_antitao_curriculum,
    save_antitao_curriculum,
)

router = APIRouter()


class AntitaoCurriculumPayload(BaseModel):
    curriculum: dict[str, Any]


@router.get("")
async def get_antitao_curriculum():
    return {"curriculum": load_antitao_curriculum()}


@router.put("")
async def update_antitao_curriculum(payload: AntitaoCurriculumPayload):
    return {"curriculum": save_antitao_curriculum(payload.curriculum)}

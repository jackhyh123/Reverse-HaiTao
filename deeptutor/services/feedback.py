"""Simple public feedback storage for product testing."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any
from uuid import uuid4

from deeptutor.services.path_service import get_path_service


FEEDBACK_FILE = get_path_service().get_settings_file("antitao_user_feedback.jsonl")


def save_feedback(payload: dict[str, Any]) -> dict[str, Any]:
    FEEDBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "id": uuid4().hex,
        "created_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "rating": str(payload.get("rating") or "").strip()[:40],
        "role": str(payload.get("role") or "").strip()[:40],
        "message": str(payload.get("message") or "").strip()[:5000],
        "contact": str(payload.get("contact") or "").strip()[:200],
        "page_url": str(payload.get("page_url") or "").strip()[:1000],
        "user_agent": str(payload.get("user_agent") or "").strip()[:1000],
    }
    if not record["message"]:
        raise ValueError("message_required")
    with FEEDBACK_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record


def list_feedback(limit: int = 100) -> list[dict[str, Any]]:
    if not FEEDBACK_FILE.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in FEEDBACK_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return list(reversed(rows[-limit:]))

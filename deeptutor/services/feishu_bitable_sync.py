from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlparse

import requests

from deeptutor.logging import get_logger
from deeptutor.services.config import get_env_store

logger = get_logger("antitao.feishu")

DEFAULT_FEISHU_OPEN_API_ROOT = "https://open.feishu.cn"
DEFAULT_FEISHU_EXPORT_DIR = Path("data/external_sources/feishu/antitao_bitable")


class FeishuBitableSyncError(RuntimeError):
    """Raised when the Feishu bitable snapshot cannot be refreshed."""


@dataclass(slots=True)
class FeishuBitableSyncSummary:
    export_dir: Path
    table_count: int
    record_count: int
    synced_at: str


def has_antitao_feishu_config() -> bool:
    """Return True when the minimum env vars for direct bitable sync exist."""
    app_id = _env("ANTITAO_FEISHU_APP_ID")
    app_secret = _env("ANTITAO_FEISHU_APP_SECRET")
    app_token = _resolve_app_token()
    return bool(app_id and app_secret and app_token)


def sync_antitao_feishu_bitable_snapshot(project_root: Path) -> FeishuBitableSyncSummary:
    """Fetch the configured Feishu bitable and render it into markdown/json files."""
    app_id = _env("ANTITAO_FEISHU_APP_ID")
    app_secret = _env("ANTITAO_FEISHU_APP_SECRET")
    app_token = _resolve_app_token()

    if not app_id or not app_secret or not app_token:
        raise FeishuBitableSyncError(
            "Missing Feishu bitable config. Set ANTITAO_FEISHU_APP_ID, "
            "ANTITAO_FEISHU_APP_SECRET, and ANTITAO_FEISHU_APP_TOKEN "
            "(or ANTITAO_FEISHU_BASE_LINK)."
        )

    export_dir = _resolve_export_dir(project_root)
    export_dir.mkdir(parents=True, exist_ok=True)

    client = _FeishuBitableClient(
        app_id=app_id,
        app_secret=app_secret,
        app_token=app_token,
        open_api_root=_env("ANTITAO_FEISHU_OPEN_API_ROOT", DEFAULT_FEISHU_OPEN_API_ROOT),
    )

    tables = client.list_tables()
    synced_at = datetime.now(timezone.utc).astimezone().isoformat()
    total_records = 0
    manifest_tables: list[dict[str, Any]] = []

    for index, table in enumerate(tables, start=1):
        table_id = str(table.get("table_id", "")).strip()
        table_name = str(table.get("name", "")).strip() or f"Table {index}"
        records = client.list_records(table_id)
        total_records += len(records)

        markdown_path = export_dir / f"table_{index:02d}_{table_id}.md"
        json_path = export_dir / f"table_{index:02d}_{table_id}.json"

        _write_text_if_changed(
            markdown_path,
            _render_table_markdown(table_name, table_id, records),
        )
        _write_text_if_changed(
            json_path,
            json.dumps(
                {
                    "table_name": table_name,
                    "table_id": table_id,
                    "synced_at": synced_at,
                    "record_count": len(records),
                    "records": records,
                },
                indent=2,
                ensure_ascii=False,
            ),
        )

        manifest_tables.append(
            {
                "index": index,
                "name": table_name,
                "table_id": table_id,
                "record_count": len(records),
                "markdown_file": markdown_path.name,
                "json_file": json_path.name,
            }
        )

    _write_text_if_changed(
        export_dir / "README.md",
        _render_export_readme(
            manifest_tables=manifest_tables,
            app_token=app_token,
            base_link=_env("ANTITAO_FEISHU_BASE_LINK"),
        ),
    )
    _write_text_if_changed(
        export_dir / "manifest.json",
        json.dumps(
            {
                "synced_at": synced_at,
                "app_token": app_token,
                "table_count": len(manifest_tables),
                "record_count": total_records,
                "tables": manifest_tables,
            },
            indent=2,
            ensure_ascii=False,
        ),
    )

    logger.info(
        f"Synced Feishu bitable snapshot to '{export_dir}' "
        f"({len(manifest_tables)} tables, {total_records} records)"
    )

    return FeishuBitableSyncSummary(
        export_dir=export_dir,
        table_count=len(manifest_tables),
        record_count=total_records,
        synced_at=synced_at,
    )


class _FeishuBitableClient:
    def __init__(
        self,
        app_id: str,
        app_secret: str,
        app_token: str,
        open_api_root: str,
    ):
        self.app_id = app_id
        self.app_secret = app_secret
        self.app_token = app_token
        self.open_api_root = open_api_root.rstrip("/")
        self.session = requests.Session()
        self._tenant_access_token: str | None = None

    def list_tables(self) -> list[dict[str, Any]]:
        payload = self._request(
            "GET",
            f"/open-apis/bitable/v1/apps/{self.app_token}/tables",
            params={"page_size": 100},
        )
        return list(payload.get("items") or [])

    def list_records(self, table_id: str) -> list[dict[str, Any]]:
        page_token = ""
        items: list[dict[str, Any]] = []
        while True:
            params: dict[str, Any] = {"page_size": 500}
            if page_token:
                params["page_token"] = page_token
            payload = self._request(
                "GET",
                f"/open-apis/bitable/v1/apps/{self.app_token}/tables/{table_id}/records",
                params=params,
            )
            items.extend(list(payload.get("items") or []))
            if not payload.get("has_more"):
                break
            page_token = str(payload.get("page_token", "")).strip()
            if not page_token:
                break
        return items

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        response = self.session.request(
            method=method,
            url=f"{self.open_api_root}{path}",
            headers=self._auth_headers(),
            params=params,
            json=json_body,
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("code") not in (0, "0", None):
            raise FeishuBitableSyncError(
                f"Feishu API returned code={payload.get('code')}, msg={payload.get('msg')}"
            )
        return payload.get("data") or {}

    def _auth_headers(self) -> dict[str, str]:
        if self._tenant_access_token is None:
            response = self.session.post(
                f"{self.open_api_root}/open-apis/auth/v3/tenant_access_token/internal",
                json={"app_id": self.app_id, "app_secret": self.app_secret},
                timeout=30,
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("code") not in (0, "0"):
                raise FeishuBitableSyncError(
                    f"Feishu auth failed: code={payload.get('code')}, msg={payload.get('msg')}"
                )
            self._tenant_access_token = str(payload.get("tenant_access_token", "")).strip()
            if not self._tenant_access_token:
                raise FeishuBitableSyncError("Feishu auth succeeded but no tenant access token returned")
        return {"Authorization": f"Bearer {self._tenant_access_token}"}


def _resolve_export_dir(project_root: Path) -> Path:
    raw_value = _env("ANTITAO_FEISHU_EXPORT_PATH")
    if raw_value:
        return Path(raw_value).expanduser().resolve()
    return (project_root / DEFAULT_FEISHU_EXPORT_DIR).resolve()


def _resolve_app_token() -> str:
    app_token = _env("ANTITAO_FEISHU_APP_TOKEN")
    if app_token:
        return app_token
    return _extract_app_token_from_url(_env("ANTITAO_FEISHU_BASE_LINK"))


def _env(key: str, default: str = "") -> str:
    return get_env_store().get(key, default).strip()


def _extract_app_token_from_url(url: str) -> str:
    if not url:
        return ""
    if re.fullmatch(r"[A-Za-z0-9]{20,}", url):
        return url
    try:
        parsed = urlparse(url)
    except Exception:
        return ""
    match = re.search(r"/base/([A-Za-z0-9]+)", parsed.path)
    if match:
        return match.group(1)
    return ""


def _render_export_readme(
    manifest_tables: list[dict[str, Any]],
    app_token: str,
    base_link: str,
) -> str:
    lines = [
        "# AntiTao Feishu Bitable Snapshot",
        "",
        "This directory is auto-generated from Feishu Bitable and is safe to re-sync.",
        "",
        f"- App token: `{app_token}`",
    ]
    if base_link:
        lines.append(f"- Source link: {base_link}")
    lines.extend(["", "## Tables", ""])
    for table in manifest_tables:
        lines.append(
            f"- {table['name']} ({table['record_count']} records) -> `{table['markdown_file']}`"
        )
    lines.append("")
    return "\n".join(lines)


def _render_table_markdown(
    table_name: str,
    table_id: str,
    records: list[dict[str, Any]],
) -> str:
    lines = [
        f"# {table_name}",
        "",
        f"- Table ID: `{table_id}`",
        f"- Record count: {len(records)}",
        "",
    ]
    if not records:
        lines.extend(["No records found.", ""])
        return "\n".join(lines)

    for index, record in enumerate(records, start=1):
        fields = dict(record.get("fields") or {})
        title = _pick_record_title(fields, str(record.get("record_id") or record.get("id") or index))
        lines.append(f"## {index}. {title}")
        lines.append(f"- Record ID: `{record.get('record_id') or record.get('id') or ''}`")
        for field_name, field_value in fields.items():
            rendered = _render_field_value(field_value)
            if not rendered:
                continue
            lines.append(f"- {field_name}: {rendered}")
        lines.append("")
    return "\n".join(lines)


def _pick_record_title(fields: dict[str, Any], fallback: str) -> str:
    preferred_keywords = (
        "名称",
        "名字",
        "title",
        "name",
        "网站",
        "工具",
        "达人",
        "渠道",
        "平台",
    )
    for keyword in preferred_keywords:
        for key, value in fields.items():
            rendered = _render_field_value(value)
            if not rendered:
                continue
            lowered = key.lower()
            if keyword in key or keyword in lowered:
                return _truncate_single_line(rendered)
    for value in fields.values():
        rendered = _render_field_value(value)
        if rendered:
            return _truncate_single_line(rendered)
    return fallback


def _truncate_single_line(value: str, limit: int = 90) -> str:
    one_line = " ".join(value.split())
    if len(one_line) <= limit:
        return one_line
    return one_line[: limit - 1].rstrip() + "…"


def _render_field_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if _looks_like_feishu_timestamp(value):
            return datetime.fromtimestamp(float(value) / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    if isinstance(value, dict):
        if value.get("link"):
            text = str(value.get("text") or value["link"]).strip()
            link = str(value["link"]).strip()
            return f"{text} ({link})"
        if value.get("text_arr"):
            return ", ".join(str(part).strip() for part in value.get("text_arr") or [] if str(part).strip())
        if value.get("text"):
            return str(value.get("text")).strip()
        if value.get("record_ids"):
            record_text = str(value.get("text") or "").strip()
            if record_text:
                return record_text
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    if isinstance(value, list):
        parts = [_render_field_value(item) for item in value]
        clean_parts = [part for part in parts if part]
        return " | ".join(clean_parts)
    return str(value).strip()


def _looks_like_feishu_timestamp(value: int | float) -> bool:
    return 10**11 <= float(value) <= 10**13


def _write_text_if_changed(path: Path, content: str) -> bool:
    if path.exists():
        try:
            if path.read_text(encoding="utf-8") == content:
                return False
        except Exception:
            pass
    path.write_text(content, encoding="utf-8")
    return True

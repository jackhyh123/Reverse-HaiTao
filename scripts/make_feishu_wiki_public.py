"""Make AntiTao Feishu Wiki docx pages readable by anyone with the link.

By default this script is a dry run. Pass ``--apply`` to actually update
Feishu cloud document permissions.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
import sys
import time
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from deeptutor.services.config import get_env_store
from deeptutor.services.path_service import get_path_service
from deeptutor.services.feishu_wiki_sync import (
    DEFAULT_FEISHU_WIKI_ORIGIN,
    DEFAULT_ROOT_NODE_TOKEN,
)
from scripts.publish_feishu_wiki_seed import FeishuWikiClient, WikiNode


REPORT_FILE = get_path_service().get_settings_file("antitao_feishu_wiki_public_report")


@dataclass(slots=True)
class PublicTarget:
    title: str
    node_token: str
    obj_token: str
    obj_type: str
    url: str
    depth: int


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Set AntiTao Feishu Wiki docx pages to internet-readable links."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually update Feishu permissions. Without this flag, only prints a preview.",
    )
    parser.add_argument(
        "--root-node-token",
        default=_env("ANTITAO_FEISHU_WIKI_ROOT_NODE_TOKEN", DEFAULT_ROOT_NODE_TOKEN),
        help="Feishu Wiki root node token.",
    )
    args = parser.parse_args()

    client = FeishuWikiClient(
        app_id=_env_required("ANTITAO_FEISHU_APP_ID"),
        app_secret=_env_required("ANTITAO_FEISHU_APP_SECRET"),
        open_api_root=_env("ANTITAO_FEISHU_OPEN_API_ROOT", "https://open.feishu.cn"),
    )

    targets = list_wiki_docx_targets(client, args.root_node_token)
    results: list[dict[str, Any]] = []

    for index, target in enumerate(targets, start=1):
        result: dict[str, Any] = {
            **asdict(target),
            "status": "preview",
            "permission": None,
            "error": None,
        }
        if args.apply:
            try:
                result["permission"] = set_docx_internet_readable(client, target.obj_token)
                result["status"] = "updated"
                time.sleep(0.18)
            except Exception as exc:  # noqa: BLE001 - CLI report should keep going.
                result["status"] = "failed"
                result["error"] = str(exc)
        results.append(result)
        prefix = "更新" if args.apply else "预览"
        print(f"[{index:02d}/{len(targets):02d}] {prefix}: {target.title} -> {target.url}")

    report = {
        "mode": "apply" if args.apply else "preview",
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "root_node_token": args.root_node_token,
        "target_count": len(targets),
        "updated_count": sum(1 for item in results if item["status"] == "updated"),
        "failed_count": sum(1 for item in results if item["status"] == "failed"),
        "targets": results,
    }
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"报告已写入: {REPORT_FILE}")


def list_wiki_docx_targets(client: FeishuWikiClient, root_node_token: str) -> list[PublicTarget]:
    root_payload = client._request(
        "GET",
        "/open-apis/wiki/v2/spaces/get_node",
        params={"token": root_node_token},
    )["node"]
    space_id = str(root_payload["space_id"])
    root = client._node_from_payload(root_payload)

    targets: list[PublicTarget] = []
    seen: set[str] = set()

    def visit(node: WikiNode, depth: int) -> None:
        if node.node_token in seen:
            return
        seen.add(node.node_token)
        if node.obj_type == "docx" and node.obj_token:
            targets.append(
                PublicTarget(
                    title=node.title,
                    node_token=node.node_token,
                    obj_token=node.obj_token,
                    obj_type=node.obj_type,
                    url=f"{_feishu_origin()}/wiki/{node.node_token}",
                    depth=depth,
                )
            )
        if not node.has_child:
            return
        for child in client.list_children(space_id, node.node_token):
            visit(child, depth + 1)

    visit(root, 0)
    return targets


def set_docx_internet_readable(client: FeishuWikiClient, document_token: str) -> dict[str, Any]:
    data = client._request(
        "PATCH",
        f"/open-apis/drive/v1/permissions/{document_token}/public",
        params={"type": "docx"},
        json_body={
            "external_access": True,
            "security_entity": "anyone_can_view",
            "comment_entity": "anyone_can_view",
            "share_entity": "same_tenant",
            "link_share_entity": "anyone_readable",
            "invite_external": True,
        },
    )
    return dict(data.get("permission_public") or {})


def _env_required(key: str) -> str:
    value = _env(key)
    if not value:
        raise RuntimeError(f"Missing {key}")
    return value


def _env(key: str, default: str = "") -> str:
    return get_env_store().get(key, default).strip()


def _feishu_origin() -> str:
    return _env("ANTITAO_FEISHU_WIKI_ORIGIN", DEFAULT_FEISHU_WIKI_ORIGIN).rstrip("/")


if __name__ == "__main__":
    main()

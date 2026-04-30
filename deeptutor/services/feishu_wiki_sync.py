"""Sync the local AntiTao wiki into Feishu Wiki and suggest graph resources."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from typing import Any

from deeptutor.services.config import get_env_store
from deeptutor.services.path_service import get_path_service
from deeptutor.services.settings.antitao_knowledge_graph import load_antitao_knowledge_graph
from scripts.prepare_feishu_wiki_seed import DEFAULT_WIKI_ROOT, PAGES, write_seed
from scripts.publish_feishu_wiki_seed import FeishuWikiClient


DEFAULT_SEED_DIR = Path("data/feishu_wiki_seed")
DEFAULT_ROOT_NODE_TOKEN = "RmmJwBcJjiM4mzks2z2cjyQvnFc"
DEFAULT_FEISHU_WIKI_ORIGIN = "https://xcn8pgdlg8x0.feishu.cn"
REPORT_FILE = get_path_service().get_settings_file("antitao_feishu_wiki_sync_report")


class FeishuWikiSyncError(RuntimeError):
    pass


@dataclass(slots=True)
class PublishedPage:
    title: str
    section: str
    node_token: str
    obj_token: str
    url: str
    source_path: str | None
    status: str


def get_sync_status() -> dict[str, Any]:
    wiki_root = _wiki_root()
    seed_dir = _seed_dir()
    files = sorted(p for p in wiki_root.rglob("*.md")) if wiki_root.exists() else []
    report = _read_report()
    return {
        "configured": _has_config(),
        "wiki_root": str(wiki_root),
        "wiki_file_count": len(files),
        "seed_dir": str(seed_dir),
        "seed_page_count": len(list(seed_dir.rglob("*.md"))) if seed_dir.exists() else 0,
        "root_node_token": _root_node_token(),
        "last_report": report,
    }


def sync_local_wiki_to_feishu() -> dict[str, Any]:
    if not _has_config():
        raise FeishuWikiSyncError(
            "缺少飞书配置：需要 ANTITAO_FEISHU_APP_ID 和 ANTITAO_FEISHU_APP_SECRET"
        )

    wiki_root = _wiki_root()
    seed_dir = _seed_dir()
    write_seed(wiki_root, seed_dir)

    client = FeishuWikiClient(
        app_id=_env("ANTITAO_FEISHU_APP_ID"),
        app_secret=_env("ANTITAO_FEISHU_APP_SECRET"),
        open_api_root=_env("ANTITAO_FEISHU_OPEN_API_ROOT", "https://open.feishu.cn"),
    )
    root = client.get_node(_root_node_token())
    root_data = client._request(
        "GET",
        "/open-apis/wiki/v2/spaces/get_node",
        params={"token": root.node_token},
    )["node"]
    space_id = str(root_data["space_id"])

    source_by_title = {page.title: page.source for page in PAGES}
    created: list[PublishedPage] = []
    rewritten: list[PublishedPage] = []

    for section_dir in sorted(path for path in seed_dir.iterdir() if path.is_dir()):
        section_node = client.ensure_child_docx(space_id, root.node_token, section_dir.name)
        for page_path in sorted(section_dir.glob("*.md")):
            title = page_path.stem
            page_node = client.ensure_child_docx(space_id, section_node.node_token, title)
            url = f"{_feishu_origin()}/wiki/{page_node.node_token}"
            existed = bool(client.list_document_children(page_node.obj_token))
            page = PublishedPage(
                title=title,
                section=section_dir.name,
                node_token=page_node.node_token,
                obj_token=page_node.obj_token,
                url=url,
                source_path=source_by_title.get(title),
                status="existing" if existed else "created",
            )
            content = page_path.read_text(encoding="utf-8")
            client.write_markdown_as_docx(page_node.obj_token, content, replace=True)
            if existed:
                page.status = "rewritten"
                rewritten.append(page)
            else:
                created.append(page)

    pages = created + rewritten
    suggestions = suggest_graph_resource_links(pages, seed_dir)
    report = {
        "synced_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "root": {
            "title": root.title,
            "node_token": root.node_token,
            "url": f"{_feishu_origin()}/wiki/{root.node_token}",
        },
        "created_count": len(created),
        "existing_count": len(rewritten),
        "rewritten_count": len(rewritten),
        "pages": [asdict(page) for page in pages],
        "suggestions": suggestions,
    }
    _write_report(report)
    return report


def suggest_graph_resource_links(
    pages: list[PublishedPage],
    seed_dir: Path | None = None,
) -> list[dict[str, Any]]:
    graph = load_antitao_knowledge_graph()
    nodes = graph.get("nodes", [])
    seed_dir = seed_dir or _seed_dir()
    suggestions: list[dict[str, Any]] = []
    for page in pages:
        content = _read_seed_page(seed_dir, page.section, page.title)
        ranked = sorted(
            ((_score_page_for_node(page, content, node), node) for node in nodes),
            key=lambda item: item[0],
            reverse=True,
        )
        matches = [
            {
                "node_id": node.get("id"),
                "node_title": node.get("title", {}).get("zh") or node.get("id"),
                "score": score,
                "reason": _suggestion_reason(page, node),
            }
            for score, node in ranked
            if score >= 10
        ][:3]
        if not matches:
            continue
        suggestions.append(
            {
                "page_title": page.title,
                "section": page.section,
                "url": page.url,
                "source_path": page.source_path,
                "matches": matches,
            }
        )
    return suggestions


def _score_page_for_node(page: PublishedPage, content: str, node: dict[str, Any]) -> int:
    node_title = node.get("title", {}).get("zh", "")
    node_summary = node.get("summary", {}).get("zh", "")
    node_tags = " ".join(str(tag) for tag in node.get("tags", []))
    node_blob = f"{node_title} {node_summary} {node_tags}"
    page_blob = f"{page.section} {page.title} {page.source_path or ''} {content[:2500]}"

    score = 0
    if node_title and node_title in page_blob:
        score += 30
    for token in _tokens(node_blob):
        if len(token) >= 2 and token in page_blob:
            score += 2

    section = page.section
    track_ids = set(node.get("track_ids") or [])
    tags = set(str(tag) for tag in node.get("tags", []))
    if "基础概念" in section and ({"foundation", "concept"} & tags):
        score += 12
    if "用户购买流程" in section and ({"funnel", "conversion", "fulfillment"} & tags):
        score += 14
    if "新手卖家" in section and "seller" in track_ids:
        score += 10
    if "平台运营" in section and "operator" in track_ids:
        score += 10
    if "增长" in section and ({"traffic", "creator", "discovery"} & tags):
        score += 14
    if "财务" in section and ({"finance", "metrics", "decision"} & tags):
        score += 14
    if "案例库" in section and ("case" in tags or "platforms" in tags):
        score += 10
    return min(score, 100)


def _suggestion_reason(page: PublishedPage, node: dict[str, Any]) -> str:
    return f"页面属于「{page.section}」，内容与节点「{node.get('title', {}).get('zh') or node.get('id')}」的学习目标接近。"


def _tokens(text: str) -> set[str]:
    words = set(re.findall(r"[A-Za-z0-9_]{3,}|[\u4e00-\u9fff]{2,}", text))
    chinese = "".join(re.findall(r"[\u4e00-\u9fff]", text))
    for index in range(max(0, len(chinese) - 1)):
        words.add(chinese[index : index + 2])
    return words


def _read_seed_page(seed_dir: Path, section: str, title: str) -> str:
    path = seed_dir / section / f"{title}.md"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def _read_report() -> dict[str, Any] | None:
    if not REPORT_FILE.exists():
        return None
    try:
        return json.loads(REPORT_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None


def _write_report(report: dict[str, Any]) -> None:
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def _has_config() -> bool:
    return bool(_env("ANTITAO_FEISHU_APP_ID") and _env("ANTITAO_FEISHU_APP_SECRET"))


def _wiki_root() -> Path:
    return Path(_env("ANTITAO_LOCAL_WIKI_ROOT", str(DEFAULT_WIKI_ROOT))).expanduser()


def _seed_dir() -> Path:
    return Path(_env("ANTITAO_FEISHU_WIKI_SEED_DIR", str(DEFAULT_SEED_DIR))).expanduser()


def _root_node_token() -> str:
    return _env("ANTITAO_FEISHU_WIKI_ROOT_NODE_TOKEN", DEFAULT_ROOT_NODE_TOKEN)


def _feishu_origin() -> str:
    return _env("ANTITAO_FEISHU_WIKI_ORIGIN", DEFAULT_FEISHU_WIKI_ORIGIN).rstrip("/")


def _env(key: str, default: str = "") -> str:
    return get_env_store().get(key, default).strip()

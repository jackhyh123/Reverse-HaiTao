"""Publish the generated AntiTao wiki seed package to Feishu Wiki.

The script expects `scripts/prepare_feishu_wiki_seed.py` to have generated
`data/feishu_wiki_seed` first. It creates a two-level Feishu Wiki tree:

root wiki node
  -> section pages
       -> content pages

Credentials are read from environment variables so secrets are not stored in
the repository.
"""

from __future__ import annotations

import argparse
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


DEFAULT_OPEN_API_ROOT = "https://open.feishu.cn"
DEFAULT_SEED_DIR = Path("data/feishu_wiki_seed")


class FeishuPublishError(RuntimeError):
    pass


@dataclass(slots=True)
class WikiNode:
    title: str
    node_token: str
    obj_token: str
    obj_type: str
    has_child: bool


class FeishuWikiClient:
    def __init__(self, app_id: str, app_secret: str, open_api_root: str = DEFAULT_OPEN_API_ROOT):
        self.app_id = app_id
        self.app_secret = app_secret
        self.open_api_root = open_api_root.rstrip("/")
        self.session = requests.Session()
        self._tenant_access_token: str | None = None

    def get_node(self, node_token: str) -> WikiNode:
        data = self._request(
            "GET",
            "/open-apis/wiki/v2/spaces/get_node",
            params={"token": node_token},
        )
        return self._node_from_payload(data["node"])

    def list_children(self, space_id: str, parent_node_token: str) -> list[WikiNode]:
        page_token = ""
        nodes: list[WikiNode] = []
        while True:
            params: dict[str, Any] = {
                "parent_node_token": parent_node_token,
                "page_size": 50,
            }
            if page_token:
                params["page_token"] = page_token
            data = self._request(
                "GET",
                f"/open-apis/wiki/v2/spaces/{space_id}/nodes",
                params=params,
            )
            nodes.extend(self._node_from_payload(item) for item in data.get("items", []))
            if not data.get("has_more"):
                break
            page_token = str(data.get("page_token") or "")
            if not page_token:
                break
        return nodes

    def create_docx_node(self, space_id: str, parent_node_token: str, title: str) -> WikiNode:
        data = self._request(
            "POST",
            f"/open-apis/wiki/v2/spaces/{space_id}/nodes",
            json_body={
                "parent_node_token": parent_node_token,
                "node_type": "origin",
                "obj_type": "docx",
                "title": title,
            },
        )
        return self._node_from_payload(data["node"])

    def ensure_child_docx(self, space_id: str, parent_node_token: str, title: str) -> WikiNode:
        children = self.list_children(space_id, parent_node_token)
        for child in children:
            if child.title == title:
                return child
        time.sleep(0.15)
        return self.create_docx_node(space_id, parent_node_token, title)

    def list_document_children(self, document_id: str) -> list[dict[str, Any]]:
        data = self._request(
            "GET",
            f"/open-apis/docx/v1/documents/{document_id}/blocks/{document_id}/children",
        )
        return list(data.get("items") or [])

    def clear_document_children(self, document_id: str) -> int:
        children = self.list_document_children(document_id)
        if not children:
            return 0
        self._request(
            "DELETE",
            f"/open-apis/docx/v1/documents/{document_id}/blocks/{document_id}/children/batch_delete",
            json_body={
                "start_index": 0,
                "end_index": len(children),
            },
        )
        time.sleep(0.35)
        return len(children)

    def write_markdown_as_docx(self, document_id: str, markdown: str, replace: bool = True) -> int:
        if replace:
            self.clear_document_children(document_id)
        blocks = _markdown_to_docx_blocks(markdown)
        count = 0
        for batch in _chunked(blocks, 35):
            self._request(
                "POST",
                f"/open-apis/docx/v1/documents/{document_id}/blocks/{document_id}/children",
                json_body={"children": batch},
            )
            count += len(batch)
            time.sleep(0.35)
        return count

    def append_markdown_as_paragraphs(self, document_id: str, markdown: str) -> int:
        paragraphs = _markdown_to_readable_paragraphs(markdown)
        count = 0
        for batch in _chunked(paragraphs, 40):
            children = [
                {
                    "block_type": 2,
                    "text": {
                        "elements": [
                            {
                                "text_run": {
                                    "content": paragraph,
                                }
                            }
                        ],
                        "style": {},
                    },
                }
                for paragraph in batch
            ]
            self._request(
                "POST",
                f"/open-apis/docx/v1/documents/{document_id}/blocks/{document_id}/children",
                json_body={"children": children},
            )
            count += len(children)
            time.sleep(0.2)
        return count

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
        if payload.get("code") not in (0, "0"):
            raise FeishuPublishError(
                f"Feishu API failed: code={payload.get('code')}, msg={payload.get('msg')}"
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
                raise FeishuPublishError(
                    f"Feishu auth failed: code={payload.get('code')}, msg={payload.get('msg')}"
                )
            self._tenant_access_token = str(payload.get("tenant_access_token") or "").strip()
            if not self._tenant_access_token:
                raise FeishuPublishError("Feishu auth succeeded but no tenant access token returned")
        return {
            "Authorization": f"Bearer {self._tenant_access_token}",
            "Content-Type": "application/json; charset=utf-8",
        }

    @staticmethod
    def _node_from_payload(payload: dict[str, Any]) -> WikiNode:
        return WikiNode(
            title=str(payload.get("title") or ""),
            node_token=str(payload.get("node_token") or ""),
            obj_token=str(payload.get("obj_token") or ""),
            obj_type=str(payload.get("obj_type") or ""),
            has_child=bool(payload.get("has_child")),
        )


def _markdown_to_docx_blocks(markdown: str) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    lines = markdown.splitlines()
    index = 0
    in_code = False
    code_lines: list[str] = []

    while index < len(lines):
        raw_line = lines[index].rstrip()
        line = raw_line.strip()

        if line.startswith("```"):
            if in_code:
                code = "\n".join(code_lines).strip()
                if code:
                    blocks.append(_text_block(14, code))
                code_lines.clear()
                in_code = False
            else:
                in_code = True
            index += 1
            continue

        if in_code:
            code_lines.append(raw_line)
            index += 1
            continue

        if not line:
            index += 1
            continue

        if _is_markdown_table_row(line):
            table_rows: list[str] = []
            while index < len(lines) and _is_markdown_table_row(lines[index].strip()):
                table_rows.append(lines[index].strip())
                index += 1
            blocks.extend(_table_rows_to_blocks(table_rows))
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            level = min(len(heading.group(1)), 6)
            blocks.append(_text_block(2 + level, _clean_inline_markdown(heading.group(2))))
            index += 1
            continue

        if line in {"---", "***", "___"}:
            blocks.append({"block_type": 22, "divider": {}})
            index += 1
            continue

        quote = re.match(r"^>\s*(.+)$", line)
        if quote:
            blocks.append(_text_block(15, _clean_inline_markdown(quote.group(1))))
            index += 1
            continue

        bullet = re.match(r"^[-*+]\s+(.+)$", line)
        if bullet:
            blocks.append(_text_block(12, _clean_inline_markdown(bullet.group(1))))
            index += 1
            continue

        ordered = re.match(r"^\d+[.)]\s+(.+)$", line)
        if ordered:
            blocks.append(_text_block(13, _clean_inline_markdown(ordered.group(1))))
            index += 1
            continue

        todo = re.match(r"^- \[( |x|X)\]\s+(.+)$", line)
        if todo:
            blocks.append(
                {
                    "block_type": 17,
                    "todo": {
                        "elements": _text_elements(_clean_inline_markdown(todo.group(2))),
                        "style": {},
                    },
                }
            )
            index += 1
            continue

        paragraph_lines = [line]
        index += 1
        while index < len(lines):
            lookahead = lines[index].strip()
            if (
                not lookahead
                or lookahead.startswith("```")
                or re.match(r"^(#{1,6})\s+", lookahead)
                or re.match(r"^[-*+]\s+", lookahead)
                or re.match(r"^\d+[.)]\s+", lookahead)
                or re.match(r"^>\s+", lookahead)
                or _is_markdown_table_row(lookahead)
                or lookahead in {"---", "***", "___"}
            ):
                break
            paragraph_lines.append(lookahead)
            index += 1
        paragraph = _clean_inline_markdown(" ".join(paragraph_lines))
        for part in _split_long_paragraph(paragraph, limit=1500):
            blocks.append(_text_block(2, part))

    if code_lines:
        blocks.append(_text_block(14, "\n".join(code_lines).strip()))
    return blocks


def _text_block(block_type: int, content: str) -> dict[str, Any]:
    field = {
        2: "text",
        3: "heading1",
        4: "heading2",
        5: "heading3",
        6: "heading4",
        7: "heading5",
        8: "heading6",
        12: "bullet",
        13: "ordered",
        14: "code",
        15: "quote",
    }.get(block_type, "text")
    payload: dict[str, Any] = {
        "block_type": block_type,
        field: {
            "elements": _text_elements(content),
            "style": {},
        },
    }
    if block_type == 14:
        payload[field]["language"] = 1
    return payload


def _text_elements(content: str) -> list[dict[str, Any]]:
    return [
        {
            "text_run": {
                "content": content,
                "text_element_style": {},
            }
        }
    ]


def _is_markdown_table_row(line: str) -> bool:
    return line.startswith("|") and line.endswith("|") and line.count("|") >= 2


def _table_rows_to_blocks(rows: list[str]) -> list[dict[str, Any]]:
    parsed = [
        [cell.strip() for cell in row.strip("|").split("|")]
        for row in rows
        if not re.fullmatch(r"\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?", row)
    ]
    if not parsed:
        return []
    headers = parsed[0]
    body = parsed[1:]
    blocks: list[dict[str, Any]] = []
    for row in body:
        pairs = []
        for idx, value in enumerate(row):
            key = headers[idx] if idx < len(headers) else f"字段{idx + 1}"
            pairs.append(f"{key}：{value}")
        blocks.append(_text_block(12, _clean_inline_markdown("；".join(pairs))))
    if not body:
        blocks.append(_text_block(2, _clean_inline_markdown("；".join(headers))))
    return blocks


def _clean_inline_markdown(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1（\2）", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    text = text.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    return text.strip()


def _markdown_to_readable_paragraphs(markdown: str) -> list[str]:
    paragraphs: list[str] = []
    current: list[str] = []

    def flush() -> None:
        if not current:
            return
        paragraph = "\n".join(current).strip()
        current.clear()
        if not paragraph:
            return
        paragraphs.extend(_split_long_paragraph(paragraph))

    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        if not line:
            flush()
            continue
        if re.match(r"^#{1,6}\s+", line):
            flush()
            paragraphs.append(line)
            continue
        if line.startswith("|"):
            flush()
            paragraphs.append(line)
            continue
        current.append(line)
    flush()
    return paragraphs


def _split_long_paragraph(paragraph: str, limit: int = 1500) -> list[str]:
    if len(paragraph) <= limit:
        return [paragraph]
    parts: list[str] = []
    start = 0
    while start < len(paragraph):
        parts.append(paragraph[start : start + limit])
        start += limit
    return parts


def _chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def publish(seed_dir: Path, root_node_token: str, overwrite: bool = False) -> None:
    app_id = os.environ.get("ANTITAO_FEISHU_APP_ID", "").strip()
    app_secret = os.environ.get("ANTITAO_FEISHU_APP_SECRET", "").strip()
    if not app_id or not app_secret:
        raise FeishuPublishError("Missing ANTITAO_FEISHU_APP_ID or ANTITAO_FEISHU_APP_SECRET")

    client = FeishuWikiClient(
        app_id=app_id,
        app_secret=app_secret,
        open_api_root=os.environ.get("ANTITAO_FEISHU_OPEN_API_ROOT", DEFAULT_OPEN_API_ROOT),
    )
    root = client.get_node(root_node_token)
    root_data = client._request(
        "GET",
        "/open-apis/wiki/v2/spaces/get_node",
        params={"token": root_node_token},
    )["node"]
    space_id = str(root_data["space_id"])

    section_dirs = [path for path in sorted(seed_dir.iterdir()) if path.is_dir()]
    print(f"Publishing {len(section_dirs)} sections into Feishu space {space_id} under {root.title}")

    for section_dir in section_dirs:
        section_node = client.ensure_child_docx(space_id, root.node_token, section_dir.name)
        print(f"section: {section_dir.name}")

        for page_path in sorted(section_dir.glob("*.md")):
            title = page_path.stem
            page_node = client.ensure_child_docx(space_id, section_node.node_token, title)
            existing_children = client.list_document_children(page_node.obj_token)
            if existing_children and not overwrite:
                print(f"  skip existing: {title}")
                continue
            content = page_path.read_text(encoding="utf-8")
            block_count = client.write_markdown_as_docx(
                page_node.obj_token,
                content,
                replace=overwrite,
            )
            print(f"  wrote: {title} ({block_count} blocks)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish generated seed pages to Feishu Wiki.")
    parser.add_argument("--seed-dir", type=Path, default=DEFAULT_SEED_DIR)
    parser.add_argument("--root-node-token", required=True)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Append content even when the target page already has children. This does not delete old content.",
    )
    args = parser.parse_args()
    publish(args.seed_dir, args.root_node_token, overwrite=args.overwrite)


if __name__ == "__main__":
    main()

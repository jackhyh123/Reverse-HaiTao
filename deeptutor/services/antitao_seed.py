from __future__ import annotations

from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil

from deeptutor.knowledge.add_documents import DocumentAdder
from deeptutor.knowledge.initializer import KnowledgeBaseInitializer
from deeptutor.knowledge.manager import KnowledgeBaseManager
from deeptutor.logging import get_logger
from deeptutor.services.feishu_bitable_sync import (
    has_antitao_feishu_config,
    sync_antitao_feishu_bitable_snapshot,
)
from deeptutor.services.path_service import get_path_service
from deeptutor.services.rag.file_routing import FileTypeRouter

logger = get_logger("antitao.seed")

ANTITAO_KB_NAME = "antitao-core"
ANTITAO_ALLOWED_EXTENSIONS = {".md", ".txt"}
ANTITAO_IGNORED_DIR_NAMES = {
    ".obsidian",
    ".git",
    "node_modules",
}
ANTITAO_IGNORED_FILE_NAMES = {
    "workspace.json",
    "workspace-mobile.json",
    "workspaces.json",
    "app.json",
    "appearance.json",
    "graph.json",
    "hotkeys.json",
    "backlink.json",
    "community-plugins.json",
    "core-plugins.json",
    "core-plugins-migration.json",
}


def _discover_obsidian_candidates() -> list[Path]:
    env_path = os.getenv("ANTITAO_OBSIDIAN_PATH", "").strip()
    candidates = [
        Path(env_path).expanduser() if env_path else None,
        Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/HYH的跨境生涯",
        Path.home()
        / "Library/Mobile Documents/iCloud~md~obsidian/Documents/HYH的跨境生涯",
        Path.home() / "Documents/Obsidian Vault",
    ]
    found: list[Path] = []
    for candidate in candidates:
        if candidate is None:
            continue
        try:
            resolved = candidate.expanduser().resolve()
        except Exception:
            continue
        if resolved.exists() and resolved.is_dir():
            found.append(resolved)
    # Preserve order while removing duplicates.
    unique: list[Path] = []
    seen: set[str] = set()
    for path in found:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    return unique


def _discover_feishu_export_candidates() -> list[Path]:
    env_path = os.getenv("ANTITAO_FEISHU_EXPORT_PATH", "").strip()
    if not env_path:
        return []
    try:
        resolved = Path(env_path).expanduser().resolve()
    except Exception:
        return []
    if resolved.exists() and resolved.is_dir():
        return [resolved]
    return []


def _discover_feishu_direct_snapshot(project_root: Path) -> list[Path]:
    if not has_antitao_feishu_config():
        return []
    try:
        summary = sync_antitao_feishu_bitable_snapshot(project_root)
        logger.info(
            f"Prepared Feishu bitable snapshot: {summary.table_count} tables, "
            f"{summary.record_count} records"
        )
        return [summary.export_dir]
    except Exception as exc:
        logger.warning(f"Failed to refresh Feishu bitable snapshot: {exc}")
        return []


def _dedupe_paths(paths: list[Path]) -> list[Path]:
    unique: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        if not path.exists() or not path.is_dir():
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        unique.append(path.resolve())
    return unique


def _is_relevant_antitao_file(path: Path) -> bool:
    try:
        resolved = path.resolve()
    except Exception:
        return False

    if not resolved.exists() or not resolved.is_file():
        return False

    if resolved.suffix.lower() not in ANTITAO_ALLOWED_EXTENSIONS:
        return False

    parts = {part.lower() for part in resolved.parts}
    if parts & ANTITAO_IGNORED_DIR_NAMES:
        return False

    if resolved.name.lower() in ANTITAO_IGNORED_FILE_NAMES:
        return False

    return True


def _heal_antitao_status_if_index_ready(manager: KnowledgeBaseManager, kb_dir: Path) -> None:
    if not _kb_has_index(kb_dir):
        return

    kb_entry = manager.config.get("knowledge_bases", {}).get(ANTITAO_KB_NAME, {})
    if kb_entry.get("status") == "ready":
        return

    manager.update_kb_status(
        name=ANTITAO_KB_NAME,
        status="ready",
        progress={"timestamp": datetime.now().isoformat()},
    )
    logger.info("Recovered AntiTao KB status from stale error to ready")


def get_antitao_source_dirs(project_root: Path | None = None) -> list[Path]:
    path_service = get_path_service()
    root = project_root or path_service.project_root
    starter_pack_dir = root / "starter_content" / "antitao"
    feishu_wiki_seed_dir = root / "data" / "feishu_wiki_seed"

    folders: list[Path] = []
    if starter_pack_dir.exists():
        folders.append(starter_pack_dir.resolve())
    if feishu_wiki_seed_dir.exists():
        folders.append(feishu_wiki_seed_dir.resolve())
    folders.extend(_discover_obsidian_candidates())
    folders.extend(_discover_feishu_direct_snapshot(root))
    folders.extend(_discover_feishu_export_candidates())
    return _dedupe_paths(folders)


def bootstrap_antitao_knowledge_base() -> None:
    """Seed a default AntiTao KB and link local data folders when available.

    This bootstrap is intentionally lightweight:
    - Create the KB skeleton if absent
    - Link the bundled starter pack
    - Link a discovered Obsidian vault if present
    - Link a Feishu export folder when explicitly provided by env

    We do not auto-index here because that depends on runtime embedding config
    and could make startup fragile on a fresh install.
    """

    path_service = get_path_service()
    project_root = path_service.project_root
    kb_base_dir = project_root / "data" / "knowledge_bases"

    manager = KnowledgeBaseManager(base_dir=str(kb_base_dir))

    if ANTITAO_KB_NAME not in manager.list_knowledge_bases():
        initializer = KnowledgeBaseInitializer(
            kb_name=ANTITAO_KB_NAME,
            base_dir=str(kb_base_dir),
        )
        initializer.create_directory_structure()
        manager.update_kb_status(
            name=ANTITAO_KB_NAME,
            status="ready",
            progress={"timestamp": datetime.now().isoformat()},
        )
        manager.config = manager._load_config()
        kb_entry = manager.config.setdefault("knowledge_bases", {}).setdefault(
            ANTITAO_KB_NAME, {}
        )
        kb_entry["description"] = "AntiTao starter knowledge hub"
        kb_entry["updated_at"] = datetime.now().isoformat()
        manager._save_config()
        logger.info(f"Created default AntiTao knowledge base '{ANTITAO_KB_NAME}'")

    _link_antitao_source_dirs(manager, get_antitao_source_dirs(project_root))


async def hydrate_antitao_knowledge_base() -> None:
    """Bring linked AntiTao sources into a searchable KB when possible."""

    path_service = get_path_service()
    project_root = path_service.project_root
    kb_base_dir = project_root / "data" / "knowledge_bases"

    manager = KnowledgeBaseManager(base_dir=str(kb_base_dir))
    if ANTITAO_KB_NAME not in manager.list_knowledge_bases():
        bootstrap_antitao_knowledge_base()
        manager = KnowledgeBaseManager(base_dir=str(kb_base_dir))

    source_dirs = get_antitao_source_dirs(project_root)
    if not source_dirs:
        logger.info("No AntiTao source directories discovered; skipping KB hydration")
        return
    _link_antitao_source_dirs(manager, source_dirs)

    try:
        from deeptutor.services.embedding import get_embedding_config

        embedding_config = get_embedding_config()
        logger.info(f"Embedding config ready for AntiTao KB hydration: {embedding_config.model}")
    except Exception as exc:
        logger.warning(f"Skipping AntiTao KB hydration because embeddings are unavailable: {exc}")
        return

    kb_dir = kb_base_dir / ANTITAO_KB_NAME
    linked_folders = manager.get_linked_folders(ANTITAO_KB_NAME)

    if _kb_has_index(kb_dir):
        _heal_antitao_status_if_index_ready(manager, kb_dir)
        await _sync_linked_folders(manager, kb_base_dir, linked_folders)
        return

    source_files = _collect_supported_files(source_dirs)
    if not source_files:
        logger.info("No supported AntiTao source files found for first-time indexing")
        return

    initializer = KnowledgeBaseInitializer(
        kb_name=ANTITAO_KB_NAME,
        base_dir=str(kb_base_dir),
    )
    initializer.raw_dir.mkdir(parents=True, exist_ok=True)
    initializer.llamaindex_storage_dir.mkdir(parents=True, exist_ok=True)

    staged_count = _stage_seed_documents(source_files, initializer.raw_dir)
    if staged_count == 0:
        logger.info("AntiTao source staging produced no files; skipping initial indexing")
        return

    manager.update_kb_status(
        name=ANTITAO_KB_NAME,
        status="processing",
        progress={
            "stage": "processing_documents",
            "message": f"Indexing {staged_count} AntiTao source files...",
            "current": 0,
            "total": staged_count,
            "timestamp": datetime.now().isoformat(),
        },
    )

    await initializer.process_documents()
    initializer.extract_numbered_items()

    manager.update_kb_status(
        name=ANTITAO_KB_NAME,
        status="ready",
        progress={"timestamp": datetime.now().isoformat()},
    )
    logger.info(f"Initialized AntiTao KB from {staged_count} staged files")

    _record_linked_folder_sync_states(manager)


async def rebuild_antitao_knowledge_base(reason: str = "source change") -> None:
    """Rebuild AntiTao KB from source folders so edits/deletes stay accurate."""

    path_service = get_path_service()
    project_root = path_service.project_root
    kb_base_dir = project_root / "data" / "knowledge_bases"

    manager = KnowledgeBaseManager(base_dir=str(kb_base_dir))
    if ANTITAO_KB_NAME not in manager.list_knowledge_bases():
        bootstrap_antitao_knowledge_base()
        manager = KnowledgeBaseManager(base_dir=str(kb_base_dir))

    source_files = _collect_supported_files(get_antitao_source_dirs(project_root))
    if not source_files:
        logger.info("No supported AntiTao source files found; skipping rebuild")
        return

    try:
        from deeptutor.services.embedding import get_embedding_config

        embedding_config = get_embedding_config()
        logger.info(f"Embedding config ready for AntiTao KB rebuild: {embedding_config.model}")
    except Exception as exc:
        logger.warning(f"Skipping AntiTao KB rebuild because embeddings are unavailable: {exc}")
        return

    kb_dir = kb_base_dir / ANTITAO_KB_NAME
    raw_dir = kb_dir / "raw"
    storage_dir = kb_dir / "llamaindex_storage"

    logger.info(f"Rebuilding AntiTao KB from {len(source_files)} files because of {reason}")
    manager.update_kb_status(
        name=ANTITAO_KB_NAME,
        status="processing",
        progress={
            "stage": "rebuilding_documents",
            "message": f"Rebuilding AntiTao knowledge base from {len(source_files)} files...",
            "current": 0,
            "total": len(source_files),
            "timestamp": datetime.now().isoformat(),
        },
    )

    _reset_directory(raw_dir)
    _reset_directory(storage_dir)

    initializer = KnowledgeBaseInitializer(
        kb_name=ANTITAO_KB_NAME,
        base_dir=str(kb_base_dir),
    )
    staged_count = _stage_seed_documents(source_files, raw_dir)
    if staged_count == 0:
        logger.info("AntiTao rebuild staged no files; skipping indexing")
        return

    await initializer.process_documents()
    initializer.extract_numbered_items()

    manager = KnowledgeBaseManager(base_dir=str(kb_base_dir))
    manager.update_kb_status(
        name=ANTITAO_KB_NAME,
        status="ready",
        progress={"timestamp": datetime.now().isoformat()},
    )
    _record_linked_folder_sync_states(manager)
    logger.info(f"Rebuilt AntiTao KB from {staged_count} staged files")


def _kb_has_index(kb_dir: Path) -> bool:
    storage_dir = kb_dir / "llamaindex_storage"
    if not storage_dir.exists() or not storage_dir.is_dir():
        return False
    return any(path.is_file() for path in storage_dir.rglob("*"))


def _link_antitao_source_dirs(
    manager: KnowledgeBaseManager,
    source_dirs: list[Path],
) -> None:
    for folder in source_dirs:
        try:
            info = manager.link_folder(ANTITAO_KB_NAME, str(folder))
            logger.info(
                f"Linked folder '{folder}' to AntiTao KB as {info.get('id', 'unknown')}"
            )
        except Exception as exc:
            logger.warning(f"Failed to link folder '{folder}': {exc}")


def _collect_supported_files(source_dirs: list[Path]) -> list[Path]:
    files: list[Path] = []
    seen: set[str] = set()
    for source_dir in source_dirs:
        for path in source_dir.rglob("*"):
            if not _is_relevant_antitao_file(path):
                continue
            resolved = path.resolve()
            key = str(resolved)
            if key in seen:
                continue
            seen.add(key)
            files.append(resolved)
    return sorted(files)


def _stage_seed_documents(source_files: list[Path], raw_dir: Path) -> int:
    staged_count = 0
    for source_path in source_files:
        source_key = hashlib.md5(  # noqa: S324
            str(source_path).encode("utf-8"),
            usedforsecurity=False,
        ).hexdigest()[:10]
        dest_path = raw_dir / f"{source_key}_{source_path.name}"
        if dest_path.exists():
            continue
        shutil.copy2(source_path, dest_path)
        staged_count += 1
    return staged_count


def _reset_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def _record_linked_folder_sync_states(manager: KnowledgeBaseManager) -> None:
    for folder in manager.get_linked_folders(ANTITAO_KB_NAME):
        folder_id = folder.get("id")
        folder_path = folder.get("path")
        if not folder_id or not folder_path:
            continue
        try:
            files = [
                str(path)
                for path in _collect_supported_files([Path(folder_path).expanduser().resolve()])
            ]
            _replace_folder_sync_state(manager, folder_id, files)
        except Exception as exc:
            logger.warning(f"Failed to record sync state for '{folder_path}': {exc}")


def _replace_folder_sync_state(
    manager: KnowledgeBaseManager,
    folder_id: str,
    synced_files: list[str],
) -> None:
    metadata_file = manager.base_dir / ANTITAO_KB_NAME / "metadata.json"
    if not metadata_file.exists():
        return

    try:
        with open(metadata_file, encoding="utf-8") as f:
            metadata = json.load(f)
    except Exception:
        return

    file_states: dict[str, str] = {}
    for file_path in synced_files:
        path = Path(file_path)
        if not path.exists():
            continue
        file_states[file_path] = datetime.fromtimestamp(path.stat().st_mtime).isoformat()

    for folder in metadata.get("linked_folders", []):
        if folder.get("id") != folder_id:
            continue
        folder["last_sync"] = datetime.now().isoformat()
        folder["synced_files"] = file_states
        folder["file_count"] = len(file_states)
        break

    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)


async def _sync_linked_folders(
    manager: KnowledgeBaseManager,
    kb_base_dir: Path,
    linked_folders: list[dict],
) -> None:
    if not linked_folders:
        return

    pending_new_files: list[tuple[dict, list[str]]] = []
    rebuild_reasons: list[str] = []

    for folder in linked_folders:
        folder_id = folder.get("id")
        folder_path = folder.get("path")
        if not folder_id or not folder_path:
            continue

        try:
            changes = manager.detect_folder_changes(ANTITAO_KB_NAME, folder_id)
        except Exception as exc:
            logger.warning(f"Failed to inspect linked folder '{folder_path}': {exc}")
            continue

        new_files = [
            file_path
            for file_path in changes["new_files"]
            if _is_relevant_antitao_file(Path(file_path))
        ]
        modified_files = [
            file_path
            for file_path in changes["modified_files"]
            if _is_relevant_antitao_file(Path(file_path))
        ]
        deleted_files = [
            file_path
            for file_path in (folder.get("synced_files") or {}).keys()
            if not Path(file_path).exists()
        ]

        if modified_files:
            rebuild_reasons.append(f"{len(modified_files)} modified files in {folder_path}")
        if deleted_files:
            rebuild_reasons.append(f"{len(deleted_files)} deleted files in {folder_path}")
        if new_files:
            pending_new_files.append((folder, new_files))

    if rebuild_reasons:
        await rebuild_antitao_knowledge_base("; ".join(rebuild_reasons))
        return

    for folder, files_to_process in pending_new_files:
        folder_id = folder.get("id")
        folder_path = folder.get("path")

        logger.info(
            f"Syncing {len(files_to_process)} changed files from linked folder "
            f"'{folder_path}' into AntiTao KB"
        )

        adder = DocumentAdder(
            kb_name=ANTITAO_KB_NAME,
            base_dir=str(kb_base_dir),
        )
        staged_files = adder.add_documents(files_to_process, allow_duplicates=False)
        if not staged_files:
            continue

        processed_files = await adder.process_new_documents(staged_files)
        adder.update_metadata(len(processed_files))
        if processed_files:
            manager.update_folder_sync_state(
                ANTITAO_KB_NAME,
                folder_id,
                files_to_process,
            )
            logger.info(
                f"Processed {len(processed_files)} files from linked folder '{folder_path}'"
            )

    _heal_antitao_status_if_index_ready(manager, kb_base_dir / ANTITAO_KB_NAME)

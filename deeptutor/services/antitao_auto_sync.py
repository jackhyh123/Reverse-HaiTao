from __future__ import annotations

import asyncio
from contextlib import suppress
import os

from deeptutor.logging import get_logger
from deeptutor.services.antitao_seed import hydrate_antitao_knowledge_base

logger = get_logger("antitao.auto_sync")

DEFAULT_SYNC_INTERVAL_SECONDS = 300
_sync_lock = asyncio.Lock()


def _env_flag_enabled(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off", "disabled"}


def _get_sync_interval_seconds() -> int:
    value = os.getenv("ANTITAO_KB_SYNC_INTERVAL_SECONDS", "").strip()
    if not value:
        return DEFAULT_SYNC_INTERVAL_SECONDS
    try:
        return max(0, int(value))
    except ValueError:
        logger.warning(
            f"Invalid ANTITAO_KB_SYNC_INTERVAL_SECONDS={value!r}; "
            f"using {DEFAULT_SYNC_INTERVAL_SECONDS} seconds"
        )
        return DEFAULT_SYNC_INTERVAL_SECONDS


async def _run_single_sync() -> None:
    if _sync_lock.locked():
        logger.info("AntiTao KB sync already running; skipping this interval")
        return

    async with _sync_lock:
        await hydrate_antitao_knowledge_base()


async def _auto_sync_loop(interval_seconds: int) -> None:
    logger.info(f"AntiTao KB auto sync started; interval={interval_seconds}s")
    try:
        while True:
            await asyncio.sleep(interval_seconds)
            try:
                await _run_single_sync()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning(f"AntiTao KB auto sync failed: {exc}")
    finally:
        logger.info("AntiTao KB auto sync stopped")


def start_antitao_auto_sync() -> asyncio.Task | None:
    if not _env_flag_enabled("ANTITAO_KB_AUTO_SYNC", default=True):
        logger.info("AntiTao KB auto sync disabled by ANTITAO_KB_AUTO_SYNC")
        return None

    interval_seconds = _get_sync_interval_seconds()
    if interval_seconds <= 0:
        logger.info(f"AntiTao KB auto sync disabled because interval is {interval_seconds}")
        return None

    return asyncio.create_task(_auto_sync_loop(interval_seconds))


async def stop_antitao_auto_sync(task: asyncio.Task | None) -> None:
    if task is None:
        return

    task.cancel()
    with suppress(asyncio.CancelledError):
        await task

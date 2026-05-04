"""AI usage tracking: daily aggregated token / cost metrics per user + model.

Stored in the same auth.db as members / sessions so admin tooling can query
everything from a single database.
"""

from __future__ import annotations

import sqlite3
import threading
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any

DB_FILENAME = "auth.db"
_usage_store_singleton: "UsageStore | None" = None
_lock = threading.Lock()


def _resolve_db_path() -> Path:
    project_root = Path(__file__).resolve().parents[3]
    data_root = project_root / "data" / "user"
    data_root.mkdir(parents=True, exist_ok=True)
    return data_root / DB_FILENAME


class UsageStore:
    """Persist daily-aggregated LLM usage metrics."""

    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path or _resolve_db_path()
        self._init_db()
        # auto-migrate for existing databases that predate the usage table
        self._migrate_members_is_premium()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=10, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_db(self) -> None:
        with self._conn() as c:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS daily_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    date TEXT NOT NULL,
                    model TEXT NOT NULL,
                    call_count INTEGER NOT NULL DEFAULT 1,
                    total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
                    total_completion_tokens INTEGER NOT NULL DEFAULT 0,
                    total_cost REAL NOT NULL DEFAULT 0.0,
                    UNIQUE(email, date, model)
                );
                CREATE INDEX IF NOT EXISTS idx_daily_usage_date
                    ON daily_usage(date DESC);
                CREATE INDEX IF NOT EXISTS idx_daily_usage_email_date
                    ON daily_usage(email, date DESC);
                """
            )

    def _migrate_members_is_premium(self) -> None:
        """Add is_premium column to members table if it doesn't exist."""
        try:
            with self._conn() as c:
                cols = [r["name"] for r in c.execute("PRAGMA table_info(members)").fetchall()]
                if "is_premium" not in cols:
                    c.execute("ALTER TABLE members ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0")
        except Exception:
            pass  # table may not exist yet

    # ─── write ──────────────────────────────────────────────────────────────

    def log_usage(
        self,
        email: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        cost: float = 0.0,
        call_count: int = 1,
    ) -> None:
        """Upsert today's aggregated row for (email, model)."""
        email = email.strip().lower()
        today = date.today().isoformat()
        with self._conn() as c:
            existing = c.execute(
                "SELECT id, call_count, total_prompt_tokens, total_completion_tokens, total_cost "
                "FROM daily_usage WHERE email = ? AND date = ? AND model = ?",
                (email, today, model),
            ).fetchone()
            if existing:
                c.execute(
                    "UPDATE daily_usage SET "
                    "call_count = call_count + ?, "
                    "total_prompt_tokens = total_prompt_tokens + ?, "
                    "total_completion_tokens = total_completion_tokens + ?, "
                    "total_cost = total_cost + ? "
                    "WHERE id = ?",
                    (call_count, prompt_tokens, completion_tokens, cost, existing["id"]),
                )
            else:
                c.execute(
                    "INSERT INTO daily_usage "
                    "(email, date, model, call_count, total_prompt_tokens, total_completion_tokens, total_cost) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (email, today, model, call_count, prompt_tokens, completion_tokens, cost),
                )

    # ─── query ──────────────────────────────────────────────────────────────

    def get_daily_usage(
        self,
        email: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        """Query daily usage with optional filters."""
        conditions: list[str] = []
        params: list[Any] = []

        if email:
            conditions.append("email = ?")
            params.append(email.strip().lower())
        if date_from:
            conditions.append("date >= ?")
            params.append(date_from)
        if date_to:
            conditions.append("date <= ?")
            params.append(date_to)

        where = ""
        if conditions:
            where = "WHERE " + " AND ".join(conditions)

        query = (
            f"SELECT * FROM daily_usage {where} "
            f"ORDER BY date DESC, email ASC, model ASC LIMIT ?"
        )
        params.append(max(1, min(limit, 1000)))

        with self._conn() as c:
            rows = c.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def get_totals(
        self,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict[str, Any]:
        """Aggregated totals across all users."""
        conditions: list[str] = []
        params: list[Any] = []

        if date_from:
            conditions.append("date >= ?")
            params.append(date_from)
        if date_to:
            conditions.append("date <= ?")
            params.append(date_to)

        where = ""
        if conditions:
            where = "WHERE " + " AND ".join(conditions)

        with self._conn() as c:
            row = c.execute(
                f"SELECT "
                f"  COUNT(DISTINCT email) AS unique_users, "
                f"  SUM(call_count) AS total_calls, "
                f"  SUM(total_prompt_tokens) AS total_prompt_tokens, "
                f"  SUM(total_completion_tokens) AS total_completion_tokens, "
                f"  SUM(total_cost) AS total_cost "
                f"FROM daily_usage {where}",
                params,
            ).fetchone()
        return dict(row) if row else {}


def get_usage_store() -> UsageStore:
    global _usage_store_singleton
    if _usage_store_singleton is None:
        with _lock:
            if _usage_store_singleton is None:
                _usage_store_singleton = UsageStore()
    return _usage_store_singleton

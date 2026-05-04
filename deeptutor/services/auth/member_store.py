"""Member store: SQLite-backed member registry + admin allowlist."""

from __future__ import annotations

import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

DB_FILENAME = "auth.db"
_member_store_singleton: "MemberStore | None" = None
_lock = threading.Lock()


def _resolve_db_path() -> Path:
    """Use the same data root as the existing chat_history.db."""
    # mirror sqlite_store.py logic: data/user/auth.db
    project_root = Path(__file__).resolve().parents[3]
    data_root = project_root / "data" / "user"
    data_root.mkdir(parents=True, exist_ok=True)
    return data_root / DB_FILENAME


def is_admin_email(email: str | None) -> bool:
    if not email:
        return False
    raw = os.environ.get("ADMIN_EMAILS", "")
    allow = {item.strip().lower() for item in raw.split(",") if item.strip()}
    return email.strip().lower() in allow


class MemberStore:
    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path or _resolve_db_path()
        self._init_db()
        self._migrate_is_premium()

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
                CREATE TABLE IF NOT EXISTS members (
                    email TEXT PRIMARY KEY,
                    created_at REAL NOT NULL,
                    last_login_at REAL NOT NULL,
                    login_count INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'active',
                    note TEXT DEFAULT '',
                    is_premium INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_members_last_login
                    ON members(last_login_at DESC);

                CREATE TABLE IF NOT EXISTS auth_sessions (
                    token TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    role TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    last_seen_at REAL NOT NULL,
                    ip TEXT DEFAULT '',
                    user_agent TEXT DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS idx_auth_sessions_email
                    ON auth_sessions(email);
                CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
                    ON auth_sessions(expires_at);

                CREATE TABLE IF NOT EXISTS member_activity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_json TEXT DEFAULT '{}',
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_activity_email_time
                    ON member_activity(email, created_at DESC);

                CREATE TABLE IF NOT EXISTS user_node_progress (
                    email TEXT NOT NULL,
                    node_id TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'in_progress',
                    mastered_at REAL,
                    last_seen_at REAL NOT NULL,
                    notes TEXT DEFAULT '',
                    PRIMARY KEY (email, node_id)
                );
                CREATE INDEX IF NOT EXISTS idx_node_progress_email_status
                    ON user_node_progress(email, status);
                """
            )

    # ─── node progress ────────────────────────────────────────────────────

    def get_user_progress(self, email: str) -> list[dict[str, Any]]:
        email = email.strip().lower()
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM user_node_progress WHERE email = ?", (email,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_mastered_node_ids(self, email: str) -> list[str]:
        email = email.strip().lower()
        with self._conn() as c:
            rows = c.execute(
                "SELECT node_id FROM user_node_progress "
                "WHERE email = ? AND status = 'mastered'",
                (email,),
            ).fetchall()
        return [r["node_id"] for r in rows]

    def upsert_node_progress(
        self,
        email: str,
        node_id: str,
        status: str,
        notes: str = "",
    ) -> dict[str, Any]:
        email = email.strip().lower()
        now = time.time()
        mastered_at = now if status == "mastered" else None
        with self._conn() as c:
            existing = c.execute(
                "SELECT * FROM user_node_progress WHERE email = ? AND node_id = ?",
                (email, node_id),
            ).fetchone()
            if existing:
                # don't overwrite mastered_at if already mastered
                final_mastered_at = (
                    existing["mastered_at"] if existing["status"] == "mastered"
                    else mastered_at
                )
                c.execute(
                    "UPDATE user_node_progress SET status = ?, mastered_at = ?, "
                    "last_seen_at = ?, notes = ? WHERE email = ? AND node_id = ?",
                    (status, final_mastered_at, now, notes, email, node_id),
                )
            else:
                c.execute(
                    "INSERT INTO user_node_progress "
                    "(email, node_id, status, mastered_at, last_seen_at, notes) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (email, node_id, status, mastered_at, now, notes),
                )
            row = c.execute(
                "SELECT * FROM user_node_progress WHERE email = ? AND node_id = ?",
                (email, node_id),
            ).fetchone()
        return dict(row) if row else {}

    def reset_node_progress(self, email: str, node_id: str | None = None) -> int:
        email = email.strip().lower()
        with self._conn() as c:
            if node_id:
                cur = c.execute(
                    "DELETE FROM user_node_progress WHERE email = ? AND node_id = ?",
                    (email, node_id),
                )
            else:
                cur = c.execute(
                    "DELETE FROM user_node_progress WHERE email = ?", (email,)
                )
        return cur.rowcount or 0

    # ─── members ──────────────────────────────────────────────────────────

    def upsert_on_login(self, email: str) -> dict[str, Any]:
        email = email.strip().lower()
        now = time.time()
        with self._conn() as c:
            existing = c.execute(
                "SELECT * FROM members WHERE email = ?", (email,)
            ).fetchone()
            if existing:
                c.execute(
                    "UPDATE members SET last_login_at = ?, login_count = login_count + 1 "
                    "WHERE email = ?",
                    (now, email),
                )
            else:
                c.execute(
                    "INSERT INTO members (email, created_at, last_login_at, login_count, status) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (email, now, now, 1, "active"),
                )
            row = c.execute(
                "SELECT * FROM members WHERE email = ?", (email,)
            ).fetchone()
        return dict(row) if row else {}

    def get_member(self, email: str) -> dict[str, Any] | None:
        email = email.strip().lower()
        with self._conn() as c:
            row = c.execute(
                "SELECT * FROM members WHERE email = ?", (email,)
            ).fetchone()
        return dict(row) if row else None

    def list_members(self, limit: int = 200) -> list[dict[str, Any]]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM members ORDER BY last_login_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def update_status(self, email: str, status: str) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE members SET status = ? WHERE email = ?",
                (status, email.strip().lower()),
            )

    def create_member(
        self, email: str, status: str = "active", is_premium: bool = False
    ) -> dict[str, Any]:
        email = email.strip().lower()
        now = time.time()
        with self._conn() as c:
            existing = c.execute(
                "SELECT * FROM members WHERE email = ?", (email,)
            ).fetchone()
            if existing:
                raise ValueError("member_exists")
            c.execute(
                "INSERT INTO members (email, created_at, last_login_at, login_count, status, is_premium) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (email, now, now, 0, status, 1 if is_premium else 0),
            )
            row = c.execute(
                "SELECT * FROM members WHERE email = ?", (email,)
            ).fetchone()
        return dict(row) if row else {}

    def delete_member(self, email: str) -> bool:
        email = email.strip().lower()
        with self._conn() as c:
            cur = c.execute("DELETE FROM members WHERE email = ?", (email,))
        return cur.rowcount > 0

    def toggle_premium(self, email: str, is_premium: bool) -> dict[str, Any] | None:
        email = email.strip().lower()
        with self._conn() as c:
            c.execute(
                "UPDATE members SET is_premium = ? WHERE email = ?",
                (1 if is_premium else 0, email),
            )
            row = c.execute(
                "SELECT * FROM members WHERE email = ?", (email,)
            ).fetchone()
        return dict(row) if row else None

    def _migrate_is_premium(self) -> None:
        """Add is_premium column if missing (for existing databases)."""
        try:
            with self._conn() as c:
                cols = [r["name"] for r in c.execute("PRAGMA table_info(members)").fetchall()]
                if "is_premium" not in cols:
                    c.execute("ALTER TABLE members ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0")
        except Exception:
            pass

    # ─── activity ─────────────────────────────────────────────────────────

    def log_activity(self, email: str, event_type: str, payload: str = "{}") -> None:
        with self._conn() as c:
            c.execute(
                "INSERT INTO member_activity (email, event_type, payload_json, created_at) "
                "VALUES (?, ?, ?, ?)",
                (email.strip().lower(), event_type, payload, time.time()),
            )

    def get_member_stats(self, email: str) -> dict[str, Any]:
        """Aggregate stats for one member (sessions count from auth_sessions; activity count)."""
        email = email.strip().lower()
        with self._conn() as c:
            sessions = c.execute(
                "SELECT COUNT(*) AS n FROM auth_sessions WHERE email = ?", (email,)
            ).fetchone()
            activities = c.execute(
                "SELECT COUNT(*) AS n FROM member_activity WHERE email = ?", (email,)
            ).fetchone()
            recent = c.execute(
                "SELECT MAX(created_at) AS t FROM member_activity WHERE email = ?",
                (email,),
            ).fetchone()
        return {
            "auth_sessions_count": int(sessions["n"]) if sessions else 0,
            "activity_count": int(activities["n"]) if activities else 0,
            "last_activity_at": float(recent["t"]) if recent and recent["t"] else None,
        }


def get_member_store() -> MemberStore:
    global _member_store_singleton
    if _member_store_singleton is None:
        with _lock:
            if _member_store_singleton is None:
                _member_store_singleton = MemberStore()
    return _member_store_singleton

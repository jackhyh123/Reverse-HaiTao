"""Auth session store: cookie tokens stored in SQLite (auth.db, table auth_sessions)."""

from __future__ import annotations

import os
import secrets
import time
from typing import Any

from deeptutor.services.auth.member_store import MemberStore, get_member_store


def _ttl_seconds() -> int:
    try:
        return int(os.environ.get("SESSION_TTL_SECONDS", "2592000"))
    except ValueError:
        return 2592000


class AuthSessionStore:
    """Lightweight wrapper around the auth_sessions table."""

    def __init__(self, member_store: MemberStore | None = None):
        self.member_store = member_store or get_member_store()

    def create(
        self,
        email: str,
        role: str,
        ip: str = "",
        user_agent: str = "",
    ) -> dict[str, Any]:
        token = secrets.token_urlsafe(32)
        now = time.time()
        expires = now + _ttl_seconds()
        with self.member_store._conn() as c:
            c.execute(
                "INSERT INTO auth_sessions "
                "(token, email, role, created_at, expires_at, last_seen_at, ip, user_agent) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (token, email.strip().lower(), role, now, expires, now, ip, user_agent),
            )
        return {
            "token": token,
            "email": email.strip().lower(),
            "role": role,
            "expires_at": expires,
        }

    def get(self, token: str | None) -> dict[str, Any] | None:
        if not token:
            return None
        now = time.time()
        with self.member_store._conn() as c:
            row = c.execute(
                "SELECT * FROM auth_sessions WHERE token = ?", (token,)
            ).fetchone()
            if not row:
                return None
            if row["expires_at"] < now:
                c.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
                return None
            c.execute(
                "UPDATE auth_sessions SET last_seen_at = ? WHERE token = ?",
                (now, token),
            )
        return dict(row)

    def delete(self, token: str | None) -> None:
        if not token:
            return
        with self.member_store._conn() as c:
            c.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))

    def cleanup_expired(self) -> int:
        with self.member_store._conn() as c:
            cur = c.execute(
                "DELETE FROM auth_sessions WHERE expires_at < ?", (time.time(),)
            )
        return cur.rowcount or 0


_singleton: AuthSessionStore | None = None


def get_auth_session_store() -> AuthSessionStore:
    global _singleton
    if _singleton is None:
        _singleton = AuthSessionStore()
    return _singleton

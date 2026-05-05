"""Auth API: email OTP + password login + session cookie + admin guard.

Endpoints:
    POST /api/v1/auth/send-code     {email} → send OTP
    POST /api/v1/auth/verify        {email, code} → set cookie, returns user
    POST /api/v1/auth/login         {email, password} → set cookie (after first OTP)
    POST /api/v1/auth/set-password  {password} → set login password (needs session)
    POST /api/v1/auth/admin-login   {email, password} → admin-only password login
    POST /api/v1/auth/logout        → clear cookie
    GET  /api/v1/auth/me            → current user (or 401)

Flow: first login → OTP verify → set-password → subsequent logins with password.
"""

from __future__ import annotations

import hashlib
import os
import secrets
from typing import Any, Literal

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from deeptutor.services.auth import (
    get_auth_session_store,
    get_member_store,
    get_otp_client,
    is_admin_email,
)
from deeptutor.services.auth.email_otp import is_valid_email

router = APIRouter()

COOKIE_NAME = "dt_session"


# ─── password helpers ────────────────────────────────────────────────────

def _hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Hash a password with PBKDF2-SHA256. Returns (hash_hex, salt_hex)."""
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return dk.hex(), salt


def _verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against stored 'salt:hash' string."""
    if ":" not in stored_hash:
        return False  # legacy or empty
    salt, h = stored_hash.split(":", 1)
    computed, _ = _hash_password(password, salt)
    return secrets.compare_digest(computed, h)


# ─── Models ──────────────────────────────────────────────────────────────


class SendCodePayload(BaseModel):
    email: str


class VerifyPayload(BaseModel):
    email: str
    code: str


class LoginPayload(BaseModel):
    email: str
    password: str


class SetPasswordPayload(BaseModel):
    password: str


class UserInfo(BaseModel):
    email: str
    role: Literal["admin", "member"]
    is_admin: bool
    is_premium: bool = False
    has_password: bool = False
    expires_at: float | None = None


# ─── helpers ─────────────────────────────────────────────────────────────


def _build_user_response(
    email: str,
    role: str,
    member: dict,
    session: dict,
) -> dict[str, Any]:
    return {
        "user": {
            "email": email,
            "role": role,
            "is_admin": role == "admin",
            "is_premium": bool(member.get("is_premium", False)),
            "has_password": bool(member.get("password_hash", "")),
            "expires_at": session["expires_at"],
            "member": member,
        }
    }


def _create_session_and_set_cookie(
    email: str,
    role: str,
    request: Request,
    response: Response,
) -> dict:
    sessions = get_auth_session_store()
    new_sess = sessions.create(
        email=email,
        role=role,
        ip=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", "")[:240],
    )
    response.set_cookie(
        key=COOKIE_NAME,
        value=new_sess["token"],
        max_age=int(new_sess["expires_at"] - new_sess.get("created_at", 0))
        if new_sess.get("created_at")
        else 2592000,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return new_sess


# ─── Dependencies ────────────────────────────────────────────────────────


def get_current_user(
    dt_session: str | None = Cookie(default=None),
) -> UserInfo:
    store = get_auth_session_store()
    sess = store.get(dt_session)
    if not sess:
        raise HTTPException(status_code=401, detail="not_authenticated")
    role = sess.get("role") or "member"
    member = get_member_store().get_member(sess["email"])
    is_premium = bool(member.get("is_premium", False)) if member else False
    has_password = bool(member.get("password_hash", "")) if member else False
    return UserInfo(
        email=sess["email"],
        role=role,
        is_admin=role == "admin",
        is_premium=is_premium,
        has_password=has_password,
        expires_at=sess.get("expires_at"),
    )


def get_optional_user(
    dt_session: str | None = Cookie(default=None),
) -> UserInfo | None:
    if not dt_session:
        return None
    store = get_auth_session_store()
    sess = store.get(dt_session)
    if not sess:
        return None
    role = sess.get("role") or "member"
    member = get_member_store().get_member(sess["email"])
    is_premium = bool(member.get("is_premium", False)) if member else False
    has_password = bool(member.get("password_hash", "")) if member else False
    return UserInfo(
        email=sess["email"],
        role=role,
        is_admin=role == "admin",
        is_premium=is_premium,
        has_password=has_password,
        expires_at=sess.get("expires_at"),
    )


def require_admin(user: UserInfo = Depends(get_current_user)) -> UserInfo:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="admin_required")
    return user


# ─── Endpoints ───────────────────────────────────────────────────────────


@router.post("/send-code")
async def send_code(payload: SendCodePayload) -> dict[str, Any]:
    if not is_valid_email(payload.email):
        raise HTTPException(status_code=400, detail="invalid_email")

    bypass_otp = os.environ.get("AUTH_BYPASS_OTP", "").strip().lower() in ("true", "1", "yes")
    if bypass_otp:
        return {"success": True, "message": "[跳过] 请输入任意6位数字验证码", "dev_mode": True}

    client = get_otp_client()
    ok, msg = client.send_code(payload.email)
    return {"success": ok, "message": msg, "dev_mode": getattr(client, "is_dev_mode", False)}


@router.post("/verify")
async def verify(
    payload: VerifyPayload,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    if not is_valid_email(payload.email):
        raise HTTPException(status_code=400, detail="invalid_email")

    bypass_otp = os.environ.get("AUTH_BYPASS_OTP", "").strip().lower() in ("true", "1", "yes")
    if not bypass_otp:
        client = get_otp_client()
        ok, msg = client.verify_code(payload.email, payload.code)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)

    email = payload.email.lower().strip()
    role: Literal["admin", "member"] = "admin" if is_admin_email(email) else "member"

    members = get_member_store()
    member = members.upsert_on_login(email)
    members.log_activity(email, "login")

    new_sess = _create_session_and_set_cookie(email, role, request, response)
    return _build_user_response(email, role, member, new_sess)


@router.post("/login")
async def login(
    payload: LoginPayload,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """Password login for any user who has set a password."""
    if not is_valid_email(payload.email):
        raise HTTPException(status_code=400, detail="invalid_email")

    email = payload.email.lower().strip()
    members = get_member_store()
    member = members.get_member(email)

    if not member:
        raise HTTPException(status_code=401, detail="invalid_credentials")
    pw = member.get("password_hash", "")
    if not pw or not _verify_password(payload.password, pw):
        raise HTTPException(status_code=401, detail="invalid_credentials")

    role: Literal["admin", "member"] = "admin" if is_admin_email(email) else "member"
    members.upsert_on_login(email)
    members.log_activity(email, "password_login")

    new_sess = _create_session_and_set_cookie(email, role, request, response)
    member = members.get_member(email) or member
    return _build_user_response(email, role, member, new_sess)


@router.post("/set-password")
async def set_password(
    payload: SetPasswordPayload,
    request: Request,
    user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """Set a login password after OTP verification (requires session)."""
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="password_too_short")

    h, salt = _hash_password(payload.password)
    stored = f"{salt}:{h}"
    get_member_store().set_password(user.email, stored)
    return {"success": True}


@router.post("/logout")
async def logout(
    response: Response,
    dt_session: str | None = Cookie(default=None),
) -> dict[str, Any]:
    if dt_session:
        store = get_auth_session_store()
        sess = store.get(dt_session)
        if sess:
            get_member_store().log_activity(sess["email"], "logout")
        store.delete(dt_session)
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"success": True}


@router.post("/admin-login")
async def admin_login(
    payload: LoginPayload,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """Admin password login using AUTH_ADMIN_PASSWORD env var (no OTP, no DB password)."""
    email = payload.email.lower().strip()
    admin_password = os.environ.get("AUTH_ADMIN_PASSWORD", "").strip()

    if not admin_password:
        raise HTTPException(status_code=501, detail="admin_login_not_configured")
    if not is_admin_email(email):
        raise HTTPException(status_code=403, detail="not_admin")
    if payload.password != admin_password:
        raise HTTPException(status_code=401, detail="invalid_credentials")

    role: Literal["admin", "member"] = "admin"
    members = get_member_store()
    member = members.upsert_on_login(email)
    members.log_activity(email, "admin_login")

    new_sess = _create_session_and_set_cookie(email, role, request, response)
    return _build_user_response(email, role, member, new_sess)


@router.get("/me")
async def me(user: UserInfo | None = Depends(get_optional_user)) -> dict[str, Any]:
    if user is None:
        return {"authenticated": False}
    member = get_member_store().get_member(user.email)
    return {
        "authenticated": True,
        "user": user.model_dump(),
        "member": member,
    }

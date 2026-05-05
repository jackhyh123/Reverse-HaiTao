"""Auth API: email OTP login + session cookie + admin guard.

Endpoints:
    POST /api/v1/auth/send-code    {email} → send OTP
    POST /api/v1/auth/verify       {email, code} → set cookie, returns user
    POST /api/v1/auth/logout       → clear cookie
    GET  /api/v1/auth/me           → current user (or 401)

Admin-protected dependencies are exposed as `require_admin` and `get_current_user`.
"""

from __future__ import annotations

import os
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


# ─── Models ──────────────────────────────────────────────────────────────


class SendCodePayload(BaseModel):
    email: str


class VerifyPayload(BaseModel):
    email: str
    code: str


class UserInfo(BaseModel):
    email: str
    role: Literal["admin", "member"]
    is_admin: bool
    is_premium: bool = False
    expires_at: float | None = None


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
    return UserInfo(
        email=sess["email"],
        role=role,
        is_admin=role == "admin",
        is_premium=is_premium,
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
    return UserInfo(
        email=sess["email"],
        role=role,
        is_admin=role == "admin",
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

    # Allow bypassing OTP verification via env var (for dev/debug)
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
        secure=False,  # dev-friendly; flip for prod HTTPS
        path="/",
    )
    return {
        "user": {
            "email": email,
            "role": role,
            "is_admin": role == "admin",
            "is_premium": bool(member.get("is_premium", False)),
            "expires_at": new_sess["expires_at"],
            "member": member,
        }
    }


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

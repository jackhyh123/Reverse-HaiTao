"""Auth service: email OTP + members + admin allowlist."""

from deeptutor.services.auth.email_otp import EmailOTPClient, get_otp_client
from deeptutor.services.auth.member_store import (
    MemberStore,
    get_member_store,
    is_admin_email,
)
from deeptutor.services.auth.session_store import (
    AuthSessionStore,
    get_auth_session_store,
)

__all__ = [
    "EmailOTPClient",
    "get_otp_client",
    "MemberStore",
    "get_member_store",
    "is_admin_email",
    "AuthSessionStore",
    "get_auth_session_store",
]

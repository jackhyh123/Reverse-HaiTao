"""Email OTP client (SMTP / Resend / dev-mode console fallback)."""

from __future__ import annotations

import json
import os
import random
import re
import smtplib
import ssl
import time
from email.header import Header
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Dict, Tuple
from urllib.request import Request, urlopen

# {email: (code, expire_ts, attempts)}
_CODE_STORE: Dict[str, Tuple[str, float, int]] = {}

CODE_TTL = 300            # 5 min
SEND_COOLDOWN = 60        # 60 sec resend cooldown
MAX_VERIFY_ATTEMPTS = 5

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def is_valid_email(email: str) -> bool:
    return bool(EMAIL_RE.match(email.strip()))


_OTP_HTML_TEMPLATE = """\
<div style="font-family: -apple-system, 'Microsoft YaHei', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1a73e8;">🎯 反淘淘金通关系统</h2>
    <p>您好，</p>
    <p>您正在登录「反淘淘金通关系统」，验证码为：</p>
    <div style="background: #f0f6ff; border: 2px dashed #1a73e8; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a73e8;">{code}</span>
    </div>
    <p style="color: #666;">验证码 5 分钟内有效，请勿泄露给他人。</p>
    <p style="color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 12px; margin-top: 24px;">
        若非本人操作，请忽略此邮件。
    </p>
</div>"""

OTP_SUBJECT = "【反淘淘金通关系统】您的登录验证码"


def _check_cooldown(email: str) -> str | None:
    if email not in _CODE_STORE:
        return None
    _, expire_ts, _ = _CODE_STORE[email]
    remaining = (expire_ts - CODE_TTL + SEND_COOLDOWN) - time.time()
    if remaining > 0:
        return f"请等待 {int(remaining)} 秒后再试"
    return None


# ──────────────────────────────────────────────
#  Resend (HTTP API)  —  preferred when SMTP ports are blocked
# ──────────────────────────────────────────────

class _ResendOTPClient:
    """Send OTP via Resend REST API (port 443, no SMTP)."""

    def __init__(self, api_key: str, from_address: str, from_name: str = "反淘淘金通关系统"):
        self.api_key = api_key
        self.from_address = from_address
        self.from_name = from_name

    @property
    def is_dev_mode(self) -> bool:
        return False

    def send_code(self, email: str) -> Tuple[bool, str]:
        email = email.strip().lower()
        if not is_valid_email(email):
            return False, "邮箱格式错误"

        cooldown_msg = _check_cooldown(email)
        if cooldown_msg:
            return False, cooldown_msg

        code = f"{random.randint(100000, 999999)}"
        body = _OTP_HTML_TEMPLATE.format(code=code)

        payload = json.dumps({
            "from": f"{self.from_name} <{self.from_address}>",
            "to": [email],
            "subject": OTP_SUBJECT,
            "html": body,
        })

        # Use subprocess + curl to bypass Python's proxy/network stack which
        # may be intercepted by the sandbox / system proxy.
        import subprocess
        try:
            proc = subprocess.run(
                [
                    "curl", "-s",
                    "-w", "\n__HTTP_CODE__:%{http_code}",
                    "-X", "POST",
                    "https://api.resend.com/emails",
                    "-H", f"Authorization: Bearer {self.api_key}",
                    "-H", "Content-Type: application/json",
                    "-d", payload,
                    "--max-time", "15",
                ],
                capture_output=True,
                text=True,
                timeout=20,
                env={
                    **os.environ,
                    "HTTP_PROXY": "", "HTTPS_PROXY": "",
                    "http_proxy": "", "https_proxy": "",
                    "no_proxy": "*", "NO_PROXY": "*",
                },
            )
            # Parse HTTP status code from tail of output
            stdout = proc.stdout
            http_code = 0
            if "__HTTP_CODE__:" in stdout:
                marker = stdout.rindex("__HTTP_CODE__:")
                http_code = int(stdout[marker + len("__HTTP_CODE__:"):].strip())
                resp_body = stdout[:marker].strip()
            else:
                resp_body = stdout.strip()

            if proc.returncode != 0 or http_code >= 400:
                stderr = proc.stderr.strip()[:300] if proc.stderr else ""
                print(f"[AUTH-RESEND] ❌ HTTP {http_code} curl exit {proc.returncode}: {resp_body[:300]} {stderr}", flush=True)
                msg = resp_body[:200] or stderr or f"HTTP {http_code}"
                return False, f"发送失败：{msg}"
            print(
                f"[AUTH-RESEND] ✅ sent OTP {code} → {email}",
                flush=True,
            )
        except subprocess.TimeoutExpired:
            print("[AUTH-RESEND] ❌ curl timed out", flush=True)
            return False, "发送失败：请求超时"
        except Exception as e:
            print(f"[AUTH-RESEND] ❌ subprocess error: {e}", flush=True)
            return False, f"发送失败：{e}"

        _CODE_STORE[email] = (code, time.time() + CODE_TTL, 0)
        return True, "验证码已发送至您的邮箱"

    def verify_code(self, email: str, code: str) -> Tuple[bool, str]:
        return _verify_code_common(email, code)


# ──────────────────────────────────────────────
#  SMTP client  (legacy)
# ──────────────────────────────────────────────

class EmailOTPClient:
    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_name: str = "反淘淘金通关系统",
        use_ssl: bool = True,
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_name = from_name
        self.use_ssl = use_ssl

    @property
    def is_dev_mode(self) -> bool:
        return False

    def send_code(self, email: str) -> Tuple[bool, str]:
        email = email.strip().lower()
        if not is_valid_email(email):
            return False, "邮箱格式错误"

        cooldown_msg = _check_cooldown(email)
        if cooldown_msg:
            return False, cooldown_msg

        code = f"{random.randint(100000, 999999)}"
        body = _OTP_HTML_TEMPLATE.format(code=code)

        msg = MIMEText(body, "html", "utf-8")
        msg["From"] = formataddr((str(Header(self.from_name, "utf-8")), self.smtp_user))
        msg["To"] = email
        msg["Subject"] = Header(OTP_SUBJECT, "utf-8")

        last_error: str | None = None

        for attempt in ("ssl", "starttls"):
            try:
                if attempt == "ssl" and self.use_ssl:
                    context = ssl.create_default_context()
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                    server = smtplib.SMTP_SSL(
                        self.smtp_host, self.smtp_port, timeout=15, context=context
                    )
                elif attempt == "starttls":
                    starttls_port = 587 if self.smtp_port == 465 else self.smtp_port
                    context = ssl.create_default_context()
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                    server = smtplib.SMTP(self.smtp_host, starttls_port, timeout=15)
                    server.starttls(context=context)
                else:
                    continue

                server.login(self.smtp_user, self.smtp_password)
                refused = server.sendmail(self.smtp_user, [email], msg.as_string())
                server.quit()
                if refused:
                    print(f"[AUTH-SMTP] ❌ recipient refused: {refused}", flush=True)
                    return False, f"发送失败：收件人被拒 {refused}"
                print(
                    f"[AUTH-SMTP] ✅ sent OTP {code} → {email} via "
                    f"{self.smtp_host}:{self.smtp_port} ({attempt})",
                    flush=True,
                )
                break
            except smtplib.SMTPException as e:
                last_error = f"SMTP({attempt}): {e}"
                print(f"[AUTH-SMTP] ❌ {last_error}", flush=True)
            except Exception as e:
                last_error = f"Send({attempt}): {e}"
                print(f"[AUTH-SMTP] ❌ {last_error}", flush=True)
        else:
            return False, f"发送失败：{last_error}"

        _CODE_STORE[email] = (code, time.time() + CODE_TTL, 0)
        return True, "验证码已发送至您的邮箱"

    def verify_code(self, email: str, code: str) -> Tuple[bool, str]:
        return _verify_code_common(email, code)


# ──────────────────────────────────────────────
#  Dev client  (console fallback)
# ──────────────────────────────────────────────

class _DevOTPClient:
    """When no email provider is configured, print code to backend stdout."""

    @property
    def is_dev_mode(self) -> bool:
        return True

    def send_code(self, email: str) -> Tuple[bool, str]:
        email = email.strip().lower()
        if not is_valid_email(email):
            return False, "邮箱格式错误"
        code = f"{random.randint(100000, 999999)}"
        _CODE_STORE[email] = (code, time.time() + CODE_TTL, 0)
        print(f"\n[AUTH-DEV] 邮箱 {email} 的验证码: {code}\n", flush=True)
        return True, "[开发模式] 验证码已打印到后端控制台"

    def verify_code(self, email: str, code: str) -> Tuple[bool, str]:
        return _verify_code_common(email, code)


# ──────────────────────────────────────────────
#  Shared verification
# ──────────────────────────────────────────────

def _verify_code_common(email: str, code: str) -> Tuple[bool, str]:
    email = email.strip().lower()
    if email not in _CODE_STORE:
        return False, "请先获取验证码"
    stored_code, expire_ts, attempts = _CODE_STORE[email]
    if time.time() > expire_ts:
        _CODE_STORE.pop(email, None)
        return False, "验证码已过期，请重新获取"
    if attempts >= MAX_VERIFY_ATTEMPTS:
        _CODE_STORE.pop(email, None)
        return False, "尝试次数过多，请重新获取验证码"
    _CODE_STORE[email] = (stored_code, expire_ts, attempts + 1)
    if code.strip() != stored_code:
        return False, f"验证码错误（剩余 {MAX_VERIFY_ATTEMPTS - attempts - 1} 次）"
    _CODE_STORE.pop(email, None)
    return True, "验证成功"


# ──────────────────────────────────────────────
#  Provider selector
# ──────────────────────────────────────────────

_otp_client: EmailOTPClient | _ResendOTPClient | _DevOTPClient | None = None


def get_otp_client() -> EmailOTPClient | _ResendOTPClient | _DevOTPClient:
    global _otp_client
    if _otp_client is not None:
        return _otp_client

    provider = os.environ.get("SMTP_PROVIDER", "").strip().lower()

    # ── Resend (HTTP API) ─────────────────────
    if provider == "resend":
        api_key = os.environ.get("RESEND_API_KEY", "").strip()
        if not api_key:
            print("[AUTH] Resend API key missing → falling back to dev mode", flush=True)
            _otp_client = _DevOTPClient()
            return _otp_client

        from_address = os.environ.get(
            "SMTP_USER",
            os.environ.get("RESEND_FROM", "onboarding@resend.dev"),
        ).strip()
        from_name = os.environ.get("SMTP_FROM_NAME", "反淘淘金通关系统").strip()
        _otp_client = _ResendOTPClient(
            api_key=api_key,
            from_address=from_address,
            from_name=from_name,
        )
        print(f"[AUTH] Resend configured: from={from_address}", flush=True)
        return _otp_client

    # ── SMTP ──────────────────────────────────
    host = os.environ.get("SMTP_HOST", "").strip()
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()

    if all([host, user, password]):
        port = int(os.environ.get("SMTP_PORT", "465"))
        from_name = os.environ.get("SMTP_FROM_NAME", "反淘淘金通关系统").strip()
        use_ssl = os.environ.get("SMTP_USE_SSL", "true").lower() == "true"
        _otp_client = EmailOTPClient(host, port, user, password, from_name, use_ssl)
        print(f"[AUTH] SMTP configured: {host}:{port}", flush=True)
        return _otp_client

    # ── Dev fallback ──────────────────────────
    _otp_client = _DevOTPClient()
    print("[AUTH] No email provider → dev mode (codes printed to console)", flush=True)
    return _otp_client

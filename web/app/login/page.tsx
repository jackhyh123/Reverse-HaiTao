"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authLogin, authSendCode, authVerify } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

/**
 * 防止登录后无限重定向：
 *   - 普通用户尝试去 /admin/* → 改去 /learn
 *   - 否则按 next 走
 */
function computeSafeRedirect(next: string, isAdmin: boolean): string {
  if (!isAdmin && next.startsWith("/admin")) return "/learn";
  return next;
}

type LoginMode = "password" | "otp";

function LoginInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const reason = params.get("reason");
  const { user, loading, setSession } = useAuth();

  const [mode, setMode] = useState<LoginMode>("password");

  // ── password mode ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // ── OTP mode ──
  const [otpEmail, setOtpEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devMode, setDevMode] = useState(false);

  const [message, setMessage] = useState<{ kind: "info" | "error" | "success"; text: string } | null>(null);

  // 已登录直接跳走
  useEffect(() => {
    if (!loading && user) {
      const target = computeSafeRedirect(next, user.is_admin);
      router.replace(target);
    }
  }, [loading, user, router, next]);

  const clearMessage = () => setMessage(null);

  // ── password login ──
  const handlePasswordLogin = async () => {
    if (!email.trim()) {
      setMessage({ kind: "error", text: t("login.emailRequired") });
      return;
    }
    if (!password) {
      setMessage({ kind: "error", text: t("login.passwordRequired") });
      return;
    }
    setLoggingIn(true);
    setMessage(null);
    try {
      const r = await authLogin(email, password);
      setSession(r.user, r.member ?? null);
      setMessage({ kind: "success", text: t("login.success") });
      const target = computeSafeRedirect(next, r.user.is_admin);
      setTimeout(() => router.replace(target), 400);
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoggingIn(false);
    }
  };

  // ── OTP send ──
  const handleSendCode = async () => {
    if (!otpEmail.trim()) {
      setMessage({ kind: "error", text: t("login.emailRequired") });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const r = await authSendCode(otpEmail);
      if (r.success) {
        setOtpStep("code");
        setDevMode(!!r.dev_mode);
        setMessage({
          kind: r.dev_mode ? "info" : "success",
          text: r.message || t("login.codeSent"),
        });
      } else {
        setMessage({ kind: "error", text: r.message });
      }
    } catch (e) {
      setMessage({ kind: "error", text: String(e) });
    } finally {
      setSending(false);
    }
  };

  // ── OTP verify ──
  const handleVerify = async () => {
    if (!code.trim()) {
      setMessage({ kind: "error", text: t("login.codeRequired") });
      return;
    }
    setVerifying(true);
    setMessage(null);
    try {
      const r = await authVerify(otpEmail, code);
      setSession(r.user, r.member ?? null);
      setMessage({ kind: "success", text: t("login.success") });
      const target = computeSafeRedirect(next, r.user.is_admin);
      setTimeout(() => router.replace(target), 400);
    } catch (e) {
      setMessage({ kind: "error", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setVerifying(false);
    }
  };

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setMessage(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-10">
      <div className="w-full max-w-[420px] rounded-3xl border border-[var(--border)]/60 bg-[var(--background)] p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("login.title")}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {t("login.subtitle")}
          </p>
        </div>

        {reason === "admin_required" && (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠️ {t("login.adminRequired")}
          </div>
        )}

        {/* ── Tab switcher ── */}
        <div className="mb-5 flex rounded-2xl bg-[var(--secondary)]/50 p-1">
          <button
            onClick={() => switchMode("password")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
              mode === "password"
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            {t("login.passwordLogin")}
          </button>
          <button
            onClick={() => switchMode("otp")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
              mode === "otp"
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            {t("login.otpLogin")}
          </button>
        </div>

        {/* ── Password login form ── */}
        {mode === "password" && (
          <div className="space-y-3">
            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" />
                {t("login.emailLabel")}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearMessage(); }}
                placeholder="your@email.com"
                onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                autoFocus
              />
            </label>
            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4" />
                {t("login.passwordLabel")}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearMessage(); }}
                placeholder="••••••"
                onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
              />
            </label>
            <button
              onClick={handlePasswordLogin}
              disabled={loggingIn}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {loggingIn && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("login.loginBtn")}
            </button>
            <p className="text-center text-xs text-[var(--muted-foreground)]">
              {t("login.noPasswordYet")}{" "}
              <button
                className="underline hover:text-[var(--foreground)]"
                onClick={() => {
                  setOtpEmail(email);
                  setOtpStep("email");
                  switchMode("otp");
                }}
              >
                {t("login.switchToOtp")}
              </button>
            </p>
          </div>
        )}

        {/* ── OTP login form ── */}
        {mode === "otp" && otpStep === "email" && (
          <div className="space-y-3">
            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" />
                {t("login.emailLabel")}
              </div>
              <input
                type="email"
                value={otpEmail}
                onChange={(e) => { setOtpEmail(e.target.value); clearMessage(); }}
                placeholder="your@email.com"
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                autoFocus
              />
            </label>
            <button
              onClick={handleSendCode}
              disabled={sending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("login.sendCode")}
            </button>
            <p className="text-center text-xs text-[var(--muted-foreground)]">
              {t("login.alreadyHavePassword")}{" "}
              <button
                className="underline hover:text-[var(--foreground)]"
                onClick={() => {
                  setEmail(otpEmail);
                  switchMode("password");
                }}
              >
                {t("login.switchToPassword")}
              </button>
            </p>
          </div>
        )}

        {mode === "otp" && otpStep === "code" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[var(--secondary)]/40 px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {t("login.codeSentTo")} <strong>{otpEmail}</strong>{" "}
              <button
                className="underline hover:text-[var(--foreground)]"
                onClick={() => {
                  setOtpStep("email");
                  setCode("");
                  setMessage(null);
                }}
              >
                {t("login.changeEmail")}
              </button>
            </div>
            {devMode && (
              <div className="rounded-xl border border-blue-300/60 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                🛠️ {t("login.devModeHint")}
              </div>
            )}
            <label className="block">
              <div className="mb-2 text-sm font-medium">
                {t("login.codeLabel")}
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6 位数字"
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none transition-colors focus:border-[var(--primary)]"
                autoFocus
              />
            </label>
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("login.verify")}
            </button>
            <button
              onClick={handleSendCode}
              disabled={sending}
              className="w-full text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {sending ? t("login.resending") : t("login.resend")}
            </button>
            <p className="text-center text-xs text-[var(--muted-foreground)]">
              {t("login.alreadyHavePassword")}{" "}
              <button
                className="underline hover:text-[var(--foreground)]"
                onClick={() => {
                  setEmail(otpEmail);
                  switchMode("password");
                }}
              >
                {t("login.switchToPassword")}
              </button>
            </p>
          </div>
        )}

        {message && (
          <div
            className={`mt-4 rounded-xl px-3 py-2 text-xs ${
              message.kind === "error"
                ? "border border-red-300/60 bg-red-50 text-red-700"
                : message.kind === "success"
                ? "border border-emerald-300/60 bg-emerald-50 text-emerald-700"
                : "border border-blue-300/60 bg-blue-50 text-blue-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-6 text-center text-[10px] text-[var(--muted-foreground)]">
          {t("login.footnote")}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

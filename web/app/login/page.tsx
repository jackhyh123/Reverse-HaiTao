"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authSendCode, authVerify } from "@/lib/auth";
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

function LoginInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const reason = params.get("reason");
  const { user, loading, setSession } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error" | "success"; text: string } | null>(null);
  const [devMode, setDevMode] = useState(false);

  // 已登录直接跳走（注意：避免「→admin→login」死循环——非 admin 想去 admin 时改去 /learn）
  useEffect(() => {
    if (!loading && user) {
      const target = computeSafeRedirect(next, user.is_admin);
      router.replace(target);
    }
  }, [loading, user, router, next]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setMessage({ kind: "error", text: t("login.emailRequired") });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const r = await authSendCode(email);
      if (r.success) {
        setStep("code");
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

  const handleVerify = async () => {
    if (!code.trim()) {
      setMessage({ kind: "error", text: t("login.codeRequired") });
      return;
    }
    setVerifying(true);
    setMessage(null);
    try {
      const r = await authVerify(email, code);
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

        {step === "email" && (
          <div className="space-y-3">
            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" />
                {t("login.emailLabel")}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
          </div>
        )}

        {step === "code" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[var(--secondary)]/40 px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {t("login.codeSentTo")} <strong>{email}</strong>{" "}
              <button
                className="underline hover:text-[var(--foreground)]"
                onClick={() => {
                  setStep("email");
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

"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, ShieldOff, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "@/lib/api";

interface MemberRow {
  email: string;
  created_at: number;
  last_login_at: number;
  login_count: number;
  status: string;
  note?: string;
  auth_sessions_count?: number;
  activity_count?: number;
  last_activity_at?: number | null;
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function fmtRelative(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return `${Math.floor(diff)} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export default function AdminMembersPage() {
  const { t } = useTranslation();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(apiUrl("/api/v1/admin/members"), {
        credentials: "include",
        cache: "no-store",
      });
      if (r.status === 403) {
        setError(t("admin.members.forbidden"));
        return;
      }
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      const data = (await r.json()) as { members: MemberRow[] };
      setMembers(data.members);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {t("admin.members.eyebrow")}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
            {t("admin.members.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("admin.members.subtitle")}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-2 text-sm font-medium hover:bg-[var(--secondary)]/50 disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("admin.overview.refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <ShieldOff className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)]/40 bg-[var(--secondary)]/20 p-6 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("admin.overview.loading")}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)]/60 bg-[var(--secondary)]/20 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" />
          <div className="mt-3 text-sm font-medium">{t("admin.members.empty")}</div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t("admin.members.emptyHint")}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)]/50 bg-[var(--background)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--secondary)]/40 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  {t("admin.members.col.email")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("admin.members.col.status")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("admin.members.col.loginCount")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("admin.members.col.lastLogin")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("admin.members.col.activityCount")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("admin.members.col.created")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {members.map((m) => (
                <tr key={m.email} className="hover:bg-[var(--secondary)]/30">
                  <td className="px-4 py-3 font-medium">{m.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        m.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{m.login_count}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    <div>{fmtRelative(m.last_login_at)}</div>
                    <div className="text-[10px] opacity-60">{fmtTime(m.last_login_at)}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{m.activity_count ?? 0}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {fmtTime(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-[var(--border)]/40 bg-[var(--secondary)]/20 p-4 text-xs text-[var(--muted-foreground)]">
        💡 {t("admin.members.tip")}
      </div>
    </div>
  );
}

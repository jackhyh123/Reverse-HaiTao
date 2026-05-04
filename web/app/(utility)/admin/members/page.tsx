"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, ShieldOff, Users, Plus, X, Crown, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "@/lib/api";

interface MemberRow {
  email: string;
  created_at: number;
  last_login_at: number;
  login_count: number;
  status: string;
  note?: string;
  is_premium?: number;
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
  const [actionError, setActionError] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Add member dialog
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPremium, setNewPremium] = useState(false);
  const [adding, setAdding] = useState(false);

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

  const togglePremium = async (email: string, current: number | undefined) => {
    setActionError("");
    try {
      const r = await fetch(apiUrl(`/api/v1/admin/members/${encodeURIComponent(email)}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_premium: !current }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e) {
      setActionError(String(e));
    }
    setOpenMenu(null);
  };

  const changeStatus = async (email: string, status: string) => {
    setActionError("");
    try {
      const r = await fetch(apiUrl(`/api/v1/admin/members/${encodeURIComponent(email)}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e) {
      setActionError(String(e));
    }
    setOpenMenu(null);
  };

  const deleteMember = async (email: string) => {
    if (!confirm(`确定删除会员 ${email}？`)) return;
    setActionError("");
    try {
      const r = await fetch(apiUrl(`/api/v1/admin/members/${encodeURIComponent(email)}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await refresh();
    } catch (e) {
      setActionError(String(e));
    }
    setOpenMenu(null);
  };

  const handleAdd = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) return;
    setAdding(true);
    setActionError("");
    try {
      const r = await fetch(apiUrl("/api/v1/admin/members"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), status: "active", is_premium: newPremium }),
      });
      if (r.status === 409) {
        setActionError("会员已存在");
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setShowAdd(false);
      setNewEmail("");
      setNewPremium(false);
      await refresh();
    } catch (e) {
      setActionError(String(e));
    } finally {
      setAdding(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            添加会员
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-2 text-sm font-medium hover:bg-[var(--secondary)]/50 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("admin.overview.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <ShieldOff className="h-4 w-4" />
          {error}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          操作失败: {actionError}
        </div>
      )}

      {/* Add member modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowAdd(false)}>
          <div
            className="w-full max-w-md rounded-3xl border border-[var(--border)]/60 bg-[var(--background)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">添加会员</h2>
              <button onClick={() => setShowAdd(false)} className="rounded-xl p-1 hover:bg-[var(--secondary)]/50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-xl border border-[var(--border)]/60 bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/50"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newPremium}
                  onChange={(e) => setNewPremium(e.target.checked)}
                  className="rounded"
                />
                <Crown className="h-4 w-4 text-amber-500" />
                直接开通 Premium
              </label>
              <button
                onClick={handleAdd}
                disabled={adding}
                className="w-full rounded-2xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--background)] hover:opacity-90 disabled:opacity-50"
              >
                {adding ? "添加中..." : "确认添加"}
              </button>
            </div>
          </div>
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
                <th className="px-4 py-3 font-semibold">🏆</th>
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
                <th className="px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {members.map((m) => (
                <tr key={m.email} className="hover:bg-[var(--secondary)]/30">
                  <td className="px-4 py-3">
                    {m.is_premium ? (
                      <span title="Premium"><Crown className="h-4 w-4 text-amber-500" /></span>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">—</span>
                    )}
                  </td>
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
                  <td className="relative px-4 py-3">
                    <button
                      onClick={() => setOpenMenu(openMenu === m.email ? null : m.email)}
                      className="rounded-xl p-1.5 hover:bg-[var(--secondary)]/60"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMenu === m.email && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-4 top-10 z-20 w-44 rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] py-1 shadow-lg">
                          <button
                            onClick={() => togglePremium(m.email, m.is_premium)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--secondary)]/40"
                          >
                            <Crown className="h-4 w-4 text-amber-500" />
                            {m.is_premium ? "取消 Premium" : "开通 Premium"}
                          </button>
                          {m.status === "active" ? (
                            <button
                              onClick={() => changeStatus(m.email, "suspended")}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--secondary)]/40 text-red-600"
                            >
                              停用
                            </button>
                          ) : (
                            <button
                              onClick={() => changeStatus(m.email, "active")}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--secondary)]/40 text-emerald-600"
                            >
                              启用
                            </button>
                          )}
                          <button
                            onClick={() => deleteMember(m.email)}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--secondary)]/40 text-red-500"
                          >
                            删除
                          </button>
                        </div>
                      </>
                    )}
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

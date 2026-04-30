"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BookOpen,
  Cpu,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquareText,
  Network,
  RefreshCcw,
  Server,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";

interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  external?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "admin.nav.overview", icon: LayoutDashboard },
  { href: "/admin/knowledge-graph", label: "admin.nav.knowledgeGraph", icon: Network },
  { href: "/admin/knowledge-sync", label: "admin.nav.knowledgeSync", icon: RefreshCcw },
  { href: "/admin/members", label: "admin.nav.members", icon: Users },
  { href: "/admin/feedback", label: "admin.nav.feedback", icon: MessageSquareText },
  { href: "/admin/system", label: "admin.nav.system", icon: Server },
];

const EXTERNAL_NAV: AdminNavItem[] = [
  { href: "/knowledge", label: "admin.nav.knowledge", icon: BookOpen, external: true },
  { href: "/settings", label: "admin.nav.settings", icon: Cpu, external: true },
  { href: "/curriculum", label: "admin.nav.curriculum", icon: GraduationCap, external: true },
];

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading, logout } = useAuth();

  // ─── Admin Guard ─────────────────────────────────────────────
  // 仅当未登录时跳转到 /login；已登录但不是 admin → 显示「无权限」内联页面
  // （避免出现 login → admin → login 的死循环）
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("admin.guard.checking")}
      </div>
    );
  }

  if (!user.is_admin) {
    // ⚠️ 已登录但不是管理员 —— 不再重定向，给一个带操作的解释页
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-[var(--border)]/60 bg-[var(--background)] p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            🛡️
          </div>
          <h2 className="text-xl font-semibold">需要管理员权限</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            当前账号 <strong>{user.email}</strong> 不是管理员。<br />
            如果你是普通会员，请前往学习页继续学习。
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => router.push("/learn")}
              className="rounded-2xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90"
            >
              去学习页 →
            </button>
            <button
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
              className="rounded-2xl border border-[var(--border)]/60 px-4 py-2 text-sm hover:bg-[var(--secondary)]/40"
            >
              切换账号
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex h-full overflow-hidden">
      {/* 二级侧栏 */}
      <aside className="flex w-[230px] shrink-0 flex-col gap-1 border-r border-[var(--border)]/45 bg-[var(--secondary)]/30 px-3 py-4">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
          {t("admin.sectionLabel")}
        </div>
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold"
                  : "text-[var(--foreground)] hover:bg-[var(--background)]/70"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}

        <div className="mt-6 px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
          {t("admin.sectionLabelExternal")}
        </div>
        {EXTERNAL_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--background)]/70 hover:text-[var(--foreground)]"
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.label)}</span>
              <span className="ml-auto text-[10px] opacity-60">↗</span>
            </Link>
          );
        })}

        {/* 当前管理员 + 注销 */}
        <div className="mt-auto rounded-xl border border-[var(--border)]/50 bg-[var(--background)]/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {t("admin.guard.signedInAs")}
          </div>
          <div className="mt-1 truncate text-xs font-medium" title={user.email}>
            {user.email}
          </div>
          <div className="mt-1 inline-block rounded-md bg-[var(--primary)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)]">
            ADMIN
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)]/60 px-2 py-1.5 text-[11px] hover:bg-[var(--secondary)]/50"
          >
            <LogOut className="h-3 w-3" />
            {t("admin.guard.logout")}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

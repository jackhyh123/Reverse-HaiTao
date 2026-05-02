"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { useAppShell } from "@/context/AppShellContext";
import {
  BookOpen,
  Bot,
  ClipboardList,
  Globe,
  Library,
  MessageSquare,
  MessageSquareText,
  Network,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/branding/BrandMark";
import SidebarSettingsMenu from "@/components/sidebar/SidebarSettingsMenu";
import { VersionBadge } from "@/components/sidebar/VersionBadge";
import { useAuth } from "@/context/AuthContext";
import type { SessionSummary } from "@/lib/session-api";

interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  /** true = 仅管理员可见。普通会员只看到 adminOnly:false 的条目 */
  adminOnly?: boolean;
}

const PRIMARY_NAV: NavEntry[] = [
  { href: "/explore", label: "nav.explore", icon: Globe },
  { href: "/learn", label: "nav.controlCenter", icon: Network },
  { href: "/chat", label: "nav.guidanceChat", icon: MessageSquare, adminOnly: true },
  {
    href: "/agents/seller-launch-coach/chat",
    label: "nav.sellerCoach",
    icon: Bot,
    adminOnly: true,
  },
  {
    href: "/agents/platform-ops-coach/chat",
    label: "nav.operatorCoach",
    icon: Bot,
    adminOnly: true,
  },
  { href: "/curriculum", label: "nav.curriculum", icon: ClipboardList, adminOnly: true },
  // ↓ 普通会员可见的条目
  { href: "/knowledge", label: "nav.knowledgeVault", icon: BookOpen },
  { href: "/book", label: "nav.playbooks", icon: Library },
  { href: "/feedback", label: "nav.feedback", icon: MessageSquareText },
  { href: "/release-notes", label: "nav.releaseNotes", icon: Newspaper },
  { href: "/admin", label: "nav.admin", icon: Shield, adminOnly: true },
];

interface SidebarShellProps {
  sessions?: SessionSummary[];
  activeSessionId?: string | null;
  loadingSessions?: boolean;
  showSessions?: boolean;
  sessionViewportClassName?: string;
  onNewChat?: () => void;
  onSelectSession?: (sessionId: string) => void | Promise<void>;
  onRenameSession?: (sessionId: string, title: string) => void | Promise<void>;
  onDeleteSession?: (sessionId: string) => void | Promise<void>;
  footerSlot?: ReactNode;
}

export function SidebarShell({
  onNewChat,
  footerSlot,
}: SidebarShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { sidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed } =
    useAppShell();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  // 普通会员只看到非 adminOnly 的条目；管理员看全部
  const visibleNav = PRIMARY_NAV.filter((entry) => isAdmin || !entry.adminOnly);
  // 知识图谱学习就是默认首页。
  const logoHref = "/explore";

  const isActivePath = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
      return;
    }
    router.push("/chat");
  };

  /* ---- Collapsed state ---- */
  if (collapsed) {
    return (
      <aside className="group/sb relative flex h-screen w-[60px] shrink-0 flex-col items-center bg-[var(--secondary)] py-3 transition-all duration-200">
        {/* Header: logo + collapse toggle (toggle replaces logo on hover) */}
        <div className="relative mb-2 flex h-9 w-9 items-center justify-center">
          <Link
            href={logoHref}
            aria-label={t("brand.shortName")}
            className="flex items-center justify-center transition-opacity duration-150 group-hover/sb:opacity-0"
          >
            <BrandMark size="sm" className="shadow-none" />
          </Link>
          <button
            onClick={() => setCollapsed(false)}
            className="absolute inset-0 flex items-center justify-center rounded-lg text-[var(--muted-foreground)] opacity-0 transition-all duration-150 hover:bg-[var(--background)]/60 hover:text-[var(--foreground)] group-hover/sb:opacity-100"
            aria-label={t("Expand sidebar")}
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>

        {/* New chat — only for admin */}
        {isAdmin && (
          <button
            onClick={handleNewChat}
            title={t("New Chat") as string}
            className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)]/50 bg-[var(--background)]/40 text-[var(--foreground)] shadow-sm transition-all duration-150 hover:border-[var(--border)] hover:bg-[var(--background)]/80"
            aria-label={t("New Chat")}
          >
            <Plus size={16} strokeWidth={2.2} />
          </button>
        )}

        {/* Subtle divider */}
        {isAdmin && <div className="my-1.5 h-px w-7 bg-[var(--border)]/40" />}

        {/* Primary nav */}
        <nav className="flex w-full flex-col items-center gap-1 px-1.5">
          {visibleNav.map((item) => {
            const active = isActivePath(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={t(item.label) as string}
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 ${
                  active
                    ? "bg-[var(--background)]/80 text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/50 hover:text-[var(--foreground)]"
                }`}
              >
                {active && (
                  <span className="absolute -left-1.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--foreground)]/80" />
                )}
                <item.icon size={18} strokeWidth={active ? 2 : 1.6} />
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Footer */}
        <div className="flex w-full flex-col items-center gap-1 px-1.5">
          <div className="my-1 h-px w-7 bg-[var(--border)]/40" />
          <SidebarSettingsMenu collapsed />
          {footerSlot}
          <VersionBadge collapsed />
        </div>
      </aside>
    );
  }

  /* ---- Expanded state ---- */
  return (
    <aside className="flex w-[220px] h-screen shrink-0 flex-col bg-[var(--secondary)] transition-all duration-200">
      {/* Header: logo + collapse toggle */}
      <div className="flex h-14 items-center justify-between px-4">
        <Link href={logoHref} className="group flex items-center gap-2">
          <BrandMark size="sm" className="transition-transform duration-200 group-hover:scale-105" />
          <span className="max-w-[138px] truncate text-[16px] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
            {t("brand.shortName")}
          </span>
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          aria-label={t("Collapse sidebar")}
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* Primary nav */}
      <nav className="px-2 pt-1">
        <div className="space-y-px">
          {/* New chat — only for admin */}
          {isAdmin && (
            <button
              onClick={handleNewChat}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--background)]/60 hover:text-[var(--foreground)]"
            >
              <Plus size={16} strokeWidth={2} />
              <span>{t("New Chat")}</span>
            </button>
          )}

          {visibleNav.map((item) => {
            const active = isActivePath(item.href);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                    active
                      ? "bg-[var(--background)]/70 font-medium text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/50 hover:text-[var(--foreground)]"
                  }`}
                >
                  <item.icon size={16} strokeWidth={active ? 1.9 : 1.5} />
                  <span>{t(item.label)}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="border-t border-[var(--border)]/40 px-2 py-2">
        <SidebarSettingsMenu />
        {footerSlot}
        <div className="mt-0.5 flex items-center">
          <VersionBadge />
        </div>
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Languages,
  Loader2,
  LogOut,
  Palette,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppShell } from "@/context/AppShellContext";
import { useAuth } from "@/context/AuthContext";
import type { Theme } from "@/lib/theme";

interface SidebarSettingsMenuProps {
  /** Sidebar 折叠时只显示图标按钮，弹层向右 */
  collapsed?: boolean;
}

const THEME_OPTIONS: Array<{ value: Theme; labelKey: string; emoji: string }> = [
  { value: "light", labelKey: "settings.theme.light", emoji: "☀️" },
  { value: "dark", labelKey: "settings.theme.dark", emoji: "🌙" },
  { value: "glass", labelKey: "settings.theme.glass", emoji: "🪟" },
  { value: "snow", labelKey: "settings.theme.snow", emoji: "❄️" },
];

export default function SidebarSettingsMenu({
  collapsed = false,
}: SidebarSettingsMenuProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, setLanguage, theme, setTheme } = useAppShell();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => {
    if (!window.confirm(t("确认退出当前账号？"))) return;
    setLoggingOut(true);
    try {
      await logout();
      setOpen(false);
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  // 点外面关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${collapsed ? "" : "w-full"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          collapsed
            ? `flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                open
                  ? "bg-[var(--background)]/80 text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/50 hover:text-[var(--foreground)]"
              }`
            : `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                open
                  ? "bg-[var(--background)]/70 text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/50 hover:text-[var(--foreground)]"
              }`
        }
        title={t("settings.title") as string}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Settings size={collapsed ? 18 : 16} strokeWidth={1.6} />
        {!collapsed && <span>{t("settings.title")}</span>}
      </button>

      {open && (
        <div
          role="menu"
          className={
            collapsed
              ? "absolute bottom-0 left-[calc(100%+8px)] z-50 w-[280px] rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-3 shadow-2xl"
              : "absolute bottom-[calc(100%+6px)] left-0 z-50 w-[260px] rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-3 shadow-2xl"
          }
        >
          {/* 语言 */}
          <SectionHeader icon={<Languages className="h-3 w-3" />}>
            {t("settings.language")}
          </SectionHeader>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-[var(--secondary)]/40 p-1">
            {(["zh", "en"] as const).map((code) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  language === code
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                aria-pressed={language === code}
              >
                {code === "zh"
                  ? t("language.chinese")
                  : t("language.english")}
              </button>
            ))}
          </div>

          {/* 主题 */}
          <div className="mt-3">
            <SectionHeader icon={<Palette className="h-3 w-3" />}>
              {t("settings.theme.title")}
            </SectionHeader>
            <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-xl bg-[var(--secondary)]/40 p-1">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors ${
                    theme === opt.value
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                  aria-pressed={theme === opt.value}
                  title={t(opt.labelKey) as string}
                >
                  <span className="text-base leading-none">{opt.emoji}</span>
                  <span>{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 高级设置（admin 入口） */}
          {user?.is_admin && (
            <>
              <div className="my-3 h-px bg-[var(--border)]/40" />
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50 hover:text-[var(--foreground)]"
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>{t("settings.advanced")}</span>
                <span className="ml-auto text-[9px] opacity-50">↗</span>
              </Link>
            </>
          )}

          {user && (
            <>
              <div className="my-3 h-px bg-[var(--border)]/40" />
              <div className="mb-2 rounded-xl bg-[var(--secondary)]/30 px-2.5 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t("当前账号")}
                </div>
                <div className="mt-1 truncate text-xs font-medium text-[var(--foreground)]">
                  {user.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                {loggingOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span>{loggingOut ? t("正在注销…") : t("注销登录")}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
      {icon}
      {children}
    </div>
  );
}

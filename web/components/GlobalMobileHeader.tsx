"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Compass,
  GraduationCap,
  Home,
  Languages,
  Library,
  Menu,
  MessageSquareText,
  Newspaper,
  Palette,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/branding/BrandMark";
import { useAppShell } from "@/context/AppShellContext";
import type { Theme } from "@/lib/theme";

interface MobileNavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MOBILE_NAV: MobileNavEntry[] = [
  { href: "/", label: "首页", icon: Home },
  { href: "/explore", label: "生态图谱", icon: Compass },
  { href: "/learn", label: "学习中心", icon: GraduationCap },
  { href: "/book", label: "通关手册", icon: Library },
  { href: "/feedback", label: "你想说啥", icon: MessageSquareText },
  { href: "/release-notes", label: "更新了啥", icon: Newspaper },
];

const THEME_OPTIONS: Array<{ value: Theme; label: string; emoji: string }> = [
  { value: "light", label: "白天", emoji: "☀️" },
  { value: "dark", label: "黑夜", emoji: "🌙" },
  { value: "glass", label: "玻璃", emoji: "🪟" },
  { value: "snow", label: "雪白", emoji: "❄️" },
];

export default function GlobalMobileHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { language, setLanguage, theme, setTheme } = useAppShell();

  const isActivePath = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* ── Sticky header bar ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between border-b px-4 py-2 md:hidden"
        style={{
          background: "var(--background)",
          borderColor: "var(--border)",
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size="sm" className="shadow-none" />
          <span
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            反淘淘金通关系统
          </span>
        </Link>

        <button
          onClick={() => setOpen((p) => !p)}
          className="-mr-1.5 rounded-lg p-1.5"
          aria-label={open ? "关闭菜单" : "打开菜单"}
        >
          {open ? (
            <X className="h-5 w-5" style={{ color: "var(--foreground)" }} />
          ) : (
            <Menu className="h-5 w-5" style={{ color: "var(--foreground)" }} />
          )}
        </button>
      </header>

      {/* ── Menu overlay ── */}
      <div
        className={`fixed inset-0 z-30 transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Slide-down card */}
        <div
          className={`absolute top-0 left-0 right-0 rounded-b-2xl border-b shadow-xl transition-transform duration-300 ease-out ${
            open ? "translate-y-0" : "-translate-y-full"
          }`}
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pt-14 pb-2">
            <nav className="flex flex-col gap-1">
              {MOBILE_NAV.map((item) => {
                const active = isActivePath(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors active:bg-[var(--secondary)]"
                    style={{
                      color: active
                        ? "var(--foreground)"
                        : "var(--muted-foreground)",
                      fontWeight: active ? 700 : 500,
                      background: active
                        ? "var(--secondary)"
                        : "transparent",
                    }}
                  >
                    <item.icon
                      className="h-5 w-5"
                      style={{
                        color: active
                          ? "var(--primary)"
                          : "var(--muted-foreground)",
                      }}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* ── Language & Theme Controls ── */}
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              {/* Language */}
              <div className="flex items-center gap-2 px-3">
                <Languages className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  语言
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-[var(--secondary)]/40 p-1 mx-3">
                {(["zh", "en"] as const).map((code) => (
                  <button
                    key={code}
                    onClick={() => setLanguage(code)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      language === code
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {code === "zh" ? "中文" : "English"}
                  </button>
                ))}
              </div>

              {/* Theme */}
              <div className="mt-3 flex items-center gap-2 px-3">
                <Palette className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  主题
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-xl bg-[var(--secondary)]/40 p-1 mx-3">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors ${
                      theme === opt.value
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    <span className="text-base leading-none">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Gradient fade at bottom */}
          <div
            className="h-8"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--background))",
            }}
          />
        </div>
      </div>
    </>
  );
}

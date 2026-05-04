"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Compass,
  GraduationCap,
  Home,
  Library,
  Menu,
  MessageSquareText,
  Newspaper,
  X,
  type LucideIcon,
} from "lucide-react";

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

export default function MobileUtilityNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActivePath = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* ── Hamburger trigger (top-right, fixed) ── */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="fixed top-0 right-0 z-50 p-3 md:hidden"
        aria-label={open ? "关闭菜单" : "打开菜单"}
      >
        {open ? (
          <X className="h-5 w-5" style={{ color: "var(--foreground)" }} />
        ) : (
          <Menu className="h-5 w-5" style={{ color: "var(--foreground)" }} />
        )}
      </button>

      {/* ── Menu overlay (always mounted for enter/exit transition) ── */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 md:hidden ${
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

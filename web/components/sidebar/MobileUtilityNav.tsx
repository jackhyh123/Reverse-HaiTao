"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Compass,
  Globe,
  Library,
  MessageSquareText,
  Network,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

interface MobileNavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MOBILE_NAV: MobileNavEntry[] = [
  { href: "/", label: "首页", icon: Network },
  { href: "/explore", label: "生态图谱", icon: Globe },
  { href: "/knowledge", label: "知识来源", icon: BookOpen },
  { href: "/book", label: "通关手册", icon: Library },
  { href: "/feedback", label: "你想说啥", icon: MessageSquareText },
  { href: "/release-notes", label: "更新了啥", icon: Newspaper },
];

export default function MobileUtilityNav() {
  const pathname = usePathname();

  const isActivePath = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="border-b border-[var(--border)]/50 bg-[var(--background)]/92 px-2 py-2 backdrop-blur md:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MOBILE_NAV.map((item) => {
          const active = isActivePath(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)]/70 bg-[var(--secondary)]/30 text-[var(--muted-foreground)]"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

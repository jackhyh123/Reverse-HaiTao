"use client";

import { BookOpen, GitBranch, LayoutGrid } from "lucide-react";

export type ViewMode = "panel" | "ecosystem" | "graph";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

const MODES: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: "panel", icon: <BookOpen className="h-3.5 w-3.5" />, label: "学习" },
  { id: "ecosystem", icon: <LayoutGrid className="h-3.5 w-3.5" />, label: "生态" },
  { id: "graph", icon: <GitBranch className="h-3.5 w-3.5" />, label: "图谱" },
];

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      className="flex shrink-0 rounded-full border-2 border-[var(--border)]/60 p-0.5"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}
    >
      {MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all duration-200 ${
            value === mode.id
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_2px_8px_rgba(176,80,30,0.3)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          {mode.icon}
          <span className="hidden sm:inline">{mode.label}</span>
        </button>
      ))}
    </div>
  );
}

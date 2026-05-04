"use client";

import { memo, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  PlayCircle,
} from "lucide-react";
import type { GraphNode } from "@/lib/knowledge-graph";
import type { RegionId } from "@/lib/ecosystem";

type LocaleKey = "zh" | "en";
type NodeStatus = "mastered" | "unlocked" | "locked";

const STATUS_TEXT: Record<NodeStatus, { zh: string; en: string }> = {
  mastered: { zh: "已掌握", en: "Mastered" },
  unlocked: { zh: "学习中", en: "Learning" },
  locked: { zh: "待解锁", en: "Locked" },
};

const STATUS_ICON: Record<NodeStatus, typeof CheckCircle2> = {
  mastered: CheckCircle2,
  unlocked: PlayCircle,
  locked: Lock,
};

interface EcosystemCardProps {
  node: GraphNode;
  regionId: RegionId;
  regionColor: string;
  status: NodeStatus;
  stepNumber: number;
  isHovered: boolean;
  isActive: boolean;
  isSelected: boolean;
  isConnected: boolean;
  isDimmed: boolean;
  locale: LocaleKey;
  onHover: (nodeId: string | null) => void;
  onClick: (node: GraphNode) => void;
}

function EcosystemCardInner({
  node,
  regionId,
  regionColor,
  status,
  stepNumber,
  isHovered,
  isActive,
  isSelected,
  isConnected,
  isDimmed,
  locale,
  onHover,
  onClick,
}: EcosystemCardProps) {
  const StatusIcon = STATUS_ICON[status];
  const statusLabel = STATUS_TEXT[status][locale];

  const visibleTags = (node.tags || [])
    .filter((t) => !["foundation", "review"].includes(t))
    .slice(0, isActive ? 4 : 2);

  const handleMouseEnter = useCallback(() => {
    onHover(node.id);
  }, [node.id, onHover]);

  const handleMouseLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);

  const handleClick = useCallback(() => {
    onClick(node);
  }, [node, onClick]);

  // Status dot color
  const dotColor =
    status === "mastered"
      ? "bg-emerald-400"
      : status === "unlocked"
        ? "bg-amber-400"
        : "bg-slate-300 dark:bg-slate-600";

  return (
    <div
      className={`ecosystem-card group relative cursor-pointer select-none transition-all duration-300 ${
        isDimmed && !isHovered && !isActive ? "opacity-40" : "opacity-100"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        // Claymorphism card style
        borderRadius: 18,
        border: "2px solid var(--border)",
        background: "var(--card)",
        boxShadow: isActive
          ? `inset 0 1px 0 rgba(255,255,255,0.6), 0 0 0 3px ${regionColor}22, 0 12px 40px rgba(0,0,0,0.12)`
          : isHovered || isConnected
            ? `inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)`
            : "inset 0 1px 0 rgba(255,255,255,0.5), 0 3px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        borderColor: isHovered || isActive
          ? regionColor
          : isConnected
            ? `${regionColor}66`
            : undefined,
        transform: isActive
          ? "scale(1.03)"
          : isHovered
            ? "translateY(-3px)"
            : undefined,
        zIndex: isActive ? 100 : isHovered ? 50 : 1,
      }}
    >
      {/* Region accent stripe */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-[16px]"
        style={{ background: regionColor, opacity: isHovered || isActive ? 1 : 0.4 }}
      />

      {/* Collapsed view (default) */}
      <div className={`flex items-center gap-2.5 px-4 py-3 ${isActive ? "hidden" : ""}`}>
        {/* Status dot */}
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
        {/* Step number */}
        <span className="text-[10px] font-bold text-[var(--muted-foreground)] tabular-nums w-5 shrink-0">
          {String(stepNumber).padStart(2, "0")}
        </span>
        {/* Title */}
        <span className="flex-1 truncate text-[13px] font-bold leading-tight text-[var(--foreground)]">
          {node.title[locale]}
        </span>
        {/* Tags */}
        <div className="hidden shrink-0 gap-1 sm:flex">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border)]/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded view (active) */}
      <div className={`px-4 py-3.5 ${isActive ? "" : "hidden"}`}>
        {/* Header row */}
        <div className="flex items-center gap-2.5">
          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
          <span className="text-[10px] font-bold text-[var(--muted-foreground)] tabular-nums">
            {String(stepNumber).padStart(2, "0")}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
            style={{
              borderColor: `${regionColor}40`,
              backgroundColor: `${regionColor}10`,
              color: regionColor,
            }}
          >
            <StatusIcon className="h-3 w-3" />
            {statusLabel}
          </span>
        </div>

        {/* Title */}
        <div className="mt-2 text-[15px] font-extrabold leading-snug text-[var(--foreground)]">
          {node.title[locale]}
        </div>

        {/* Summary */}
        <div className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          {node.summary[locale]}
        </div>

        {/* Footer row */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)]/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {node.estimated_minutes}m
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {(node.resources || []).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const EcosystemCard = memo(EcosystemCardInner);

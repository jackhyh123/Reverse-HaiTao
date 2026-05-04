"use client";

import { BookOpen, ChevronDown, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { FocusDirectionId, FlowStageId } from "@/lib/ecosystem-data";
import { FOCUS_DIRECTIONS } from "@/lib/ecosystem-data";
import AchievementBadges from "./AchievementBadges";
import ViewToggle from "./ViewToggle";

type ViewMode = "panel" | "ecosystem" | "graph";

interface LearnTopBarProps {
  currentStage: FlowStageId;
  currentFocus: FocusDirectionId;
  onFocusChange: (focus: FocusDirectionId) => void;
  masteredCount: number;
  totalCount: number;
  streak: number;
  onRediagnose: () => void;
  onReset: () => void;
  diagnosticMode: "none" | "banner" | "subtle";
  diagnosticLevelLabel?: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  locale: "zh" | "en";
  isLoggedIn: boolean;
  isMobile: boolean;
  // Achievement badge conditions
  foundationMastered: boolean;
  sellerTrackMastered: boolean;
  operatorTrackMastered: boolean;
  allMastered: boolean;
  notesNodeCount: number;
}

export default function LearnTopBar({
  currentStage: _currentStage,
  currentFocus,
  onFocusChange,
  masteredCount,
  totalCount,
  streak,
  onRediagnose,
  onReset,
  diagnosticMode: _diagnosticMode,
  diagnosticLevelLabel,
  viewMode,
  onViewModeChange,
  locale,
  isLoggedIn,
  isMobile,
  foundationMastered,
  sellerTrackMastered,
  operatorTrackMastered,
  allMastered,
  notesNodeCount,
}: LearnTopBarProps) {
  const [focusOpen, setFocusOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!focusOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFocusOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [focusOpen]);

  const currentFocusLabel =
    FOCUS_DIRECTIONS.find((fd) => fd.id === currentFocus)?.shortLabel ?? "全部";

  return (
    <div
      className="shrink-0 border-b-2 border-[var(--border)]/50 bg-[var(--background)]/95 px-3 py-2.5 md:px-5 md:py-3"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 12px rgba(120,100,80,0.06)",
      }}
    >
      {/* Row 1: Title + badges */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 md:flex-none">
          <div className="flex items-center gap-3">
            <h1
              className="truncate text-lg font-extrabold tracking-tight text-[var(--foreground)] md:text-xl"
              style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}
            >
              <BookOpen className="mr-1.5 inline h-5 w-5 text-[var(--primary)]" />
              学习行动中心
            </h1>
            <div className="hidden text-xs font-medium text-[var(--muted-foreground)] md:block">
              反淘淘金通关系统
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs">
          {/* Streak badge */}
          {streak > 0 && isLoggedIn && (
            <span
              className="hidden items-center gap-1 rounded-full border-2 border-amber-200 bg-amber-50/80 px-2.5 py-1 text-[11px] font-bold text-amber-700 md:inline-flex dark:border-amber-500/20 dark:bg-amber-400/10 dark:text-amber-300"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)" }}
            >
              🔥 {streak} 天
            </span>
          )}

          {/* Progress badge */}
          <span
            className="rounded-full border-2 border-[var(--border)]/60 bg-[var(--card)]/90 px-2.5 py-1 text-[11px] font-bold text-[var(--foreground)]"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)" }}
          >
            {isLoggedIn ? `${masteredCount}/${totalCount} 已掌握` : "公测中"}
          </span>

          {/* Achievement badges */}
          {isLoggedIn && (
            <AchievementBadges
              locale={locale}
              masteredCount={masteredCount}
              foundationMastered={foundationMastered}
              sellerTrackMastered={sellerTrackMastered}
              operatorTrackMastered={operatorTrackMastered}
              allMastered={allMastered}
              notesNodeCount={notesNodeCount}
            />
          )}

          {/* Diagnostic level label */}
          {diagnosticLevelLabel && (
            <span
              className="hidden items-center gap-1 rounded-full border-2 border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-bold text-emerald-700 md:inline-flex dark:border-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)" }}
            >
              {diagnosticLevelLabel}
            </span>
          )}

          {/* Reset button */}
          {isLoggedIn && !isMobile && (
            <button
              onClick={onReset}
              title="重置进度"
              className="clay-btn p-1.5 text-[var(--muted-foreground)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Re-diagnose button */}
          <button
            onClick={onRediagnose}
            title="重新诊断水平"
            className="clay-btn px-2.5 py-1 text-[11px] font-bold text-[var(--muted-foreground)]"
          >
            重新诊断
          </button>
        </div>
      </div>

      {/* Row 2: Focus direction dropdown + view toggle */}
      <div className="mt-2.5 flex items-center gap-2 md:mt-2">
        {/* Focus direction dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setFocusOpen(!focusOpen)}
            className="flex items-center gap-1 rounded-full border-2 border-[var(--border)]/60 bg-[var(--card)]/90 px-3 py-1.5 text-[11px] font-bold text-[var(--foreground)] transition-all hover:border-[var(--primary)]/30"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)" }}
          >
            <span className="text-[var(--muted-foreground)]">关注方向:</span>
            <span className="text-[var(--primary)]">{currentFocusLabel}</span>
            <ChevronDown
              className={`ml-0.5 h-3 w-3 text-[var(--muted-foreground)] transition-transform ${
                focusOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {focusOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-xl border-2 border-[var(--border)]/60 bg-[var(--card)] py-1 shadow-lg"
              style={{ boxShadow: "0 8px 32px rgba(15,23,42,0.12)" }}
            >
              {FOCUS_DIRECTIONS.map((fd) => (
                <button
                  key={fd.id}
                  onClick={() => {
                    onFocusChange(fd.id);
                    setFocusOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--secondary)]/60 ${
                    fd.id === currentFocus
                      ? "text-[var(--primary)]"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {fd.id === currentFocus && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  )}
                  {!fd.id && <span className="w-1.5" />}
                  <span>{fd.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View mode toggle — pushed to right */}
        <div className="ml-auto shrink-0">
          <ViewToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>
    </div>
  );
}

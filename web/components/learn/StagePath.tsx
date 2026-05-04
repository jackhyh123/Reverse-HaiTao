"use client";

import { Lock, CheckCircle2, Play, Circle } from "lucide-react";
import type { FlowStageId, FlowStageDef } from "@/lib/ecosystem-data";
import { FLOW_STAGES, STAGE_ORDER } from "@/lib/ecosystem-data";
import type { StageStatus } from "@/lib/node-recommender";

interface StagePathProps {
  currentStage: FlowStageId;
  stageStatuses: Record<string, StageStatus>;
  onStageSelect: (stage: FlowStageId) => void;
  locale: "zh" | "en";
}

const STAGE_MAP: Map<FlowStageId, FlowStageDef> = new Map(
  FLOW_STAGES.map((s) => [s.id, s]),
);

const STATUS_ICON: Record<StageStatus, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4" />,
  in_progress: <Play className="h-4 w-4" />,
  available: <Circle className="h-4 w-4" />,
  locked: <Lock className="h-4 w-4" />,
};

export default function StagePath({
  currentStage,
  stageStatuses,
  onStageSelect,
  locale,
}: StagePathProps) {
  return (
    <div className="shrink-0 overflow-x-auto border-b border-[var(--border)]/40 bg-[var(--background)]/80 px-3 py-2.5 md:px-5 md:py-3">
      {/* Desktop: horizontal progression with arrows */}
      <div className="hidden items-center justify-center gap-0 md:flex">
        {STAGE_ORDER.map((stageId, idx) => {
          const stageDef = STAGE_MAP.get(stageId);
          const status: StageStatus = stageStatuses[stageId] ?? "locked";
          const isActive = stageId === currentStage;

          const stageTitle =
            locale === "zh"
              ? stageDef?.title.zh ?? stageId
              : stageDef?.title.en ?? stageId;
          const stageColor = stageDef?.color ?? "#6b7280";

          return (
            <div key={stageId} className="flex items-center">
              {/* Connector arrow (not before first) */}
              {idx > 0 && (
                <div className="mx-1 h-0.5 w-6 rounded-full bg-[var(--border)]/60" />
              )}

              <button
                onClick={() => {
                  if (status !== "locked") onStageSelect(stageId);
                }}
                disabled={status === "locked"}
                className={`group flex items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 shadow-sm"
                    : status === "locked"
                      ? "cursor-not-allowed border-[var(--border)]/30 bg-[var(--secondary)]/10 opacity-50"
                      : "border-transparent bg-transparent hover:border-[var(--border)]/40 hover:bg-[var(--secondary)]/20"
                }`}
                style={
                  isActive
                    ? {
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 0 0 1px ${stageColor}20`,
                      }
                    : undefined
                }
              >
                {/* Status icon */}
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                    status === "completed"
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : status === "in_progress"
                        ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                        : "bg-[var(--secondary)]/20 text-[var(--muted-foreground)]"
                  }`}
                >
                  {STATUS_ICON[status]}
                </span>

                {/* Stage label */}
                <span
                  className={
                    isActive
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)]"
                  }
                >
                  {stageTitle}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Mobile: horizontally scrollable pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
        {STAGE_ORDER.map((stageId) => {
          const stageDef = STAGE_MAP.get(stageId);
          const status: StageStatus = stageStatuses[stageId] ?? "locked";
          const isActive = stageId === currentStage;
          const stageColor = stageDef?.color ?? "#6b7280";

          const stageTitle =
            locale === "zh"
              ? stageDef?.title.zh ?? stageId
              : stageDef?.title.en ?? stageId;

          return (
            <button
              key={stageId}
              onClick={() => {
                if (status !== "locked") onStageSelect(stageId);
              }}
              disabled={status === "locked"}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all ${
                isActive
                  ? "border-[var(--primary)]/40 bg-[var(--primary)]/10"
                  : status === "locked"
                    ? "cursor-not-allowed border-[var(--border)]/20 opacity-40"
                    : "border-transparent bg-[var(--secondary)]/10"
              }`}
              style={
                isActive
                  ? {
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 0 0 1px ${stageColor}20`,
                    }
                  : undefined
              }
            >
              <span
                className={
                  status === "completed"
                    ? "text-emerald-500"
                    : status === "in_progress"
                      ? "text-[var(--primary)]"
                      : "text-[var(--muted-foreground)]"
                }
              >
                {status === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : status === "in_progress" ? (
                  <Play className="h-3.5 w-3.5" />
                ) : status === "locked" ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
              </span>
              <span
                className={
                  isActive
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)]"
                }
              >
                {stageTitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

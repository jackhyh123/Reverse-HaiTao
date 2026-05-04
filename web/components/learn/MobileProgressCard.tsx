"use client";

import type { GraphNode } from "@/lib/knowledge-graph";

export function MobileProgressCard({
  trackNodes,
  masteredIds,
  masteredCount,
  trackColor,
}: {
  trackNodes: GraphNode[];
  masteredIds: Set<string>;
  masteredCount: number;
  trackColor: string;
}) {
  const totalCount = trackNodes.length;
  const pct = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100);

  const currentStepIndex = trackNodes.findIndex(
    (n) => !masteredIds.has(n.id) && n.prerequisites.every((p) => masteredIds.has(p)),
  );
  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : totalCount;
  const allMastered = masteredCount >= totalCount && totalCount > 0;

  return (
    <div className="shrink-0 border-b border-[var(--border)]/40 bg-[var(--secondary)]/10 px-4 py-2 md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1.5 min-w-0">
          {allMastered ? (
            <span className="text-xs font-bold text-emerald-600">🎉 全部通关</span>
          ) : (
            <>
              <span className="text-sm font-black whitespace-nowrap">
                第 {currentStep}/{totalCount} 步
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                · {pct}%
              </span>
            </>
          )}
        </div>

        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]/60">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: trackColor }}
          />
        </div>

        <span className="shrink-0 text-xs font-semibold text-[var(--muted-foreground)]">
          {masteredCount}/{totalCount}
        </span>
      </div>
      {!allMastered && currentStepIndex >= 0 && (
        <div className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">
          下一步：<span className="font-medium text-[var(--foreground)]">{trackNodes[currentStepIndex]?.title?.zh || ""}</span>
        </div>
      )}
    </div>
  );
}

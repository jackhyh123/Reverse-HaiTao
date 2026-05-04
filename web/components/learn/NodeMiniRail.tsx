"use client";

import type { GraphNode } from "@/lib/knowledge-graph";

type LocaleKey = "zh" | "en";

/** Desktop: vertical numbered pill rail on the left edge */
export function NodeMiniRail({
  nodes,
  selectedNodeId,
  masteredIds,
  locale,
  onSelect,
}: {
  nodes: GraphNode[];
  selectedNodeId: string;
  masteredIds: Set<string>;
  locale: LocaleKey;
  onSelect: (node: GraphNode) => void;
}) {
  return (
    <nav className="pointer-events-none absolute left-4 top-1/2 z-30 hidden max-h-[72vh] -translate-y-1/2 md:block">
      <div className="pointer-events-auto flex flex-col gap-2 overflow-y-auto rounded-[22px] border border-[var(--border)]/55 bg-[var(--background)]/70 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        {nodes.map((node, index) => {
          const active = node.id === selectedNodeId;
          const mastered = masteredIds.has(node.id);
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              title={node.title[locale]}
              className={`group flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-black transition-all ${
                active
                  ? "scale-110 border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg"
                  : mastered
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-[var(--primary)]"
                    : "border-[var(--border)]/65 bg-[var(--card)]/80 text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
              }`}
            >
              {index + 1}
              <span className="pointer-events-none absolute left-14 hidden max-w-[220px] rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] px-3 py-2 text-left text-xs font-semibold text-[var(--foreground)] shadow-xl group-hover:block">
                {node.title[locale]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobile: horizontal scrollable pill strip */
export function NodeMiniStrip({
  nodes,
  selectedNodeId,
  masteredIds,
  locale,
  onSelect,
}: {
  nodes: GraphNode[];
  selectedNodeId: string;
  masteredIds: Set<string>;
  locale: LocaleKey;
  onSelect: (node: GraphNode) => void;
}) {
  return (
    <nav className="shrink-0 border-b border-[var(--border)]/45 bg-[var(--background)]/92 px-3 py-2 backdrop-blur md:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {nodes.map((node, index) => {
          const active = node.id === selectedNodeId;
          const mastered = masteredIds.has(node.id);
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              className={`flex min-w-[92px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : mastered
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-[var(--border)]/65 bg-[var(--secondary)]/25 text-[var(--muted-foreground)]"
              }`}
              title={node.title[locale]}
            >
              <span>{index + 1}</span>
              <span className="truncate">{node.title[locale]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

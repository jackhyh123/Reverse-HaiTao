"use client";

import { memo } from "react";
import {
  Database,
  Globe,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { EcosystemCard } from "./EcosystemCard";
import type { GraphNode } from "@/lib/knowledge-graph";
import type { RegionDefinition, RegionId } from "@/lib/ecosystem";

type LocaleKey = "zh" | "en";
type NodeStatus = "mastered" | "unlocked" | "locked";

const REGION_ICONS: Record<string, typeof Globe> = {
  Globe,
  ShoppingCart,
  Truck,
  Database,
};

interface EcosystemRegionProps {
  region: RegionDefinition;
  nodes: GraphNode[];
  hoveredNodeId: string | null;
  activeCardId: string | null;
  selectedNodeId: string | null;
  masteredIds: Set<string>;
  connectedNodeIds: Set<string>;
  locale: LocaleKey;
  onCardHover: (nodeId: string | null) => void;
  onCardClick: (node: GraphNode) => void;
}

function EcosystemRegionInner({
  region,
  nodes,
  hoveredNodeId,
  activeCardId,
  selectedNodeId,
  masteredIds,
  connectedNodeIds,
  locale,
  onCardHover,
  onCardClick,
}: EcosystemRegionProps) {
  const IconComp = REGION_ICONS[region.icon] || Database;
  const isEmpty = nodes.length === 0;

  // Sort nodes: mastered last, then by step order (based on position in array)
  const sorted = [...nodes];

  // Find active card index and split
  const activeIndex = activeCardId
    ? sorted.findIndex((n) => n.id === activeCardId)
    : -1;
  const activeNode = activeIndex >= 0 ? sorted[activeIndex] : null;

  // Build display list: active card at top, then rest in original order
  const displayNodes = activeNode
    ? [activeNode, ...sorted.filter((n) => n.id !== activeCardId)]
    : sorted;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[22px]"
      style={{
        border: `2px solid ${region.color}18`,
        background: "var(--card)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* Region header */}
      <div
        className="flex shrink-0 items-center gap-2 px-4 py-3"
        style={{
          borderBottom: `1px solid ${region.color}18`,
          background: `${region.color}08`,
        }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${region.color}15`,
            color: region.color,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        >
          <IconComp className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-[var(--foreground)]">
            {region.label[locale]}
          </div>
          <div className="truncate text-[10px] text-[var(--muted-foreground)]">
            {isEmpty
              ? locale === "zh"
                ? "暂无节点"
                : "No nodes yet"
              : region.description[locale]}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: `${region.color}12`,
            color: region.color,
          }}
        >
          {nodes.length}
        </span>
      </div>

      {/* Card stack */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {isEmpty ? (
          <div
            className="flex h-full min-h-[120px] items-center justify-center rounded-[16px] border-2 border-dashed p-4 text-center"
            style={{ borderColor: `${region.color}25` }}
          >
            <span className="text-[11px] text-[var(--muted-foreground)]">
              {locale === "zh" ? "该区域暂无知识点" : "No knowledge points in this region"}
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {displayNodes.map((node, displayIdx) => {
              const status: NodeStatus = masteredIds.has(node.id)
                ? "mastered"
                : "unlocked";

              const isActive = node.id === activeCardId;
              const isHovered = node.id === hoveredNodeId;
              const isConnected = connectedNodeIds.has(node.id);
              const isSelected = node.id === selectedNodeId;

              // Dim cards that are not connected when something is hovered
              const isDimmed =
                hoveredNodeId !== null &&
                hoveredNodeId !== node.id &&
                !connectedNodeIds.has(node.id);

              // Stacking: negative margin for collapsed cards
              const isStacked = !isActive && displayIdx > 0;
              const stackOffset = -46; // negative margin to overlap

              return (
                <div
                  key={node.id}
                  className={`transition-all duration-300 ${
                    isStacked ? "-mt-[46px]" : "mt-2"
                  }`}
                  style={{
                    zIndex: isActive ? 100 : isHovered ? 50 : displayNodes.length - displayIdx,
                  }}
                >
                  <EcosystemCard
                    node={node}
                    regionId={region.id}
                    regionColor={region.color}
                    status={status}
                    stepNumber={isActive ? displayIdx + 1 : sorted.indexOf(node) + 1}
                    isHovered={isHovered}
                    isActive={isActive}
                    isSelected={isSelected}
                    isConnected={isConnected}
                    isDimmed={isDimmed}
                    locale={locale}
                    onHover={onCardHover}
                    onClick={onCardClick}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const EcosystemRegion = memo(EcosystemRegionInner);

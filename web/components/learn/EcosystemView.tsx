"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { EcosystemRegion } from "./EcosystemRegion";
import EcosystemConnections from "./EcosystemConnections";
import {
  getCrossRegionConnections,
  groupNodesByRegion,
  REGIONS,
  type CrossRegionConnection,
  type RegionId,
} from "@/lib/ecosystem";
import type { GraphNode, KnowledgeGraph } from "@/lib/knowledge-graph";

type LocaleKey = "zh" | "en";

interface EcosystemViewProps {
  graph: KnowledgeGraph;
  trackId: string;
  masteredIds: Set<string>;
  selectedNodeId: string | null;
  locale: LocaleKey;
  onSelectNode: (node: GraphNode) => void;
}

export default function EcosystemView({
  graph,
  trackId,
  masteredIds,
  selectedNodeId,
  locale,
  onSelectNode,
}: EcosystemViewProps) {
  // Filter nodes for the active track
  const trackNodes = useMemo(
    () => graph.nodes.filter((n) => n.track_ids?.includes(trackId)),
    [graph.nodes, trackId],
  );

  // Group into regions
  const regionGroups = useMemo(
    () => groupNodesByRegion(trackNodes),
    [trackNodes],
  );

  // State
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(selectedNodeId);

  // Card refs for connection line positioning
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sourceRef = useRef<HTMLDivElement | null>(null);

  const setCardRef = useCallback((nodeId: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(nodeId, el);
    } else {
      cardRefs.current.delete(nodeId);
    }
  }, []);

  // Compute connections on hover
  const connections = useMemo<{
    list: CrossRegionConnection[];
    connectedIds: Set<string>;
  }>(() => {
    if (!hoveredNodeId) return { list: [], connectedIds: new Set() };
    const hoveredNode = trackNodes.find((n) => n.id === hoveredNodeId);
    if (!hoveredNode) return { list: [], connectedIds: new Set() };
    const list = getCrossRegionConnections(hoveredNode, trackNodes);
    const connectedIds = new Set(list.map((c) => c.targetNodeId));
    return { list, connectedIds };
  }, [hoveredNodeId, trackNodes]);

  const hoveredNode = hoveredNodeId
    ? trackNodes.find((n) => n.id === hoveredNodeId)
    : null;

  // Handle card hover
  const handleCardHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  // Handle card click
  const handleCardClick = useCallback(
    (node: GraphNode) => {
      setActiveCardId(node.id);
      onSelectNode(node);
    },
    [onSelectNode],
  );

  // Handle background click (deselect)
  const handleBackgroundClick = useCallback(() => {
    setActiveCardId(null);
  }, []);

  const regionOrder: RegionId[] = ["traffic", "transaction", "fulfillment", "infrastructure"];

  return (
    <div
      className="relative h-full overflow-hidden p-3 md:p-4"
      onClick={handleBackgroundClick}
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(176,80,30,0.03) 0%, transparent 60%)",
      }}
    >
      {/* 2x2 grid on desktop, single column on mobile */}
      <div className="ecosystem-grid grid h-full gap-3 md:gap-4"
        style={{
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
        }}
      >
        {regionOrder.map((regionId) => {
          const region = REGIONS[regionId];
          const nodes = regionGroups.get(regionId) || [];

          return (
            <EcosystemRegion
              key={regionId}
              region={region}
              nodes={nodes}
              hoveredNodeId={hoveredNodeId}
              activeCardId={activeCardId}
              selectedNodeId={selectedNodeId}
              masteredIds={masteredIds}
              connectedNodeIds={connections.connectedIds}
              locale={locale}
              onCardHover={handleCardHover}
              onCardClick={handleCardClick}
            />
          );
        })}
      </div>

      {/* SVG connection overlay */}
      <EcosystemConnections
        connections={connections.list}
        sourceRef={
          hoveredNodeId ? cardRefs.current.get(hoveredNodeId) ?? null : null
        }
        targetRefs={cardRefs.current}
        sourceColor={
          hoveredNode
            ? REGIONS[
                (() => {
                  for (const [rid, def] of Object.entries(REGIONS)) {
                    if (def.tags.has(hoveredNode.tags?.[0] || "")) return rid as RegionId;
                  }
                  return "infrastructure" as RegionId;
                })()
              ]?.color || "#6b7280"
            : "#6b7280"
        }
        visible={hoveredNodeId !== null}
      />
    </div>
  );
}

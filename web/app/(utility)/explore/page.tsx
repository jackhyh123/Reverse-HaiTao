"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  type Edge,
  type Node,
  type NodeProps,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { Check, X } from "lucide-react";
import FloatingAITutor from "@/components/learn/FloatingAITutor";
import {
  computeDomainLayout,
  DEFAULT_EXPLORE_GRAPH,
  getDomain,
  type ExploreNode as ExploreNodeType,
} from "@/lib/explore-graph";

type LocaleKey = "zh" | "en";

// ---- Node data types ----

interface DomainNodeData {
  title: string;
  summary: string;
  tags: string[];
  domainColor: string;
  domainLabel: string;
  /** AI focus mode: this node is in the highlighted set */
  aiHighlighted: boolean;
  /** Manual focus mode: this is the single focused node */
  isFocusNode: boolean;
  /** Manual focus mode: this node is connected to the focus node */
  isConnected: boolean;
  /** Either mode: node should be dimmed */
  dimmed: boolean;
}

interface DomainLabelData {
  label: string;
  summary: string;
  color: string;
  dimmed: boolean;
}

// ---- AI Focus types ----

interface ActionStep {
  title: string;
  description: string;
  resource_url?: string;
}

interface AiFocusState {
  highlightedNodes: string[];
  actionSteps: ActionStep[];
  completedSteps: Set<number>;
}

// ---- Layout constants ----

const CANVAS_W = 1300;
const CANVAS_H = 950;
const NODE_W = 280;

// ---- Custom node components ----

function ExploreNodeView({ data }: NodeProps<DomainNodeData>) {
  return (
    <div
      className={`group relative rounded-2xl border-2 bg-white shadow-lg transition-all duration-500 dark:bg-slate-900 overflow-hidden ${
        data.dimmed
          ? "pointer-events-none scale-[0.92] opacity-[0.22]"
          : "hover:-translate-y-0.5 hover:shadow-xl cursor-pointer"
      } ${
        data.isFocusNode
          ? "scale-[1.03] border-slate-400 shadow-xl dark:border-slate-500"
          : data.isConnected
          ? "border-[var(--connected-color)]"
          : data.aiHighlighted
          ? "border-[var(--connected-color)] scale-[1.02]"
          : "border-slate-200 dark:border-slate-700"
      }`}
      style={{
        width: NODE_W,
        ...(data.isConnected || data.aiHighlighted
          ? { borderColor: data.domainColor, "--connected-color": data.domainColor } as React.CSSProperties
          : {}),
      }}
    >
      {/* Focus node top colored bar */}
      {data.isFocusNode && (
        <div
          className="h-1.5 w-full shrink-0"
          style={{ backgroundColor: data.domainColor }}
        />
      )}

      <Handle
        type="target"
        position={Position.Left}
        style={{ background: data.domainColor, width: 8, height: 8, border: "2px solid white" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: data.domainColor, width: 8, height: 8, border: "2px solid white" }}
      />

      <div className="px-4 py-3">
        {/* Domain badge */}
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{
              backgroundColor: `${data.domainColor}18`,
              color: data.domainColor,
            }}
          >
            {data.domainLabel}
          </span>
          {data.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              {tag}
            </span>
          ))}
          {/* Focus indicator pill */}
          {data.isFocusNode && (
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
              style={{ backgroundColor: data.domainColor }}
            >
              当前
            </span>
          )}
        </div>

        {/* Title */}
        <div className="mt-2 text-[15px] font-bold leading-tight tracking-[-0.01em] text-slate-900 dark:text-slate-50">
          {data.title}
        </div>

        {/* Summary */}
        <div className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          {data.summary}
        </div>
      </div>
    </div>
  );
}

function DomainLabelView({ data }: NodeProps<DomainLabelData>) {
  return (
    <div
      className="pointer-events-none select-none text-center transition-all duration-500"
      style={{ width: 500 }}
    >
      <div
        className="text-[28px] font-black tracking-[-0.02em]"
        style={{
          color: data.color,
          opacity: data.dimmed ? 0.03 : 0.06,
          transition: "opacity 0.5s",
        }}
      >
        {data.label}
      </div>
      <div
        className="mt-0.5 text-[11px] font-medium tracking-wider"
        style={{
          color: data.color,
          opacity: data.dimmed ? 0.04 : 0.12,
          transition: "opacity 0.5s",
        }}
      >
        {data.summary}
      </div>
    </div>
  );
}

const NODE_TYPES = {
  exploreNode: ExploreNodeView,
  domainLabel: DomainLabelView,
};

// ---- Explore quick questions ----

const EXPLORE_QUICK_QUESTIONS = [
  "我想做 TikTok 带货，怎么入手？",
  "怎么找到靠谱的国内货源？",
  "独立站和代理平台哪个更适合新手？",
  "跨境物流都有哪些方式？",
];

// ---- Main page ----

export default function ExplorePage() {
  return (
    <ReactFlowProvider>
      <ExploreInner />
    </ReactFlowProvider>
  );
}

function ExploreInner() {
  const locale: LocaleKey = "zh";
  const { domains, nodes: graphNodes } = DEFAULT_EXPLORE_GRAPH;

  // Manual focus: set when user clicks a node
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  // AI focus: set when AI responds with highlighted_nodes
  const [aiFocusState, setAiFocusState] = useState<AiFocusState | null>(null);

  const inAiFocus = aiFocusState !== null;
  const inManualFocus = focusNodeId !== null && !inAiFocus;
  const inPanoramic = !inAiFocus && !inManualFocus;

  // Build graph context for API calls
  const graphContext = useMemo(
    () => ({
      domains: domains.map((d) => ({
        id: d.id,
        label: d.label,
        summary: d.summary,
        color: d.color,
      })),
      nodes: graphNodes.map((n) => ({
        id: n.id,
        domain: n.domain,
        title: n.title,
        summary: n.summary,
        tags: n.tags,
        connections: n.connections,
      })),
    }),
    [domains, graphNodes],
  );

  // Compute positions
  const positions = useMemo(
    () => computeDomainLayout(domains, graphNodes, CANVAS_W, CANVAS_H),
    [domains, graphNodes],
  );

  // ---- Connected-node lookup helper ----
  const connectedNodeIds = useMemo(() => {
    if (!focusNodeId) return new Set<string>();
    const node = graphNodes.find((n) => n.id === focusNodeId);
    if (!node) return new Set<string>();
    return new Set((node.connections || []).map((c) => c.target));
  }, [focusNodeId, graphNodes]);

  // ---- Focus layout: reposition focus node to center + fan out connections ----
  const focusLayoutOverrides = useMemo(() => {
    if (!focusNodeId) return {} as Record<string, { x: number; y: number }>;
    const focusNode = graphNodes.find((n) => n.id === focusNodeId);
    if (!focusNode) return {} as Record<string, { x: number; y: number }>;

    const connections = focusNode.connections || [];
    const connectedIds = connections.map((c) => c.target);

    const overrides: Record<string, { x: number; y: number }> = {};

    // Focus node at canvas center
    const centerX = CANVAS_W / 2 - NODE_W / 2;
    const centerY = CANVAS_H / 2 - 80;
    overrides[focusNodeId] = { x: centerX, y: centerY };

    // Connected nodes in a fan / semicircle on the right side
    const radius = 340;
    const totalAngle = Math.PI * 0.55;
    const startAngle = -totalAngle / 2;

    connectedIds.forEach((id, i) => {
      const frac = connectedIds.length > 1 ? i / (connectedIds.length - 1) : 0.5;
      const angle = startAngle + totalAngle * frac;
      overrides[id] = {
        x: centerX + NODE_W / 2 + radius * Math.cos(angle) - NODE_W / 2,
        y: centerY + 60 + radius * Math.sin(angle) - 55,
      };
    });

    return overrides;
  }, [focusNodeId, graphNodes]);

  // Build ReactFlow nodes
  const baseNodes: Node[] = useMemo(() => {
    const result: Node[] = [];
    const aiHighlightedSet = new Set(aiFocusState?.highlightedNodes || []);

    // Domain label nodes (centered in each domain)
    const gap = 60;
    const domainW = (CANVAS_W - gap * 3) / 2;
    const domainH = (CANVAS_H - gap * 3) / 2;

    domains.forEach((domain, di) => {
      const col = di % 2;
      const row = Math.floor(di / 2);
      const originX = gap + col * (domainW + gap);
      const originY = gap + row * (domainH + gap);

      // Domain dims when in AI focus and no highlighted node in this domain
      const domainHasActivity =
        inManualFocus ||
        (inAiFocus && graphNodes.some((n) => n.domain === domain.id && aiHighlightedSet.has(n.id)));

      result.push({
        id: `domain-label-${domain.id}`,
        type: "domainLabel",
        position: {
          x: originX + domainW / 2 - 250,
          y: originY + domainH / 2 - 40,
        },
        data: {
          label: domain.label[locale],
          summary: domain.summary[locale],
          color: domain.color,
          dimmed: !inPanoramic && !domainHasActivity,
        } as DomainLabelData,
        draggable: false,
        selectable: false,
        style: { zIndex: -1 },
      });
    });

    // Entity nodes
    graphNodes.forEach((node) => {
      const domain = getDomain(domains, node.domain);
      const pos = positions[node.id];

      const isFocusNode = node.id === focusNodeId;
      const isConnected = connectedNodeIds.has(node.id);
      const isAiHighlighted = inAiFocus && aiHighlightedSet.has(node.id);
      const isDimmed =
        (inManualFocus && !isFocusNode && !isConnected) ||
        (inAiFocus && !isAiHighlighted);

      result.push({
        id: node.id,
        type: "exploreNode",
        position: focusLayoutOverrides[node.id] || pos || { x: 0, y: 0 },
        data: {
          title: node.title[locale],
          summary: node.summary[locale],
          tags: node.tags,
          domainColor: domain?.color || "#94a3b8",
          domainLabel: domain?.label[locale] || node.domain,
          aiHighlighted: isAiHighlighted,
          isFocusNode,
          isConnected,
          dimmed: isDimmed,
        } as DomainNodeData,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });

    return result;
  }, [
    domains,
    graphNodes,
    positions,
    locale,
    focusNodeId,
    aiFocusState,
    connectedNodeIds,
    inPanoramic,
    inManualFocus,
    inAiFocus,
    focusLayoutOverrides,
  ]);

  // Build edges: zero in panoramic, only focus-radiation in manual, AI-relevant in AI focus
  const baseEdges: Edge[] = useMemo(() => {
    // Panoramic: no edges
    if (inPanoramic) return [];

    // Manual focus: only edges from focus node to its connected nodes
    if (inManualFocus && focusNodeId) {
      const focusNode = graphNodes.find((n) => n.id === focusNodeId);
      if (!focusNode) return [];
      return (focusNode.connections || []).map((c) => ({
        id: `${focusNodeId}->${c.target}`,
        source: focusNodeId,
        target: c.target,
        type: "default" as const,
        animated: true,
        style: {
          stroke: "#64748b",
          strokeWidth: 2,
        },
        label: c.relation,
        labelStyle: {
          fill: "#475569",
          fontWeight: 600,
          fontSize: 11,
        } as React.CSSProperties,
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.92,
        } as React.CSSProperties,
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 6,
        markerEnd: {
          type: "arrowclosed" as const,
          color: "#64748b",
          width: 10,
          height: 10,
        },
      }));
    }

    // AI focus: edges between highlighted nodes
    if (inAiFocus && aiFocusState) {
      const nodeIdSet = new Set(graphNodes.map((n) => n.id));
      const highlightedSet = new Set(aiFocusState.highlightedNodes);
      return graphNodes.flatMap((node) =>
        (node.connections || [])
          .filter(
            (c) =>
              nodeIdSet.has(c.target) &&
              highlightedSet.has(node.id) &&
              highlightedSet.has(c.target),
          )
          .map((c) => ({
            id: `${node.id}->${c.target}`,
            source: node.id,
            target: c.target,
            type: "default" as const,
            animated: true,
            style: {
              stroke: "#94a3b8",
              strokeWidth: 2,
            },
            markerEnd: {
              type: "arrowclosed" as const,
              color: "#94a3b8",
              width: 10,
              height: 10,
            },
          })),
      );
    }

    return [];
  }, [graphNodes, inPanoramic, inManualFocus, focusNodeId, inAiFocus, aiFocusState]);

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);
  const rfInstance = useReactFlow();

  // Animate viewport to center the focus node
  useEffect(() => {
    if (!focusNodeId) return;
    const override = focusLayoutOverrides[focusNodeId];
    if (!override) return;
    // Brief delay so ReactFlow processes the node position update first
    const timer = setTimeout(() => {
      rfInstance.setCenter(
        override.x + NODE_W / 2,
        override.y + 60,
        { zoom: 0.82, duration: 500 },
      );
    }, 80);
    return () => clearTimeout(timer);
  }, [focusNodeId, focusLayoutOverrides, rfInstance]);

  // Sync when base data changes
  useEffect(() => {
    setNodes(baseNodes);
    setEdges(baseEdges);
  }, [baseNodes, baseEdges, setNodes, setEdges]);

  // ---- Click handlers ----

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "domainLabel") return;
      // Always set focus to clicked node (works in panoramic and manual focus modes)
      setFocusNodeId(node.id);
      // Clicking a node clears AI focus
      setAiFocusState(null);
    },
    [],
  );

  const handlePaneClick = useCallback(() => {
    // Clicking blank canvas exits both focus modes
    setFocusNodeId(null);
    setAiFocusState(null);
  }, []);

  // Handle AI response from FloatingAITutor
  const handleAIResponse = useCallback((data: Record<string, unknown>) => {
    const highlightedNodes = data.highlighted_nodes as string[] | undefined;
    const actionSteps = data.action_steps as ActionStep[] | undefined;
    if (highlightedNodes && highlightedNodes.length > 0) {
      // AI focus overrides manual focus
      setFocusNodeId(null);
      setAiFocusState({
        highlightedNodes,
        actionSteps: actionSteps || [],
        completedSteps: new Set(),
      });
    }
  }, []);

  const exitAiFocus = useCallback(() => {
    setAiFocusState(null);
  }, []);

  const toggleStepComplete = useCallback((index: number) => {
    setAiFocusState((prev) => {
      if (!prev) return null;
      const next = new Set(prev.completedSteps);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...prev, completedSteps: next };
    });
  }, []);

  // Focus banner text
  const focusBannerText = useMemo(() => {
    if (!aiFocusState) return "";
    const nodeNames = aiFocusState.highlightedNodes
      .slice(0, 3)
      .map((id) => graphNodes.find((n) => n.id === id)?.title[locale] || id)
      .join(" · ");
    return `已为你聚焦"${nodeNames}"相关路径`;
  }, [aiFocusState, graphNodes, locale]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[var(--border)]/40 bg-[var(--background)] px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold">反淘生态探索</h1>
            <span className="hidden text-xs text-[var(--muted-foreground)] md:inline">
              点击节点探索生态关系 · 底部 AI 导师帮你规划路径
            </span>
          </div>
          <div className="flex items-center gap-2">
            {inManualFocus && (
              <button
                onClick={handlePaneClick}
                className="rounded-lg border border-[var(--border)]/60 bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40"
              >
                返回全景
              </button>
            )}
            <button className="rounded-lg border border-[var(--border)]/60 bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40">
              我的路径
            </button>
          </div>
        </div>
      </div>

      {/* AI Focus banner */}
      {inAiFocus && (
        <div className="shrink-0 border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 backdrop-blur dark:border-amber-800/30 dark:bg-amber-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-amber-600 dark:text-amber-400">⚡</span>
              <span className="font-medium text-amber-900 dark:text-amber-200">
                {focusBannerText}
              </span>
              <button
                onClick={exitAiFocus}
                className="ml-2 text-xs font-medium text-amber-600 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              >
                查看全景
              </button>
            </div>
            <button
              onClick={exitAiFocus}
              className="rounded-lg p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Canvas + optional action panel */}
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          defaultViewport={{ x: 40, y: 20, zoom: 0.7 }}
          minZoom={0.2}
          maxZoom={1.5}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          panOnScrollMode={"free" as never}
          className="bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.04),transparent_60%)]"
          style={inAiFocus ? { right: 340 } : undefined}
        >
          <Background gap={32} size={1} color="rgba(148,163,184,0.15)" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>

        {/* Action steps panel (AI focus mode only) */}
        {inAiFocus && aiFocusState.actionSteps.length > 0 && (
          <div className="absolute right-0 top-0 z-20 flex h-full w-[340px] flex-col border-l border-[var(--border)]/60 bg-white/90 shadow-2xl backdrop-blur dark:bg-slate-950/90">
            {/* Panel header */}
            <div className="shrink-0 border-b border-[var(--border)]/40 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    你的行动路径
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {aiFocusState.completedSteps.size}/{aiFocusState.actionSteps.length} 步已完成
                  </div>
                </div>
              </div>
            </div>

            {/* Steps list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-3">
                {aiFocusState.actionSteps.map((step, i) => {
                  const done = aiFocusState.completedSteps.has(i);
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 transition-all ${
                        done
                          ? "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/30"
                          : "border-slate-200/60 bg-white dark:border-slate-800/60 dark:bg-slate-900/50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => toggleStepComplete(i)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300 hover:border-slate-400 dark:border-slate-600"
                          }`}
                        >
                          {done && <Check className="h-3 w-3" />}
                        </button>
                        <div className="min-w-0">
                          <div
                            className={`text-[13px] font-semibold leading-tight ${
                              done
                                ? "text-slate-400 line-through dark:text-slate-500"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {i + 1}. {step.title}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                            {step.description}
                          </div>
                          {step.resource_url && (
                            <a
                              href={step.resource_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1.5 inline-block text-[11px] font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400"
                            >
                              查看资源 →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel footer */}
            <div className="shrink-0 border-t border-[var(--border)]/40 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={exitAiFocus}
                  className="flex-1 rounded-lg border border-[var(--border)]/60 bg-[var(--background)] py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40"
                >
                  返回全景
                </button>
                <button className="flex-1 rounded-lg bg-slate-900 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                  保存路径
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Tutor bar */}
      <FloatingAITutor
        trackLabel="反淘生态探索"
        leftOffsetPx={0}
        rightOffsetPx={inAiFocus ? 340 : 0}
        isLoggedIn={false}
        disabled={false}
        disableWhenOffset={false}
        apiPath="/api/v1/explore/chat"
        apiExtraBody={{ graph_context: graphContext }}
        onResponse={handleAIResponse}
        quickQuestions={EXPLORE_QUICK_QUESTIONS}
      />
    </div>
  );
}

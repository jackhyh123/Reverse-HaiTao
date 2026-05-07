"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  Award,
  BookMarked,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  PlayCircle,
  Sparkles,
  Target,
} from "lucide-react";
import {
  getNodeStatus,
  type GraphNode,
  type KnowledgeGraph,
} from "@/lib/knowledge-graph";
import {
  mergeGraphs,
  type MergedGraphResult,
} from "@/lib/graph-customization";

type LocaleKey = "zh" | "en";
type NodeStatus = "mastered" | "unlocked" | "locked";
type NodeKind = "foundation" | "review" | "topic";

interface MapNodeData {
  title: string;
  summary: string;
  status: NodeStatus;
  estMinutes: number;
  stepNumber: number;
  resourceCount: number;
  selected: boolean;
  previewed: boolean;
  focusVersion: number;
  trackColor: string;
  kind: NodeKind;
  tags: string[];
  nodeWidth?: number;
  nodeHeight?: number;
}

const NODE_W = 330;
const NODE_H = 154;
const NODE_GAP = 112;

function classifyNode(tags: string[]): NodeKind {
  if (tags.includes("foundation")) return "foundation";
  if (tags.includes("review")) return "review";
  return "topic";
}

const KIND_ICONS: Record<NodeKind, typeof Target> = {
  foundation: Sparkles,
  review: Award,
  topic: BookMarked,
};

const STATUS_TEXT: Record<NodeStatus, { zh: string; en: string }> = {
  mastered: { zh: "已掌握", en: "Mastered" },
  unlocked: { zh: "正在学习", en: "Unlocked" },
  locked: { zh: "待解锁", en: "Locked" },
};

const STATUS_ICON: Record<NodeStatus, typeof Target> = {
  mastered: CheckCircle2,
  unlocked: PlayCircle,
  locked: Lock,
};

const TAG_COLORS: Record<string, string> = {
  foundation: "bg-amber-100 text-amber-800",
  concept: "bg-blue-100 text-blue-800",
  roles: "bg-purple-100 text-purple-800",
  platforms: "bg-indigo-100 text-indigo-800",
  traffic: "bg-cyan-100 text-cyan-800",
  discovery: "bg-cyan-100 text-cyan-800",
  funnel: "bg-rose-100 text-rose-800",
  conversion: "bg-rose-100 text-rose-800",
  fulfillment: "bg-orange-100 text-orange-800",
  logistics: "bg-orange-100 text-orange-800",
  seller: "bg-blue-100 text-blue-700",
  operator: "bg-purple-100 text-purple-700",
  channels: "bg-teal-100 text-teal-800",
  promotion: "bg-pink-100 text-pink-800",
  kol: "bg-pink-100 text-pink-800",
  review: "bg-slate-200 text-slate-800",
  data: "bg-emerald-100 text-emerald-800",
  mechanics: "bg-violet-100 text-violet-800",
  revenue: "bg-green-100 text-emerald-800",
  system: "bg-slate-100 text-slate-700",
};

// ─── Graph Node View (read-only) ─────────────────────────────────

function MapNodeView({ data }: NodeProps<MapNodeData>) {
  const KindIcon = KIND_ICONS[data.kind];
  const StatusIcon = STATUS_ICON[data.status];
  const statusLabel = STATUS_TEXT[data.status].zh;
  const isActive = data.selected || data.previewed;

  const clayStyle =
    data.status === "mastered"
      ? "border-emerald-300/50 bg-emerald-50/70 dark:border-emerald-500/25 dark:bg-emerald-950/50"
      : data.status === "unlocked"
        ? "border-amber-300/40 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-950/50"
        : "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70";

  const statusPillClass =
    data.status === "mastered"
      ? "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-300 dark:border-emerald-400/25"
      : data.status === "unlocked"
        ? "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-400/25"
        : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600";

  const visibleTags = (data.tags || [])
    .filter((tag) => !["foundation", "review"].includes(tag))
    .slice(0, 3);

  return (
    <div
      className={`${clayStyle} group relative rounded-[22px] border-[2.5px] px-5 py-4 transition-all duration-300`}
      style={{
        width: data.nodeWidth ?? NODE_W,
        minHeight: data.nodeHeight ?? NODE_H,
        boxShadow: isActive
          ? "inset 0 1px 0 rgba(255,255,255,0.6), 0 0 0 3px rgba(176,80,30,0.15), 0 8px 32px rgba(120,100,80,0.18)"
          : "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px rgba(120,100,80,0.10), 0 1px 3px rgba(120,100,80,0.06)",
        transform: isActive ? "scale(1.04)" : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 28px rgba(120,100,80,0.15), 0 2px 6px rgba(120,100,80,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "";
        }
      }}
    >
      {/* Focus ring when selected/previewed */}
      {isActive && (
        <span
          key={`focus-${data.focusVersion}`}
          className="pointer-events-none absolute -inset-[3px] animate-pulse rounded-[26px] border-[2.5px] border-amber-400/50"
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: data.trackColor,
          width: 11,
          height: 11,
          border: "2.5px solid white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">
              {`第 ${data.stepNumber} 步`}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusPillClass}`}
            >
              <StatusIcon className="h-3 w-3" />
              {statusLabel}
            </span>
          </div>
          <div className="mt-3 line-clamp-2 text-[17px] font-extrabold leading-snug tracking-[-0.01em] text-slate-900 dark:text-slate-100">
            {data.title}
          </div>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border-2 ${
            data.kind === "foundation"
              ? "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300"
              : data.kind === "review"
                ? "border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-500/30 dark:bg-slate-400/10 dark:text-slate-300"
                : "border-blue-200 bg-blue-100 text-blue-600 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300"
          }`}
          style={{
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
          }}
        >
          <KindIcon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-2.5 line-clamp-2 text-[12px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
        {data.summary}
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                TAG_COLORS[tag] || "bg-slate-50 text-slate-600 border-slate-200"
              }`}
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          {`${data.estMinutes}m`}
          <FileText className="ml-1 h-3.5 w-3.5" />
          {data.resourceCount}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: data.trackColor,
          width: 11,
          height: 11,
          border: "2.5px solid white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        }}
      />
    </div>
  );
}

const NODE_TYPES = {
  graph: MapNodeView,
};

// ─── Props ──────────────────────────────────────────────────────

interface KnowledgeMapFlowProps {
  graph: KnowledgeGraph;
  trackId: string;
  masteredIds: Set<string>;
  selectedNodeId: string | null;
  focusNodeId?: string | null;
  focusVersion?: number;
  openOnSingleTap?: boolean;
  compact?: boolean;
  onPreviewNode?: (node: GraphNode) => void;
  onSelectNode: (node: GraphNode) => void;
  locale: LocaleKey;
}

// ─── Flow Inner ─────────────────────────────────────────────────

function FlowInner({
  graph,
  trackId,
  masteredIds,
  selectedNodeId,
  focusNodeId = null,
  focusVersion = 0,
  openOnSingleTap = false,
  compact = false,
  onPreviewNode,
  onSelectNode,
  locale,
}: KnowledgeMapFlowProps) {
  const nodeW = compact ? 260 : 330;
  const nodeH = compact ? 200 : 154;
  const nodeGap = compact ? 100 : 112;
  const trackColor = useMemo(
    () => graph.tracks.find((t) => t.id === trackId)?.color || "#1a73e8",
    [graph, trackId],
  );

  const trackNodes = useMemo(
    () => graph.nodes.filter((n) => n.track_ids.includes(trackId)),
    [graph, trackId],
  );

  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const effectivePreviewNodeId = previewNodeId ?? (!selectedNodeId ? focusNodeId : null);

  // Empty customization (read-only mode — no user nodes, annotations, or edits)
  const emptyCustomization = useMemo(
    () => ({
      track_id: trackId,
      userNodes: [] as any[],
      userEdges: [] as any[],
      annotations: [] as any[],
      updated_at: 0,
    }),
    [trackId],
  );

  // Merge public graph with empty customization (read-only)
  const merged: MergedGraphResult = useMemo(() => {
    const result = mergeGraphs(
      graph,
      trackId,
      emptyCustomization,
      masteredIds,
      selectedNodeId,
      effectivePreviewNodeId,
      focusVersion,
      trackColor,
      locale,
      nodeW,
      nodeH,
      nodeGap,
    );

    // Apply vertical skeleton layout to public nodes
    const pubIds = new Set(trackNodes.map((n) => n.id));
    const flowNodes = result.flowNodes.map((n, i) => {
      if (pubIds.has(n.id)) {
        const idx = trackNodes.findIndex((tn) => tn.id === n.id);
        return {
          ...n,
          position: {
            x: -nodeW / 2,
            y: (idx >= 0 ? idx : i) * (nodeH + nodeGap),
          },
        };
      }
      return n;
    });

    return { flowNodes, flowEdges: result.flowEdges };
  }, [
    graph,
    trackId,
    emptyCustomization,
    masteredIds,
    selectedNodeId,
    effectivePreviewNodeId,
    focusVersion,
    trackColor,
    locale,
    nodeW,
    nodeH,
    nodeGap,
    trackNodes,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(merged.flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(merged.flowEdges);
  const { fitView, setCenter } = useReactFlow();
  const initialFitDoneRef = useRef(false);

  // Sync ReactFlow state when merged data changes
  useEffect(() => {
    setNodes(merged.flowNodes);
    setEdges(merged.flowEdges);
  }, [merged, setNodes, setEdges]);

  const focusNode = useCallback(
    (
      nodeId: string | null,
      duration = 420,
      zoom = 0.78,
      verticalOffset = 0,
    ) => {
      if (!nodeId) return;
      const focus = merged.flowNodes.find((n) => n.id === nodeId);
      if (!focus) return;
      const cx = (focus.position?.x ?? 0) + nodeW / 2;
      const cy = (focus.position?.y ?? 0) + nodeH / 2;
      void fitView({
        nodes: [{ id: nodeId }],
        padding: 0.28,
        maxZoom: Math.max(zoom, 0.86),
        duration,
      });
      window.setTimeout(() => {
        setCenter(cx, cy + verticalOffset, {
          zoom,
          duration: Math.max(180, Math.round(duration * 0.65)),
        });
      }, 120);
    },
    [fitView, merged.flowNodes, nodeH, nodeW, setCenter],
  );

  // Focus logic
  useEffect(() => {
    const laidOut = merged.flowNodes;
    const requestedFocusId =
      effectivePreviewNodeId && laidOut.some((n) => n.id === effectivePreviewNodeId)
        ? effectivePreviewNodeId
        : focusNodeId && laidOut.some((n) => n.id === focusNodeId)
          ? focusNodeId
          : selectedNodeId;

    // No explicit focus → fit all nodes into view
    if (!requestedFocusId) {
      if (initialFitDoneRef.current || laidOut.length === 0) return;
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, maxZoom: 0.9, duration: 400 });
        initialFitDoneRef.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }

    const focus =
      laidOut.find((n) => n.id === requestedFocusId) ||
      laidOut.find((n) => {
        const d = n.data as MapNodeData;
        return d?.status === "unlocked";
      }) ||
      laidOut[0];

    if (focus) {
      const focusId = String(focus.id);
      const isPreviewFocus =
        effectivePreviewNodeId === focusId && selectedNodeId !== focusId;
      const isSelectedFocus = selectedNodeId === focusId;
      const zoom = isSelectedFocus ? 1.18 : isPreviewFocus ? 1.16 : 1.12;
      const verticalOffset = isSelectedFocus ? 0 : 52;
      setTimeout(() => focusNode(focusId, 300, zoom, verticalOffset), 60);
      setTimeout(
        () => focusNode(focusId, 420, zoom, verticalOffset),
        420,
      );
      initialFitDoneRef.current = true;
    }
  }, [
    merged.flowNodes,
    selectedNodeId,
    effectivePreviewNodeId,
    focusNodeId,
    focusVersion,
    focusNode,
    fitView,
  ]);

  // ── Render ──

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
        minZoom={0.35}
        maxZoom={1.25}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        panOnScrollMode={"vertical" as never}
        className="bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.02),transparent)] [&_.react-flow__controls-button]:!border-[var(--border)] [&_.react-flow__controls-button]:!bg-[var(--background)] [&_.react-flow__controls-button]:!text-[var(--foreground)]"
        onNodeClick={(_, n) => {
          const found = trackNodes.find((tn) => tn.id === n.id);
          if (!found) return;

          setPreviewNodeId(found.id);
          onPreviewNode?.(found);

          if (openOnSingleTap) {
            focusNode(found.id, 220, 1.12, 0);
            onSelectNode(found);
            return;
          }
          if (selectedNodeId) {
            focusNode(found.id, 220, 1.12, 0);
            onSelectNode(found);
            return;
          }
          focusNode(found.id, 320, 1.04, 74);
        }}
        onNodeDoubleClick={(_, n) => {
          const found = trackNodes.find((tn) => tn.id === n.id);
          if (!found) return;

          setPreviewNodeId(found.id);
          onPreviewNode?.(found);
          focusNode(found.id, 220, 1.12, 0);
          onSelectNode(found);
          window.setTimeout(
            () => focusNode(found.id, 420, 1.12, 0),
            460,
          );
        }}
      >
        <Background gap={24} size={1} color="rgba(127,127,127,0.18)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function KnowledgeMapFlow(props: KnowledgeMapFlowProps) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}

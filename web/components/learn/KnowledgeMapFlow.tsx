"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
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

const KIND_STYLES: Record<NodeKind, { badge: string }> = {
  foundation: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
  },
  review: {
    badge: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900",
  },
  topic: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-400/20 dark:text-blue-200",
  },
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

function MapNodeView({ data }: NodeProps<MapNodeData>) {
  const KindIcon = KIND_ICONS[data.kind];
  const StatusIcon = STATUS_ICON[data.status];
  const statusLabel = STATUS_TEXT[data.status].zh;
  const selectedRing = data.selected || data.previewed
    ? "scale-[1.07] ring-2 ring-offset-2 ring-amber-400 ring-offset-[var(--background)]"
    : "";
  const statusClass =
    data.status === "mastered"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_16px_32px_rgba(16,185,129,0.18)] dark:border-emerald-400/70 dark:bg-emerald-950 dark:text-emerald-50"
      : data.status === "unlocked"
        ? "border-amber-300 bg-amber-50 text-slate-950 shadow-[0_18px_36px_rgba(245,158,11,0.22)] dark:border-amber-300 dark:bg-amber-950 dark:text-amber-50"
        : "border-slate-300 bg-white text-slate-900 shadow-[0_14px_28px_rgba(15,23,42,0.12)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  const statusPillClass =
    data.status === "mastered"
      ? "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950"
      : data.status === "unlocked"
        ? "bg-amber-500 text-slate-950 dark:bg-amber-300 dark:text-amber-950"
        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";

  const visibleTags = (data.tags || [])
    .filter((tag) => !["foundation", "review"].includes(tag))
    .slice(0, 3);

  return (
    <div
      className={`${statusClass} ${selectedRing} group relative rounded-[28px] border-2 px-5 py-4 transition-all duration-300 hover:-translate-y-1`}
      style={{ width: data.nodeWidth ?? NODE_W, minHeight: data.nodeHeight ?? NODE_H }}
    >
      {(data.selected || data.previewed) && (
        <span
          key={`focus-${data.focusVersion}`}
          className="pointer-events-none absolute -inset-2 animate-pulse rounded-[32px] border-2 border-amber-400/60 opacity-80"
        />
      )}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: data.trackColor, width: 10, height: 10, border: "2px solid white" }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-extrabold text-white dark:bg-white dark:text-slate-950">
              {`第 ${data.stepNumber} 步`}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusPillClass}`}>
              <StatusIcon className="h-3 w-3" />
              {statusLabel}
            </span>
          </div>
          <div className="mt-3 line-clamp-2 text-[18px] font-black leading-tight tracking-[-0.02em]">
            {data.title}
          </div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${KIND_STYLES[data.kind].badge}`}>
          <KindIcon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-2 line-clamp-2 text-[12px] font-medium leading-5 text-slate-600 dark:text-slate-300">
        {data.summary}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                TAG_COLORS[tag] || "bg-slate-100 text-slate-700"
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-300">
          <Clock className="h-3.5 w-3.5" />
          {`${data.estMinutes}m`}
          <FileText className="ml-1 h-3.5 w-3.5" />
          {data.resourceCount}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: data.trackColor, width: 10, height: 10, border: "2px solid white" }}
      />
    </div>
  );
}

const NODE_TYPES = { graph: MapNodeView };

function layoutGraph(nodes: Node[], nodeW: number, nodeH: number, nodeGap: number) {
  return nodes.map((node, index) => ({
    ...node,
    position: { x: -nodeW / 2, y: index * (nodeH + nodeGap) },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  }));
}

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
  const nodeH = compact ? 138 : 154;
  const nodeGap = compact ? 80 : 112;
  const trackColor = useMemo(
    () => graph.tracks.find((t) => t.id === trackId)?.color || "#1a73e8",
    [graph, trackId],
  );

  const trackNodes = useMemo(
    () => graph.nodes.filter((n) => n.track_ids.includes(trackId)),
    [graph, trackId],
  );
  const nodeIdSet = useMemo(
    () => new Set(trackNodes.map((n) => n.id)),
    [trackNodes],
  );
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);

  const baseNodes: Node[] = useMemo(
    () =>
      trackNodes.map((n, index) => ({
        id: n.id,
        type: "graph",
        position: { x: 0, y: 0 },
        data: {
          title: n.title[locale],
          summary: n.summary[locale],
          status: getNodeStatus(n, masteredIds),
          estMinutes: n.estimated_minutes,
          stepNumber: index + 1,
          resourceCount: n.resources?.length || 0,
          selected: selectedNodeId === n.id,
          previewed: previewNodeId === n.id,
          focusVersion: selectedNodeId === n.id ? focusVersion : 0,
          trackColor,
          kind: classifyNode(n.tags || []),
          tags: n.tags || [],
          nodeWidth: nodeW,
          nodeHeight: nodeH,
        } as MapNodeData,
      })),
    [trackNodes, locale, masteredIds, selectedNodeId, previewNodeId, focusVersion, trackColor],
  );

  const baseEdges: Edge[] = useMemo(
    () =>
      trackNodes.flatMap((n) =>
        n.prerequisites
          .filter((p) => nodeIdSet.has(p))
          .map((p) => ({
            id: `${p}->${n.id}`,
            source: p,
            target: n.id,
            type: "smoothstep",
            animated: false,
            style: {
              stroke:
                masteredIds.has(p) && masteredIds.has(n.id)
                  ? "#10b981"
                  : masteredIds.has(p)
                    ? trackColor
                    : "#64748b",
              strokeWidth: masteredIds.has(p) ? 2.4 : 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color:
                masteredIds.has(p) && masteredIds.has(n.id)
                  ? "#10b981"
                  : masteredIds.has(p)
                    ? trackColor
                    : "#64748b",
            },
          })),
      ),
    [trackNodes, nodeIdSet, masteredIds, trackColor],
  );

  const laidOut = useMemo(() => layoutGraph(baseNodes, nodeW, nodeH, nodeGap), [baseNodes, nodeW, nodeH, nodeGap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(laidOut);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);
  const { fitView, setCenter } = useReactFlow();

  const focusNode = useCallback((nodeId: string | null, duration = 420, zoom = 0.78, verticalOffset = 0) => {
    if (!nodeId) return;
    const focus = laidOut.find((n) => n.id === nodeId);
    if (!focus) return;
    const cx = (focus.position?.x ?? 0) + nodeW / 2;
    const cy = (focus.position?.y ?? 0) + nodeH / 2;
    void fitView({
      nodes: [{ id: nodeId }],
      padding: 0.48,
      maxZoom: Math.max(zoom, 0.86),
      duration,
    });
    window.setTimeout(() => {
      setCenter(cx, cy + verticalOffset, { zoom, duration: Math.max(180, Math.round(duration * 0.65)) });
    }, 120);
  }, [fitView, laidOut, setCenter]);

  useEffect(() => {
    setNodes(laidOut);
    setEdges(baseEdges);

    const requestedFocusId =
      previewNodeId && laidOut.some((n) => n.id === previewNodeId)
        ? previewNodeId
        : focusNodeId && laidOut.some((n) => n.id === focusNodeId)
        ? focusNodeId
        : selectedNodeId;
    const focus =
      laidOut.find((n) => n.id === requestedFocusId) ||
      laidOut.find((n) => {
        const data = n.data as MapNodeData;
        return data?.status === "unlocked";
      }) ||
      laidOut[0];

    if (focus) {
      const focusId = String(focus.id);
      const isPreviewFocus = previewNodeId === focusId && selectedNodeId !== focusId;
      const isSelectedFocus = selectedNodeId === focusId;
      const zoom = isSelectedFocus ? 1.12 : isPreviewFocus ? 1.04 : 0.78;
      const verticalOffset = isPreviewFocus ? 74 : 0;
      setTimeout(() => focusNode(focusId, 300, zoom, verticalOffset), 60);
      setTimeout(() => focusNode(focusId, 420, zoom, verticalOffset), 420);
    }
  }, [laidOut, baseEdges, selectedNodeId, previewNodeId, focusNodeId, focusVersion, setNodes, setEdges, focusNode]);

  return (
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
      onNodeClick={(_, n) => {
        const found = trackNodes.find((tn) => tn.id === n.id);
        if (found) {
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
        }
      }}
      onNodeDoubleClick={(_, n) => {
        const found = trackNodes.find((tn) => tn.id === n.id);
        if (found) {
          setPreviewNodeId(found.id);
          onPreviewNode?.(found);
          focusNode(found.id, 220, 1.12, 0);
          onSelectNode(found);
          window.setTimeout(() => focusNode(found.id, 420, 1.12, 0), 460);
        }
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      panOnScrollMode={"vertical" as never}
      className="bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.02),transparent)] [&_.react-flow__controls-button]:!border-[var(--border)] [&_.react-flow__controls-button]:!bg-[var(--background)] [&_.react-flow__controls-button]:!text-[var(--foreground)]"
    >
      <Background gap={24} size={1} color="rgba(127,127,127,0.18)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export default function KnowledgeMapFlow(props: KnowledgeMapFlowProps) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}

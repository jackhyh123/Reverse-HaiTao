"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  GitBranch,
  Link2,
  Loader2,
  MousePointer2,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { useTranslation } from "react-i18next";
import {
  type GraphNode,
  type GraphTrack,
  type KnowledgeGraph,
  type LocalizedText,
  type NodeResource,
  fetchGraph,
  updateGraph,
} from "@/lib/knowledge-graph";

type LocaleKey = "zh" | "en";
type AddDirection = "up" | "down" | "left" | "right";

const emptyText = (): LocalizedText => ({ zh: "", en: "" });

const emptyResource = (): NodeResource => ({
  type: "doc",
  title: emptyText(),
  url: "",
  summary: emptyText(),
});

const nodeTemplate = (tracks: GraphTrack[]): GraphNode => {
  const firstTrack = tracks[0]?.id || "seller";
  const now = Date.now();
  return {
    id: `custom-node-${now}`,
    track_ids: [firstTrack],
    title: { zh: "新的知识节点", en: "New knowledge node" },
    summary: { zh: "请在这里填写这个节点要解决的学习问题。", en: "Describe what this node teaches." },
    tags: ["custom"],
    estimated_minutes: 8,
    prerequisites: [],
    validation_questions: [{ zh: "用户最需要回答清楚的问题是什么？", en: "What must the learner be able to answer?" }],
    mastery_criteria: { zh: "能用自己的话讲清这个概念，并能举出一个业务例子。", en: "Can explain the concept in their own words and give one business example." },
    resources: [],
  };
};

const trackTemplate = (): GraphTrack => ({
  id: `track-${Date.now()}`,
  label: { zh: "新路径", en: "New Track" },
  color: "#f59e0b",
});

const csvToList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const listToCsv = (value: string[]) => value.join(", ");

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </div>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-[var(--border)]/70 bg-[var(--background)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[84px] w-full resize-y rounded-xl border border-[var(--border)]/70 bg-[var(--background)] px-3 py-2 text-sm leading-6 outline-none transition focus:border-[var(--primary)] ${props.className || ""}`}
    />
  );
}

const VIS_NODE_W = 260;
const VIS_NODE_H = 118;

interface VisualNodeData {
  title: string;
  nodeId: string;
  trackLabels: string[];
  resources: number;
  questions: number;
  selected: boolean;
  linkSource: boolean;
  manualPosition: boolean;
  isZh: boolean;
  onAddRelative: (nodeId: string, direction: AddDirection) => void;
  onDelete: (nodeId: string) => void;
}

const DIRECTION_ACTIONS: Array<{
  dir: AddDirection;
  className: string;
  Icon: typeof ArrowUp;
}> = [
  { dir: "up", className: "left-1/2 -top-4 -translate-x-1/2", Icon: ArrowUp },
  { dir: "down", className: "bottom-[-18px] left-1/2 -translate-x-1/2", Icon: ArrowDown },
  { dir: "left", className: "left-[-18px] top-1/2 -translate-y-1/2", Icon: ArrowLeft },
  { dir: "right", className: "right-[-18px] top-1/2 -translate-y-1/2", Icon: ArrowRight },
];

const directionLabel = (dir: AddDirection, isZh: boolean) => {
  if (!isZh) {
    return dir === "up"
      ? "Add prerequisite above"
      : dir === "down"
      ? "Add next step below"
      : dir === "left"
      ? "Add sibling branch left"
      : "Add sibling branch right";
  }
  return dir === "up"
    ? "向上新增前置节点"
    : dir === "down"
    ? "向下新增后续节点"
    : dir === "left"
    ? "向左新增同级分支"
    : "向右新增同级分支";
};

function VisualNode({ data }: NodeProps<VisualNodeData>) {
  return (
    <div
      className={`relative rounded-3xl border p-4 shadow-sm transition ${
        data.selected
          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)] ring-2 ring-[var(--primary)]/25"
          : data.linkSource
          ? "border-amber-400 bg-amber-50 text-slate-950 ring-2 ring-amber-300 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-50 dark:ring-amber-500/60"
          : "border-[var(--border)]/70 bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--primary)]/60"
      }`}
      style={{ width: VIS_NODE_W, minHeight: VIS_NODE_H }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[var(--primary)]"
      />
      {DIRECTION_ACTIONS.map(({ dir, className, Icon }) => (
        <button
          key={dir}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data.onAddRelative?.(data.nodeId, dir);
          }}
          className={`absolute ${className} z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-amber-400 text-slate-950 shadow-[2px_2px_0_0_#0f172a] transition hover:scale-110 hover:bg-amber-300 dark:border-amber-100 dark:bg-amber-300`}
          title={directionLabel(dir, data.isZh)}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.8} />
        </button>
      ))}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          data.onDelete?.(data.nodeId);
        }}
        className="absolute bottom-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-500 hover:text-white dark:border-red-500/40 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-500"
        title={data.isZh ? "删除这个节点" : "Delete this node"}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
      </button>
      <div className="mb-2 flex items-center gap-1.5 pr-5">
        {data.trackLabels.slice(0, 2).map((label) => (
          <span
            key={label}
            className="rounded-full border border-[var(--border)]/60 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800/90 dark:text-slate-200"
          >
            {label}
          </span>
        ))}
        {data.manualPosition && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200">
            已排布
          </span>
        )}
      </div>
      <div className="line-clamp-2 text-sm font-semibold leading-snug">{data.title}</div>
      <div className="mt-1 truncate font-mono text-[10px] text-[var(--muted-foreground)]">
        {data.nodeId}
      </div>
      <div className="mt-3 flex gap-2 text-[10px] text-[var(--muted-foreground)]">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {data.questions} 问题
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {data.resources} 资源
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[var(--primary)]"
      />
    </div>
  );
}

const VIS_NODE_TYPES = { visual: VisualNode };

function layoutVisualGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 72, marginx: 32, marginy: 32 });
  nodes.forEach((node) => g.setNode(node.id, { width: VIS_NODE_W, height: VIS_NODE_H }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  dagre.layout(g);
  return nodes.map((node) => {
    const pos = g.node(node.id);
    const data = node.data as VisualNodeData;
    if (data.manualPosition) {
      return {
        ...node,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
    }
    return {
      ...node,
      position: { x: pos.x - VIS_NODE_W / 2, y: pos.y - VIS_NODE_H / 2 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
}

function GraphCanvasInner({
  graph,
  trackFilter,
  selectedNodeId,
  linkSourceId,
  locale,
  isZh,
  onSelectNode,
  onStartLink,
  onCancelLink,
  onToggleRelation,
  onAddRelative,
  onDeleteNode,
  onMoveNode,
  onTrackFilterChange,
}: {
  graph: KnowledgeGraph;
  trackFilter: string;
  selectedNodeId: string;
  linkSourceId: string;
  locale: LocaleKey;
  isZh: boolean;
  onSelectNode: (nodeId: string) => void;
  onStartLink: (nodeId: string) => void;
  onCancelLink: () => void;
  onToggleRelation: (sourceId: string, targetId: string) => void;
  onAddRelative: (nodeId: string, direction: AddDirection) => void;
  onDeleteNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  onTrackFilterChange: (trackId: string) => void;
}) {
  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter((node) =>
        trackFilter === "all" ? true : node.track_ids.includes(trackFilter),
      ),
    [graph.nodes, trackFilter],
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const trackLabelById = useMemo(
    () => new Map(graph.tracks.map((track) => [track.id, track.label[locale] || track.id])),
    [graph.tracks, locale],
  );

  const baseNodes: Node[] = useMemo(
    () =>
      visibleNodes.map((node) => {
        const manualPosition = Boolean(node.position);
        return {
          id: node.id,
          type: "visual",
          position: node.position || { x: 0, y: 0 },
          data: {
            title: node.title[locale] || node.id,
            nodeId: node.id,
            trackLabels: node.track_ids.map((id) => trackLabelById.get(id) || id),
            resources: node.resources?.length || 0,
            questions: node.validation_questions.length,
            selected: node.id === selectedNodeId,
            linkSource: node.id === linkSourceId,
            manualPosition,
            isZh,
            onAddRelative,
            onDelete: onDeleteNode,
          } satisfies VisualNodeData,
        };
      }),
    [visibleNodes, locale, selectedNodeId, linkSourceId, trackLabelById, isZh, onAddRelative, onDeleteNode],
  );

  const baseEdges: Edge[] = useMemo(
    () =>
      visibleNodes.flatMap((node) =>
        node.prerequisites
          .filter((source) => visibleIds.has(source))
          .map((source) => ({
            id: `${source}->${node.id}`,
            source,
            target: node.id,
            type: "smoothstep",
            animated: source === linkSourceId || node.id === selectedNodeId,
            style: {
              stroke: source === linkSourceId ? "#f59e0b" : "#94a3b8",
              strokeWidth: source === linkSourceId ? 2.4 : 1.6,
            },
          })),
      ),
    [visibleNodes, visibleIds, linkSourceId, selectedNodeId],
  );

  const laidOut = useMemo(() => layoutVisualGraph(baseNodes, baseEdges), [baseNodes, baseEdges]);
  const [nodes, setNodes, onNodesChange] = useNodesState(laidOut);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);
  const { fitView } = useReactFlow();

  useEffect(() => {
    setNodes(laidOut);
    setEdges(baseEdges);
    queueMicrotask(() => fitView({ padding: 0.18, duration: 250 }));
  }, [laidOut, baseEdges, setNodes, setEdges, fitView]);

  const selectedTitle =
    graph.nodes.find((node) => node.id === selectedNodeId)?.title[locale] || selectedNodeId;
  const linkSourceTitle =
    graph.nodes.find((node) => node.id === linkSourceId)?.title[locale] || linkSourceId;

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)]/60 bg-[var(--background)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]/50 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{isZh ? "可视化学习地图" : "Visual learning map"}</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {linkSourceId
              ? isZh
                ? `关系模式：已选择「${linkSourceTitle}」作为前置节点，再点击另一个节点即可连线或取消连线。`
                : `Relation mode: "${linkSourceTitle}" is the prerequisite. Click another node to toggle the link.`
              : isZh
              ? "点击节点即可编辑；想调整学习顺序，先选一个节点，再点“设为前置节点”。"
              : "Click a node to edit it. To adjust learning order, select a node and mark it as prerequisite."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-1 flex rounded-2xl border border-[var(--border)]/70 bg-[var(--secondary)]/30 p-1">
            <button
              onClick={() => onTrackFilterChange?.("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                trackFilter === "all"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/70"
              }`}
            >
              {isZh ? "全部" : "All"}
            </button>
            {graph.tracks.map((track) => (
              <button
                key={track.id}
                onClick={() => onTrackFilterChange?.(track.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  trackFilter === track.id
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/70"
                }`}
              >
                {track.label[locale] || track.id}
              </button>
            ))}
          </div>
          <button
            onClick={() => selectedNodeId && onStartLink(selectedNodeId)}
            disabled={!selectedNodeId}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 px-3 py-2 text-xs font-semibold hover:bg-[var(--secondary)]/50 disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" />
            {isZh ? "设为前置节点" : "Use as prerequisite"}
          </button>
          <button
            onClick={() => selectedNodeId && onAddRelative(selectedNodeId, "down")}
            disabled={!selectedNodeId}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {isZh ? "在当前节点后新增" : "Add after selected"}
          </button>
          {linkSourceId && (
            <button
              onClick={onCancelLink}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
            >
              <X className="h-3.5 w-3.5" />
              {isZh ? "退出关系模式" : "Exit relation mode"}
            </button>
          )}
        </div>
      </div>
      <div className="grid border-b border-[var(--border)]/50 bg-[var(--secondary)]/20 px-5 py-3 text-xs text-[var(--muted-foreground)] md:grid-cols-3">
        <div>
          <MousePointer2 className="mr-1 inline h-3.5 w-3.5" />
          {isZh ? "当前选中：" : "Selected: "}
          <span className="font-semibold text-[var(--foreground)]">{selectedTitle || "-"}</span>
        </div>
        <div>
          {isZh ? "节点数：" : "Nodes: "}
          <span className="font-semibold text-[var(--foreground)]">{visibleNodes.length}</span>
        </div>
        <div>
          {isZh ? "连线数：" : "Links: "}
          <span className="font-semibold text-[var(--foreground)]">{baseEdges.length}</span>
        </div>
      </div>
      <div className="h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_32%),linear-gradient(180deg,rgba(148,163,184,0.08),transparent)] [&_.react-flow__controls-button]:!border-[var(--border)] [&_.react-flow__controls-button]:!bg-[var(--background)] [&_.react-flow__controls-button]:!text-[var(--foreground)] [&_.react-flow__minimap]:!bg-[var(--background)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={VIS_NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            if (linkSourceId) {
              onToggleRelation(linkSourceId, node.id);
              return;
            }
            onSelectNode(node.id);
          }}
          onNodeDragStop={(_, node) => {
            onMoveNode?.(node.id, node.position);
          }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          fitView
          minZoom={0.35}
          maxZoom={1.35}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="rgba(127,127,127,0.18)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

function AdminGraphCanvas(props: Parameters<typeof GraphCanvasInner>[0]) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export default function AdminKnowledgeGraphPage() {
  const { i18n } = useTranslation();
  const locale: LocaleKey = i18n.language.startsWith("zh") ? "zh" : "en";
  const isZh = locale === "zh";

  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [linkSourceId, setLinkSourceId] = useState<string>("");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchGraph();
      setGraph(data);
      setSelectedNodeId((current) => current || data.nodes[0]?.id || "");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedNode = useMemo(
    () => graph?.nodes.find((node) => node.id === selectedNodeId) || null,
    [graph, selectedNodeId],
  );

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    const q = query.trim().toLowerCase();
    return graph.nodes.filter((node) => {
      const matchTrack = trackFilter === "all" || node.track_ids.includes(trackFilter);
      const matchQuery =
        !q ||
        node.id.toLowerCase().includes(q) ||
        node.title.zh.toLowerCase().includes(q) ||
        node.title.en.toLowerCase().includes(q);
      return matchTrack && matchQuery;
    });
  }, [graph, query, trackFilter]);

  const mutateGraph = (mutator: (draft: KnowledgeGraph) => KnowledgeGraph) => {
    setGraph((current) => {
      if (!current) return current;
      return mutator(structuredClone(current));
    });
    setMessage("");
  };

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };

  const handleStartLink = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setLinkSourceId(nodeId);
  };

  const handleToggleRelation = (sourceId: string, targetId: string) => {
    if (!graph) return;
    if (sourceId === targetId) {
      setLinkSourceId("");
      setSelectedNodeId(targetId);
      return;
    }
    mutateGraph((draft) => ({
      ...draft,
      nodes: draft.nodes.map((node) => {
        if (node.id !== targetId) return node;
        const exists = node.prerequisites.includes(sourceId);
        return {
          ...node,
          prerequisites: exists
            ? node.prerequisites.filter((id) => id !== sourceId)
            : [...node.prerequisites, sourceId],
        };
      }),
    }));
    setSelectedNodeId(targetId);
    setLinkSourceId("");
  };

  const handleMoveNode = (nodeId: string, position: { x: number; y: number }) => {
    mutateGraph((draft) => ({
      ...draft,
      nodes: draft.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              position: {
                x: Math.round(position.x),
                y: Math.round(position.y),
              },
            }
          : node,
      ),
    }));
    setSelectedNodeId(nodeId);
  };

  const patchSelectedNode = (patch: Partial<GraphNode>) => {
    if (!selectedNode) return;
    mutateGraph((draft) => ({
      ...draft,
      nodes: draft.nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, ...patch } : node,
      ),
    }));
  };

  const patchSelectedLocalized = (
    field: "title" | "summary" | "mastery_criteria",
    key: LocaleKey,
    value: string,
  ) => {
    if (!selectedNode) return;
    patchSelectedNode({
      [field]: { ...selectedNode[field], [key]: value },
    } as Partial<GraphNode>);
  };

  const addNode = () => {
    if (!graph) return;
    const node = nodeTemplate(graph.tracks);
    if (trackFilter !== "all") {
      node.track_ids = [trackFilter];
    }
    mutateGraph((draft) => ({ ...draft, nodes: [...draft.nodes, node] }));
    setSelectedNodeId(node.id);
  };

  const addRelativeNode = (anchorId: string, direction: AddDirection) => {
    if (!graph) return;
    const anchor = graph.nodes.find((node) => node.id === anchorId);
    const node = nodeTemplate(graph.tracks);
    const anchorTitleZh = anchor?.title.zh || "当前节点";
    const anchorTitleEn = anchor?.title.en || "selected node";
    const suffix =
      direction === "up"
        ? "prereq"
        : direction === "down"
        ? "next"
        : direction === "left"
        ? "left"
        : "right";
    node.id = `${anchorId}-${suffix}-${Date.now()}`;
    node.track_ids = anchor?.track_ids?.length
      ? [...anchor.track_ids]
      : trackFilter !== "all"
      ? [trackFilter]
      : node.track_ids;

    if (direction === "up") {
      node.prerequisites = [...(anchor?.prerequisites || [])];
    } else if (direction === "down") {
      node.prerequisites = [anchorId];
    } else {
      node.prerequisites = [...(anchor?.prerequisites || [])];
    }

    const basePosition = anchor?.position || { x: 0, y: 0 };
    const offsets: Record<AddDirection, { x: number; y: number }> = {
      up: { x: 0, y: -210 },
      down: { x: 0, y: 210 },
      left: { x: -340, y: 0 },
      right: { x: 340, y: 0 },
    };
    node.position = {
      x: basePosition.x + offsets[direction].x,
      y: basePosition.y + offsets[direction].y,
    };

    if (direction === "up") {
      node.title = {
        zh: `${anchorTitleZh}：前置概念`,
        en: `${anchorTitleEn}: prerequisite`,
      };
    } else if (direction === "down") {
      node.title = {
        zh: `${anchorTitleZh}：下一关`,
        en: `${anchorTitleEn}: next step`,
      };
    } else {
      node.title = {
        zh: `${anchorTitleZh}：同级分支`,
        en: `${anchorTitleEn}: sibling branch`,
      };
    }

    node.summary = {
      zh: "请补充这一关要让用户真正理解的概念、流程或判断标准。",
      en: "Describe the concept, process, or judgment standard this step should teach.",
    };

    mutateGraph((draft) => ({
      ...draft,
      nodes: [
        ...draft.nodes.map((current) => {
          if (direction === "up" && current.id === anchorId) {
            return {
              ...current,
              prerequisites: Array.from(new Set([...current.prerequisites, node.id])),
            };
          }
          return current;
        }),
        node,
      ],
    }));
    setSelectedNodeId(node.id);
    setLinkSourceId("");
  };

  const deleteSelectedNode = () => {
    if (!graph || !selectedNode) return;
    deleteNodeById(selectedNode.id);
  };

  const deleteNodeById = (nodeId: string) => {
    if (!graph) return;
    const target = graph.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const ok = confirm(
      isZh
        ? `确认删除节点「${target.title.zh || target.id}」？相关前置关系会自动移除。`
        : `Delete node "${target.title.en || target.id}"? Related prerequisites will be removed.`,
    );
    if (!ok) return;
    const nextNodes = graph.nodes
      .filter((node) => node.id !== target.id)
      .map((node) => ({
        ...node,
        prerequisites: node.prerequisites.filter((id) => id !== target.id),
      }));
    mutateGraph((draft) => ({ ...draft, nodes: nextNodes }));
    if (selectedNodeId === target.id) setSelectedNodeId(nextNodes[0]?.id || "");
    if (linkSourceId === target.id) setLinkSourceId("");
  };

  const addTrack = () => {
    const track = trackTemplate();
    mutateGraph((draft) => ({ ...draft, tracks: [...draft.tracks, track] }));
    setTrackFilter(track.id);
  };

  const deleteTrack = (trackId: string) => {
    if (!graph) return;
    const ok = confirm(
      isZh
        ? "删除路径后，节点里关联这个路径的标记也会被移除。确认继续？"
        : "Deleting this track will remove it from all nodes. Continue?",
    );
    if (!ok) return;
    mutateGraph((draft) => ({
      ...draft,
      tracks: draft.tracks.filter((track) => track.id !== trackId),
      nodes: draft.nodes.map((node) => ({
        ...node,
        track_ids: node.track_ids.filter((id) => id !== trackId),
      })),
    }));
    setTrackFilter("all");
  };

  const patchTrack = (trackId: string, patch: Partial<GraphTrack>) => {
    mutateGraph((draft) => ({
      ...draft,
      tracks: draft.tracks.map((track) =>
        track.id === trackId ? { ...track, ...patch } : track,
      ),
    }));
  };

  const patchResource = (index: number, patch: Partial<NodeResource>) => {
    if (!selectedNode) return;
    const resources = [...(selectedNode.resources || [])];
    resources[index] = { ...resources[index], ...patch };
    patchSelectedNode({ resources });
  };

  const patchResourceText = (
    index: number,
    field: "title" | "summary",
    key: LocaleKey,
    value: string,
  ) => {
    const resource = selectedNode?.resources?.[index];
    if (!resource) return;
    patchResource(index, {
      [field]: { ...(resource[field] || emptyText()), [key]: value },
    } as Partial<NodeResource>);
  };

  const save = async () => {
    if (!graph) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const cleaned: KnowledgeGraph = {
        ...graph,
        version: graph.version + 1,
        tracks: graph.tracks.filter((track) => track.id.trim()),
        nodes: graph.nodes.map((node) => ({
          ...node,
          id: node.id.trim(),
          track_ids: node.track_ids.filter(Boolean),
          tags: node.tags.filter(Boolean),
          prerequisites: node.prerequisites.filter(Boolean),
          validation_questions: node.validation_questions.filter((q) => q.zh.trim() || q.en.trim()),
          resources: (node.resources || []).filter(
            (resource) => resource.url.trim() || resource.title.zh.trim() || resource.title.en.trim(),
          ),
        })),
      };
      const saved = await updateGraph(cleaned);
      setGraph(saved);
      setMessage(isZh ? "知识图谱已保存，学习页刷新后会同步更新。" : "Knowledge graph saved. The learning page will update after refresh.");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isZh ? "正在加载知识图谱..." : "Loading knowledge graph..."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {isZh ? "管理后台 / 知识图谱" : "Admin / Knowledge Graph"}
          </div>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em]">
            {isZh ? "知识图谱编辑台" : "Knowledge Graph Editor"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            {isZh
              ? "在这里手动控制学习路径的方向：增删节点、维护资源、设置前置关系和通关标准。保存后，前台学习地图会读取同一份配置。"
              : "Manually shape the learning map: add nodes, manage resources, prerequisites, and mastery criteria. The learner map reads this same source after saving."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 px-4 py-2 text-sm font-medium hover:bg-[var(--secondary)]/50"
          >
            <RefreshCcw className="h-4 w-4" />
            {isZh ? "重新加载" : "Reload"}
          </button>
          <button
            onClick={save}
            disabled={saving || !graph}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? (isZh ? "保存中" : "Saving") : isZh ? "保存图谱" : "Save graph"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          <Check className="mr-2 inline h-4 w-4" />
          {message}
        </div>
      )}

      {graph && (
        <>
          <section className="mb-5 rounded-3xl border border-[var(--border)]/60 bg-[var(--background)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">{isZh ? "学习路径" : "Tracks"}</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {isZh ? "路径决定节点会出现在卖家线、运营线或其他自定义学习线。" : "Tracks decide where each node appears."}
                </p>
              </div>
              <button
                onClick={addTrack}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)]/70 px-3 py-2 text-xs font-semibold hover:bg-[var(--secondary)]/50"
              >
                <Plus className="h-3.5 w-3.5" />
                {isZh ? "新增路径" : "Add track"}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {graph.tracks.map((track) => (
                <div key={track.id} className="rounded-2xl border border-[var(--border)]/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <input
                      type="color"
                      value={track.color || "#f59e0b"}
                      onChange={(event) => patchTrack(track.id, { color: event.target.value })}
                      className="h-8 w-10 rounded-lg border border-[var(--border)] bg-transparent"
                    />
                    <TextInput
                      value={track.id}
                      onChange={(event) => patchTrack(track.id, { id: event.target.value.trim() })}
                      placeholder="track-id"
                    />
                    <button
                      onClick={() => deleteTrack(track.id)}
                      className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600"
                      title={isZh ? "删除路径" : "Delete track"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <TextInput
                      value={track.label.zh}
                      onChange={(event) =>
                        patchTrack(track.id, { label: { ...track.label, zh: event.target.value } })
                      }
                      placeholder="中文名称"
                    />
                    <TextInput
                      value={track.label.en}
                      onChange={(event) =>
                        patchTrack(track.id, { label: { ...track.label, en: event.target.value } })
                      }
                      placeholder="English name"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-5">
            <AdminGraphCanvas
              graph={graph}
              trackFilter={trackFilter}
              selectedNodeId={selectedNodeId}
              linkSourceId={linkSourceId}
              locale={locale}
              isZh={isZh}
              onSelectNode={handleSelectNode}
              onStartLink={handleStartLink}
              onCancelLink={() => setLinkSourceId("")}
              onToggleRelation={handleToggleRelation}
              onAddRelative={addRelativeNode}
              onDeleteNode={deleteNodeById}
              onMoveNode={handleMoveNode}
              onTrackFilterChange={(nextTrackId) => {
                setTrackFilter(nextTrackId);
                setSelectedNodeId("");
                setLinkSourceId("");
              }}
            />
          </section>

          <div className="grid min-h-[720px] gap-5 lg:grid-cols-[360px_1fr]">
            <section className="rounded-3xl border border-[var(--border)]/60 bg-[var(--background)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">{isZh ? "节点列表" : "Nodes"}</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {graph.nodes.length} {isZh ? "个节点" : "nodes"}
                  </p>
                </div>
                <button
                  onClick={addNode}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isZh ? "新增节点" : "Add"}
                </button>
              </div>

              <div className="mb-3 grid gap-2">
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={isZh ? "搜索标题或 ID" : "Search title or ID"}
                />
                <select
                  value={trackFilter}
                  onChange={(event) => setTrackFilter(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)]/70 bg-[var(--background)] px-3 py-2 text-sm outline-none"
                >
                  <option value="all">{isZh ? "全部路径" : "All tracks"}</option>
                  {graph.tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.label[locale] || track.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-[610px] space-y-2 overflow-y-auto pr-1">
                {filteredNodes.map((node) => {
                  const active = node.id === selectedNodeId;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-[var(--primary)] bg-[var(--primary)]/10"
                          : "border-[var(--border)]/50 hover:bg-[var(--secondary)]/35"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">
                          {node.title[locale] || node.id}
                        </div>
                        <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                          {node.estimated_minutes}m
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-[var(--muted-foreground)]">
                        {node.id}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {node.track_ids.map((trackId) => (
                          <span
                            key={trackId}
                            className="rounded-full border border-[var(--border)]/60 px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]"
                          >
                            {trackId}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)]/60 bg-[var(--background)] p-5">
              {selectedNode ? (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border)]/50 pb-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        <GitBranch className="h-4 w-4" />
                        {isZh ? "节点编辑" : "Node editor"}
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold">
                        {selectedNode.title[locale] || selectedNode.id}
                      </h2>
                    </div>
                    <button
                      onClick={deleteSelectedNode}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isZh ? "删除节点" : "Delete"}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Node ID">
                      <TextInput
                        value={selectedNode.id}
                        onChange={(event) => {
                          const nextId = event.target.value.trim();
                          const oldId = selectedNode.id;
                          mutateGraph((draft) => ({
                            ...draft,
                            nodes: draft.nodes.map((node) => {
                              if (node.id === oldId) return { ...node, id: nextId };
                              return {
                                ...node,
                                prerequisites: node.prerequisites.map((id) => (id === oldId ? nextId : id)),
                              };
                            }),
                          }));
                          setSelectedNodeId(nextId);
                        }}
                      />
                    </Field>
                    <Field label={isZh ? "预计学习分钟" : "Estimated minutes"}>
                      <TextInput
                        type="number"
                        min={1}
                        value={selectedNode.estimated_minutes}
                        onChange={(event) =>
                          patchSelectedNode({ estimated_minutes: Number(event.target.value || 1) })
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={isZh ? "中文标题" : "Chinese title"}>
                      <TextInput
                        value={selectedNode.title.zh}
                        onChange={(event) => patchSelectedLocalized("title", "zh", event.target.value)}
                      />
                    </Field>
                    <Field label={isZh ? "英文标题" : "English title"}>
                      <TextInput
                        value={selectedNode.title.en}
                        onChange={(event) => patchSelectedLocalized("title", "en", event.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={isZh ? "中文摘要" : "Chinese summary"}>
                      <TextArea
                        value={selectedNode.summary.zh}
                        onChange={(event) => patchSelectedLocalized("summary", "zh", event.target.value)}
                      />
                    </Field>
                    <Field label={isZh ? "英文摘要" : "English summary"}>
                      <TextArea
                        value={selectedNode.summary.en}
                        onChange={(event) => patchSelectedLocalized("summary", "en", event.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={isZh ? "中文通关标准" : "Chinese mastery criteria"}>
                      <TextArea
                        value={selectedNode.mastery_criteria.zh}
                        onChange={(event) => patchSelectedLocalized("mastery_criteria", "zh", event.target.value)}
                      />
                    </Field>
                    <Field label={isZh ? "英文通关标准" : "English mastery criteria"}>
                      <TextArea
                        value={selectedNode.mastery_criteria.en}
                        onChange={(event) => patchSelectedLocalized("mastery_criteria", "en", event.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={isZh ? "所属路径" : "Tracks"}>
                      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)]/60 p-3">
                        {graph.tracks.map((track) => {
                          const checked = selectedNode.track_ids.includes(track.id);
                          return (
                            <button
                              type="button"
                              key={track.id}
                              onClick={() => {
                                const next = checked
                                  ? selectedNode.track_ids.filter((id) => id !== track.id)
                                  : [...selectedNode.track_ids, track.id];
                                patchSelectedNode({ track_ids: next });
                              }}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                checked
                                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                                  : "border-[var(--border)]/70 text-[var(--muted-foreground)]"
                              }`}
                            >
                              {track.label[locale] || track.id}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label={isZh ? "标签，逗号分隔" : "Tags, comma separated"}>
                      <TextInput
                        value={listToCsv(selectedNode.tags)}
                        onChange={(event) => patchSelectedNode({ tags: csvToList(event.target.value) })}
                      />
                    </Field>
                  </div>

                  <Field label={isZh ? "前置节点 ID，逗号分隔" : "Prerequisite node IDs, comma separated"}>
                    <TextInput
                      value={listToCsv(selectedNode.prerequisites)}
                      onChange={(event) => patchSelectedNode({ prerequisites: csvToList(event.target.value) })}
                    />
                  </Field>

                  <div className="rounded-3xl border border-[var(--border)]/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{isZh ? "验证问题" : "Validation questions"}</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {isZh ? "用于判断用户是不是真的懂了这个节点。" : "Used to judge whether the learner really understands this node."}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          patchSelectedNode({
                            validation_questions: [...selectedNode.validation_questions, emptyText()],
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)]/70 px-3 py-2 text-xs font-semibold hover:bg-[var(--secondary)]/50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {isZh ? "新增问题" : "Add"}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {selectedNode.validation_questions.map((question, index) => (
                        <div key={`${selectedNode.id}-q-${index}`} className="grid gap-2 rounded-2xl bg-[var(--secondary)]/25 p-3 md:grid-cols-[1fr_1fr_auto]">
                          <TextInput
                            value={question.zh}
                            onChange={(event) => {
                              const questions = [...selectedNode.validation_questions];
                              questions[index] = { ...question, zh: event.target.value };
                              patchSelectedNode({ validation_questions: questions });
                            }}
                            placeholder="中文问题"
                          />
                          <TextInput
                            value={question.en}
                            onChange={(event) => {
                              const questions = [...selectedNode.validation_questions];
                              questions[index] = { ...question, en: event.target.value };
                              patchSelectedNode({ validation_questions: questions });
                            }}
                            placeholder="English question"
                          />
                          <button
                            onClick={() =>
                              patchSelectedNode({
                                validation_questions: selectedNode.validation_questions.filter((_, i) => i !== index),
                              })
                            }
                            className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--border)]/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{isZh ? "学习资源" : "Learning resources"}</h3>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {isZh ? "可放 Obsidian、飞书、多维表格、视频或外部链接。" : "Add Obsidian, Feishu, Bitable, video, or external links."}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          patchSelectedNode({
                            resources: [...(selectedNode.resources || []), emptyResource()],
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)]/70 px-3 py-2 text-xs font-semibold hover:bg-[var(--secondary)]/50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {isZh ? "新增资源" : "Add resource"}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {(selectedNode.resources || []).map((resource, index) => (
                        <div key={`${selectedNode.id}-r-${index}`} className="rounded-2xl bg-[var(--secondary)]/25 p-4">
                          <div className="mb-3 grid gap-2 md:grid-cols-[130px_1fr_auto]">
                            <select
                              value={resource.type}
                              onChange={(event) =>
                                patchResource(index, { type: event.target.value as NodeResource["type"] })
                              }
                              className="rounded-xl border border-[var(--border)]/70 bg-[var(--background)] px-3 py-2 text-sm outline-none"
                            >
                              <option value="doc">doc</option>
                              <option value="article">article</option>
                              <option value="video">video</option>
                              <option value="link">link</option>
                            </select>
                            <TextInput
                              value={resource.url}
                              onChange={(event) => patchResource(index, { url: event.target.value })}
                              placeholder="https://..."
                            />
                            <button
                              onClick={() =>
                                patchSelectedNode({
                                  resources: (selectedNode.resources || []).filter((_, i) => i !== index),
                                })
                              }
                              className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <TextInput
                              value={resource.title.zh}
                              onChange={(event) => patchResourceText(index, "title", "zh", event.target.value)}
                              placeholder="中文资源标题"
                            />
                            <TextInput
                              value={resource.title.en}
                              onChange={(event) => patchResourceText(index, "title", "en", event.target.value)}
                              placeholder="English resource title"
                            />
                            <TextArea
                              value={resource.summary?.zh || ""}
                              onChange={(event) => patchResourceText(index, "summary", "zh", event.target.value)}
                              placeholder="中文资源说明"
                            />
                            <TextArea
                              value={resource.summary?.en || ""}
                              onChange={(event) => patchResourceText(index, "summary", "en", event.target.value)}
                              placeholder="English resource summary"
                            />
                          </div>
                        </div>
                      ))}
                      {!selectedNode.resources?.length && (
                        <div className="rounded-2xl border border-dashed border-[var(--border)]/70 p-8 text-center text-sm text-[var(--muted-foreground)]">
                          <BookOpen className="mx-auto mb-2 h-5 w-5" />
                          {isZh ? "这个节点还没有资源。" : "No resources yet."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-[var(--border)]/70 p-10 text-center text-sm text-[var(--muted-foreground)]">
                  {isZh ? "请选择一个节点，或新增第一个知识节点。" : "Select a node, or add the first knowledge node."}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

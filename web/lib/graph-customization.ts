"use client";

import { type Edge, MarkerType, type Node, Position } from "reactflow";
import { loadFromStorage, saveToStorage } from "@/lib/persistence";
import { getNodeStatus, type GraphNode, type KnowledgeGraph } from "@/lib/knowledge-graph";

// ─── Types ──────────────────────────────────────────────────────────

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface UserNode {
  id: string; // "user-{shortUuid}"
  title: LocalizedText;
  summary: LocalizedText;
  tags: string[];
  position: { x: number; y: number };
  track_ids: string[];
  created_at: number;
  updated_at: number;
}

export interface UserEdge {
  id: string; // "user-edge-{shortUuid}"
  source: string;
  target: string;
  label?: string;
  created_at: number;
}

export interface UserAnnotation {
  id: string; // "anno-{shortUuid}"
  text: string;
  position: { x: number; y: number };
  created_at: number;
  updated_at: number;
}

export interface UserGraphCustomization {
  track_id: string;
  userNodes: UserNode[];
  userEdges: UserEdge[];
  annotations: UserAnnotation[];
  updated_at: number;
}

// ─── Storage Key ────────────────────────────────────────────────────

const CUSTOMIZATION_PREFIX = "graph_customization_";

function storageKey(trackId: string): string {
  return `${CUSTOMIZATION_PREFIX}${trackId}`;
}

// ─── ID Generation ──────────────────────────────────────────────────

function shortUuid(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function userId(): string {
  return `user-${shortUuid()}`;
}

export function userEdgeId(): string {
  return `user-edge-${shortUuid()}`;
}

export function annotationId(): string {
  return `anno-${shortUuid()}`;
}

// ─── Persistence ────────────────────────────────────────────────────

export function loadCustomization(
  trackId: string,
): UserGraphCustomization {
  return loadFromStorage<UserGraphCustomization>(
    storageKey(trackId),
    {
      track_id: trackId,
      userNodes: [],
      userEdges: [],
      annotations: [],
      updated_at: Date.now(),
    },
  );
}

export function saveCustomization(customization: UserGraphCustomization): void {
  saveToStorage(storageKey(customization.track_id), {
    ...customization,
    updated_at: Date.now(),
  });
}

// ─── CRUD: User Nodes ───────────────────────────────────────────────

export function addUserNode(
  customization: UserGraphCustomization,
  position: { x: number; y: number },
  trackColor: string,
  locale: "zh" | "en" = "zh",
): UserGraphCustomization {
  const node: UserNode = {
    id: userId(),
    title: { zh: "新节点", en: "New Node" },
    summary: { zh: "双击编辑内容", en: "Double-click to edit" },
    tags: [],
    position,
    track_ids: [customization.track_id],
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  return {
    ...customization,
    userNodes: [...customization.userNodes, node],
  };
}

export function updateUserNode(
  customization: UserGraphCustomization,
  nodeId: string,
  patch: Partial<Pick<UserNode, "title" | "summary" | "tags" | "position">>,
): UserGraphCustomization {
  return {
    ...customization,
    userNodes: customization.userNodes.map((n) =>
      n.id === nodeId ? { ...n, ...patch, updated_at: Date.now() } : n,
    ),
  };
}

export function deleteUserNode(
  customization: UserGraphCustomization,
  nodeId: string,
): UserGraphCustomization {
  return {
    ...customization,
    userNodes: customization.userNodes.filter((n) => n.id !== nodeId),
    // Also remove any edges connected to this node
    userEdges: customization.userEdges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    ),
  };
}

// ─── CRUD: User Edges ───────────────────────────────────────────────

export function addUserEdge(
  customization: UserGraphCustomization,
  source: string,
  target: string,
  label?: string,
): UserGraphCustomization {
  // Prevent duplicate edges
  const exists = customization.userEdges.some(
    (e) => e.source === source && e.target === target,
  );
  if (exists) return customization;

  const edge: UserEdge = {
    id: userEdgeId(),
    source,
    target,
    label,
    created_at: Date.now(),
  };
  return {
    ...customization,
    userEdges: [...customization.userEdges, edge],
  };
}

export function deleteUserEdge(
  customization: UserGraphCustomization,
  edgeId: string,
): UserGraphCustomization {
  return {
    ...customization,
    userEdges: customization.userEdges.filter((e) => e.id !== edgeId),
  };
}

// ─── CRUD: Annotations ──────────────────────────────────────────────

export function addAnnotation(
  customization: UserGraphCustomization,
  position: { x: number; y: number },
  text = "双击编辑",
): UserGraphCustomization {
  const anno: UserAnnotation = {
    id: annotationId(),
    text,
    position,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  return {
    ...customization,
    annotations: [...customization.annotations, anno],
  };
}

export function updateAnnotation(
  customization: UserGraphCustomization,
  annotationId: string,
  text: string,
): UserGraphCustomization {
  return {
    ...customization,
    annotations: customization.annotations.map((a) =>
      a.id === annotationId ? { ...a, text, updated_at: Date.now() } : a,
    ),
  };
}

export function updateAnnotationPosition(
  customization: UserGraphCustomization,
  annotationId: string,
  position: { x: number; y: number },
): UserGraphCustomization {
  return {
    ...customization,
    annotations: customization.annotations.map((a) =>
      a.id === annotationId ? { ...a, position, updated_at: Date.now() } : a,
    ),
  };
}

export function deleteAnnotation(
  customization: UserGraphCustomization,
  annotationId: string,
): UserGraphCustomization {
  return {
    ...customization,
    annotations: customization.annotations.filter(
      (a) => a.id !== annotationId,
    ),
  };
}

// ─── Merge: public graph + user customization → ReactFlow nodes/edges ──

export interface MergedGraphResult {
  flowNodes: Node[];
  flowEdges: Edge[];
}

/**
 * Merge public knowledge graph skeleton with user customization into
 * ReactFlow-compatible nodes and edges.
 *
 * Public edges (from prerequisites) are solid.
 * User-drawn edges are dashed.
 * Annotations are free-floating sticky-note nodes.
 */
export function mergeGraphs(
  graph: KnowledgeGraph,
  trackId: string,
  customization: UserGraphCustomization,
  masteredIds: Set<string>,
  selectedNodeId: string | null,
  previewNodeId: string | null,
  focusVersion: number,
  trackColor: string,
  locale: "zh" | "en" = "zh",
  nodeW = 330,
  nodeH = 154,
  nodeGap = 112,
): MergedGraphResult {
  const trackNodes = graph.nodes.filter((n) =>
    n.track_ids.includes(trackId),
  );
  const nodeIdSet = new Set(trackNodes.map((n) => n.id));

  // ── Public skeleton nodes (vertical layout) ──
  const flowNodes: Node[] = trackNodes.map((n, index) => {
    const tags = n.tags || [];
    const nodeStatus = getNodeStatus(n, masteredIds);
    return {
      id: n.id,
      type: "graph",
      position: n.position || { x: -nodeW / 2, y: index * (nodeH + nodeGap) },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        origin: "public",
        title: n.title[locale],
        summary: n.summary[locale],
        status: nodeStatus,
        estMinutes: n.estimated_minutes,
        stepNumber: index + 1,
        resourceCount: n.resources?.length || 0,
        selected: selectedNodeId === n.id,
        previewed: previewNodeId === n.id,
        focusVersion: selectedNodeId === n.id ? focusVersion : 0,
        trackColor,
        kind: tags.includes("foundation") ? "foundation" : tags.includes("review") ? "review" : "topic",
        tags,
        nodeWidth: nodeW,
        nodeHeight: nodeH,
      },
    };
  });

  // ── Public prerequisite edges (solid) ──
  const flowEdges: Edge[] = trackNodes.flatMap((n) =>
    n.prerequisites
      .filter((p) => nodeIdSet.has(p))
      .map((p) => ({
        id: `pub-${p}->${n.id}`,
        source: p,
        target: n.id,
        type: "smoothstep",
        animated: false,
        className: "public-edge",
        style: {
          stroke: masteredIds.has(p) && masteredIds.has(n.id)
            ? "#10b981"
            : masteredIds.has(p)
              ? trackColor
              : "#64748b",
          strokeWidth: masteredIds.has(p) ? 2.4 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: masteredIds.has(p) && masteredIds.has(n.id)
            ? "#10b981"
            : masteredIds.has(p)
              ? trackColor
              : "#64748b",
        },
      })),
  );

  // ── User-created nodes ──
  for (const un of customization.userNodes) {
    // Only include nodes for this track
    if (!un.track_ids.includes(trackId)) continue;

    flowNodes.push({
      id: un.id,
      type: "graph",
      position: un.position,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        origin: "user",
        title: un.title[locale],
        summary: un.summary[locale],
        status: "unlocked" as const,
        estMinutes: 0,
        stepNumber: 0,
        resourceCount: 0,
        selected: selectedNodeId === un.id,
        previewed: previewNodeId === un.id,
        focusVersion: selectedNodeId === un.id ? focusVersion : 0,
        trackColor,
        kind: "topic" as const,
        tags: un.tags || [],
        nodeWidth: nodeW,
        nodeHeight: nodeH,
      },
    });
  }

  // ── User-drawn edges (dashed) ──
  for (const ue of customization.userEdges) {
    // Both endpoints must exist in the merged node set (public + user)
    const allNodeIds = new Set(flowNodes.map((n) => n.id));
    if (!allNodeIds.has(ue.source) || !allNodeIds.has(ue.target)) continue;

    flowEdges.push({
      id: ue.id,
      source: ue.source,
      target: ue.target,
      type: "smoothstep",
      animated: false,
      className: "user-edge",
      style: {
        stroke: "#f59e0b",
        strokeWidth: 2,
        strokeDasharray: "6 4",
      },
      label: ue.label || undefined,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#f59e0b",
      },
    });
  }

  // ── Annotations (sticky notes) ──
  for (const anno of customization.annotations) {
    flowNodes.push({
      id: anno.id,
      type: "annotation",
      position: anno.position,
      draggable: true,
      data: {
        text: anno.text,
      },
    });
  }

  return { flowNodes, flowEdges };
}

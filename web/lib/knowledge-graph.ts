"use client";

import { apiUrl } from "@/lib/api";

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface GraphTrack {
  id: string;
  label: LocalizedText;
  color: string;
}

export interface NodeResource {
  type: "article" | "doc" | "video" | "link";
  title: LocalizedText;
  url: string;
  summary?: LocalizedText;
}

export interface GraphNode {
  id: string;
  track_ids: string[];
  title: LocalizedText;
  summary: LocalizedText;
  tags: string[];
  estimated_minutes: number;
  prerequisites: string[];
  validation_questions: LocalizedText[];
  mastery_criteria: LocalizedText;
  resources?: NodeResource[];
  position?: { x: number; y: number };
}

export interface KnowledgeGraph {
  version: number;
  tracks: GraphTrack[];
  nodes: GraphNode[];
}

export interface ProgressRow {
  email: string;
  node_id: string;
  status: "in_progress" | "mastered" | "skipped";
  mastered_at: number | null;
  last_seen_at: number;
  notes: string;
}

export interface MasteryCheckResult {
  mastered: boolean;
  status: "mastered" | "partial" | "not_mastered" | string;
  confidence: number;
  reasoning: string;
  missing_points?: string[];
  next_followup: string;
  next_node?: Pick<
    GraphNode,
    "id" | "track_ids" | "title" | "summary" | "mastery_criteria"
  > | null;
  review_resources: Array<NodeResource & { node_id?: string }>;
}

const COMMON: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
};

export async function fetchGraph(): Promise<KnowledgeGraph> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph"), {
    ...COMMON,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`graph_fetch_failed:${r.status}`);
  const data = (await r.json()) as { graph: KnowledgeGraph };
  return data.graph;
}

export async function updateGraph(graph: KnowledgeGraph): Promise<KnowledgeGraph> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph"), {
    ...COMMON,
    method: "PUT",
    body: JSON.stringify({ graph }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `graph_update_failed:${r.status}`);
  }
  const data = (await r.json()) as { graph: KnowledgeGraph };
  return data.graph;
}

export async function fetchMyProgress(): Promise<{
  progress: ProgressRow[];
  mastered_node_ids: string[];
}> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/progress"), {
    ...COMMON,
    cache: "no-store",
  });
  if (r.status === 401) return { progress: [], mastered_node_ids: [] };
  if (!r.ok) throw new Error(`progress_fetch_failed:${r.status}`);
  return (await r.json()) as {
    progress: ProgressRow[];
    mastered_node_ids: string[];
  };
}

export async function recommendNext(
  trackId?: string,
  limit: number = 5,
): Promise<{
  mastered_node_ids: string[];
  candidates: GraphNode[];
}> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/recommend-next"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify({ track_id: trackId || null, limit }),
  });
  if (!r.ok) throw new Error(`recommend_failed:${r.status}`);
  return (await r.json()) as {
    mastered_node_ids: string[];
    candidates: GraphNode[];
  };
}

export async function upsertProgress(
  nodeId: string,
  status: "in_progress" | "mastered" | "skipped",
  notes?: string,
): Promise<ProgressRow | null> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/progress"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify({ node_id: nodeId, status, notes: notes || "" }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `progress_upsert_failed:${r.status}`);
  }
  const data = (await r.json()) as { progress: ProgressRow };
  return data.progress;
}

export async function checkMastery(
  nodeId: string,
  transcript: Array<{ role: "assistant" | "user"; content: string }>,
): Promise<MasteryCheckResult> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/check-mastery"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify({ node_id: nodeId, transcript }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `mastery_check_failed:${r.status}`);
  }
  return (await r.json()) as MasteryCheckResult;
}

export async function tutor(
  nodeId: string,
  messages: Array<{ role: "assistant" | "user"; content: string }>,
): Promise<{ reply: string; mastery_signal: boolean }> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/tutor"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify({ node_id: nodeId, messages }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `tutor_failed:${r.status}`);
  }
  return (await r.json()) as { reply: string; mastery_signal: boolean };
}

export async function resetProgress(nodeId?: string): Promise<number> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/progress"), {
    ...COMMON,
    method: "DELETE",
    body: JSON.stringify({ node_id: nodeId || null }),
  });
  if (!r.ok) throw new Error(`reset_failed:${r.status}`);
  const data = (await r.json()) as { deleted: number };
  return data.deleted;
}

// ─── Pure-client graph helpers (no API) ──────────────────────────────────

export function getNodeStatus(
  node: GraphNode,
  masteredIds: Set<string>,
): "mastered" | "unlocked" | "locked" {
  if (masteredIds.has(node.id)) return "mastered";
  const allPrereqsDone = node.prerequisites.every((p) => masteredIds.has(p));
  return allPrereqsDone ? "unlocked" : "locked";
}

export function groupNodesByTrack(graph: KnowledgeGraph, trackId?: string): GraphNode[] {
  if (!trackId) return graph.nodes;
  return graph.nodes.filter((n) => n.track_ids.includes(trackId));
}

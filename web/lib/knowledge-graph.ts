"use client";

import { apiUrl } from "@/lib/api";
import type { FlowStageId } from "@/lib/ecosystem-data";

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
  is_premium?: boolean; // undefined = 免费，管理员可在知识库中标记付费资源
}

export interface PracticalTask {
  zh: string;
  en: string;
  evaluation_criteria?: { zh: string; en: string };
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
  practical_task?: PracticalTask;
  /** Explicit 5-stage classification. Falls back to keyword matching if absent. */
  stage_ids?: FlowStageId[];
}

export interface TaskEvalResult {
  node_id: string;
  passed: boolean;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  next_step: string;
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

export async function fetchUserProgress(email: string): Promise<{
  progress: ProgressRow[];
  mastered_node_ids: string[];
  email: string;
}> {
  const r = await fetch(apiUrl(`/api/v1/knowledge-graph/progress/${encodeURIComponent(email)}`), {
    ...COMMON,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`user_progress_fetch_failed:${r.status}`);
  return (await r.json()) as {
    progress: ProgressRow[];
    mastered_node_ids: string[];
    email: string;
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
  viewedResources?: Array<{ url: string; title: string; viewedAt: number }>,
): Promise<MasteryCheckResult> {
  const body: Record<string, unknown> = { node_id: nodeId, transcript };
  if (viewedResources && viewedResources.length > 0) {
    body.viewed_resources = viewedResources;
  }
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/check-mastery"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify(body),
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
  viewedResources?: Array<{ url: string; title: string; viewedAt: number }>,
  nodeMeta?: { node_title?: string; node_summary?: string; node_mastery_criteria?: string },
): Promise<{ reply: string; mastery_signal: boolean }> {
  const body: Record<string, unknown> = { node_id: nodeId, messages };
  if (viewedResources && viewedResources.length > 0) {
    body.viewed_resources = viewedResources;
  }
  if (nodeMeta) {
    if (nodeMeta.node_title) body.node_title = nodeMeta.node_title;
    if (nodeMeta.node_summary) body.node_summary = nodeMeta.node_summary;
    if (nodeMeta.node_mastery_criteria) body.node_mastery_criteria = nodeMeta.node_mastery_criteria;
  }
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/tutor"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `tutor_failed:${r.status}`);
  }
  return (await r.json()) as { reply: string; mastery_signal: boolean };
}

export async function evaluateTask(
  nodeId: string,
  taskAnswer: string,
): Promise<TaskEvalResult> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/evaluate-task"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify({ node_id: nodeId, task_answer: taskAnswer }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `evaluate_task_failed:${r.status}`);
  }
  return (await r.json()) as TaskEvalResult;
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

// ─── Resource fetch proxy (inline reading via Feishu Open API) ───────────

/** A single inline text element from a Feishu doc block. */
export interface FeishuElement {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  link: string | null;
}

/**
 * A structured content block returned by the Feishu Docx API.
 * Replaces the old markdown-text-based approach.
 */
export type FeishuBlock =
  | { type: "heading"; level: number; elements: FeishuElement[] }
  | { type: "paragraph"; elements: FeishuElement[] }
  | { type: "list"; ordered: boolean; elements: FeishuElement[] }
  | { type: "code"; text: string; language: number }
  | { type: "blockquote"; elements: FeishuElement[] }
  | { type: "callout"; elements: FeishuElement[] }
  | { type: "divider" };

export interface RelatedLink {
  concept: string;   // matched concept name
  doc_url: string;   // linked document URL
  doc_title: string; // linked document title
  node_id: string;   // owning node ID
}

export interface FetchResourceResult {
  url: string;
  title: string;
  content: string; // plain-text fallback
  blocks: FeishuBlock[];
  related_links: RelatedLink[];
  error: string;
}

export async function fetchResourceContent(
  url: string,
): Promise<FetchResourceResult> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/fetch-resource"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify({ url }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `fetch_resource_failed:${r.status}`);
  }
  return (await r.json()) as FetchResourceResult;
}

// ─── Document Explainer (inline AI assistant) ─────────────────────────────

export interface ExplainPayload {
  node_id: string;
  document_url: string;
  document_title: string;
  document_content: string;
  question: string;
  conversation_history: { role: "user" | "assistant"; content: string }[];
}

export interface ExplainResult {
  reply: string;
}

export async function explainDocument(
  payload: ExplainPayload,
): Promise<ExplainResult> {
  const r = await fetch(apiUrl("/api/v1/knowledge-graph/explain"), {
    ...COMMON,
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `explain_failed:${r.status}`);
  }
  return (await r.json()) as ExplainResult;
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

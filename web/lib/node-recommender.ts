// ─── Node recommendation algorithm ──────────────────────────────────
// Recommends the next learning node based on stage, focus direction,
// and user progress.

import type { GraphNode } from "@/lib/knowledge-graph";
import type { FlowStageId, FocusDirectionId } from "@/lib/ecosystem-data";
import {
  classifyNodeToStage,
  classifyNodeToFocus,
  STAGE_ORDER,
} from "@/lib/ecosystem-data";

export interface RecommendationResult {
  /** The recommended node, or null if none found. */
  node: GraphNode | null;
  /** Why this node was recommended (for debugging / transparency). */
  reason: string;
}

/**
 * Recommend the best next node for a user given their current stage,
 * focus direction, and progress.
 *
 * Priority chain:
 * 1. Matches current stage
 * 2. Prefers nodes matching focus direction
 * 3. Excludes already-mastered nodes
 * 4. Only nodes whose prerequisites are all met
 * 5. Shorter estimated time first
 * 6. Falls back to the first available node in the stage
 */
export function recommendNode(
  nodes: GraphNode[],
  stage: FlowStageId,
  focus: FocusDirectionId,
  masteredIds: Set<string>,
): RecommendationResult {
  // 1. Filter by stage
  let candidates = nodes.filter((n) => classifyNodeToStage(n) === stage);

  if (candidates.length === 0) {
    return { node: null, reason: `No nodes found for stage: ${stage}` };
  }

  // 2. Sort: focus-matching nodes first
  const focusFirst = [...candidates].sort((a, b) => {
    const aMatch = nodeMatchesFocus(a, focus);
    const bMatch = nodeMatchesFocus(b, focus);
    return (bMatch ? 1 : 0) - (aMatch ? 1 : 0);
  });

  // 3. Exclude mastered
  const unmastered = focusFirst.filter((n) => !masteredIds.has(n.id));

  // 4. Prefer nodes with met prerequisites
  const prereqsMet = unmastered.filter((n) =>
    arePrerequisitesMet(n, masteredIds),
  );

  const pool = prereqsMet.length > 0 ? prereqsMet : unmastered;

  // 5. Sort by estimated time (shorter first)
  pool.sort((a, b) => (a.estimated_minutes ?? 30) - (b.estimated_minutes ?? 30));

  // 6. Return first
  const node = pool[0] ?? candidates[0] ?? null;

  const reasons: string[] = [];
  if (node) {
    reasons.push(`Stage: ${stage}`);
    if (nodeMatchesFocus(node, focus)) reasons.push(`Focus: ${focus}`);
    if (!masteredIds.has(node.id)) reasons.push("Unmastered");
    if (arePrerequisitesMet(node, masteredIds)) reasons.push("Prerequisites met");
    reasons.push(`Est. ${node.estimated_minutes ?? "?"} min`);
  }

  return {
    node,
    reason: reasons.join(" | ") || "No suitable node found",
  };
}

/** Check if all of a node's prerequisites are mastered. */
function arePrerequisitesMet(
  node: GraphNode,
  masteredIds: Set<string>,
): boolean {
  if (!node.prerequisites || node.prerequisites.length === 0) return true;
  return node.prerequisites.every((pid) => masteredIds.has(pid));
}

/** Check if a node matches the given focus direction. */
function nodeMatchesFocus(
  node: GraphNode,
  focus: FocusDirectionId,
): boolean {
  if (focus === "all") return true;
  const nodeFocuses = classifyNodeToFocus(node);
  return nodeFocuses.includes(focus);
}

/**
 * Get all nodes belonging to a stage, sorted by focus relevance.
 */
export function getStageNodes(
  nodes: GraphNode[],
  stage: FlowStageId,
  focus: FocusDirectionId,
): GraphNode[] {
  const stageNodes = nodes.filter((n) => classifyNodeToStage(n) === stage);

  return stageNodes.sort((a, b) => {
    const aMatch = nodeMatchesFocus(a, focus);
    const bMatch = nodeMatchesFocus(b, focus);
    if (aMatch !== bMatch) return bMatch ? 1 : -1;

    // Secondary: mastered nodes after unmastered
    // (handled by the caller typically)
    return (a.estimated_minutes ?? 30) - (b.estimated_minutes ?? 30);
  });
}

/**
 * Compute stage completion status for the 5-stage path display.
 */
export type StageStatus = "locked" | "available" | "in_progress" | "completed";

export function computeStageStatuses(
  nodes: GraphNode[],
  masteredIds: Set<string>,
): Record<string, StageStatus> {
  const statuses: Record<string, StageStatus> = {};

  let firstUncompletedFound = false;

  for (const stageId of STAGE_ORDER) {
    const stageNodes = nodes.filter(
      (n) => classifyNodeToStage(n) === stageId,
    );

    if (stageNodes.length === 0) {
      statuses[stageId] = firstUncompletedFound ? "locked" : "available";
      continue;
    }

    const allMastered = stageNodes.every((n) => masteredIds.has(n.id));

    if (allMastered) {
      statuses[stageId] = "completed";
    } else if (!firstUncompletedFound) {
      statuses[stageId] = "in_progress";
      firstUncompletedFound = true;
    } else {
      statuses[stageId] = "locked";
    }
  }

  return statuses;
}

import type { GraphNode } from "@/lib/knowledge-graph";

// ─── Region Definitions ──────────────────────────────────────────

export type RegionId = "traffic" | "transaction" | "fulfillment" | "infrastructure";

export interface RegionDefinition {
  id: RegionId;
  label: { zh: string; en: string };
  description: { zh: string; en: string };
  tags: Set<string>;
  color: string;
  icon: string;
}

export const REGIONS: Record<RegionId, RegionDefinition> = {
  traffic: {
    id: "traffic",
    label: { zh: "流量层", en: "Traffic Layer" },
    description: {
      zh: "用户获取、渠道分发与流量转化",
      en: "User acquisition, channel distribution & traffic conversion",
    },
    tags: new Set([
      "traffic", "discovery", "funnel", "conversion",
      "channels", "promotion", "kol",
    ]),
    color: "#0891b2", // cyan-600
    icon: "Globe",
  },
  transaction: {
    id: "transaction",
    label: { zh: "交易层", en: "Transaction Layer" },
    description: {
      zh: "卖家运营、平台规则与收入模型",
      en: "Seller operations, platform rules & revenue models",
    },
    tags: new Set(["platforms", "revenue"]),
    color: "#7c3aed", // violet-600
    icon: "ShoppingCart",
  },
  fulfillment: {
    id: "fulfillment",
    label: { zh: "履约层", en: "Fulfillment Layer" },
    description: {
      zh: "物流配送与订单履约",
      en: "Logistics, delivery & order fulfillment",
    },
    tags: new Set(["fulfillment", "logistics"]),
    color: "#ea580c", // orange-600
    icon: "Truck",
  },
  infrastructure: {
    id: "infrastructure",
    label: { zh: "基建层", en: "Infrastructure Layer" },
    description: {
      zh: "数据系统、底层机制与通识概念",
      en: "Data systems, core mechanics & foundational concepts",
    },
    tags: new Set([
      "foundation", "system", "data", "mechanics",
      "concept", "roles", "review",
    ]),
    color: "#6b7280", // gray-500
    icon: "Database",
  },
};

// ─── Node Classification ─────────────────────────────────────────

/**
 * Priority order for tie-breaking when a node matches multiple regions equally.
 * Lower index = higher priority.
 */
const REGION_PRIORITY: RegionId[] = ["infrastructure", "traffic", "transaction", "fulfillment"];

/**
 * Keyword → region mapping for title-based fallback classification.
 * Used when tags provide no signal (e.g. diagnostic/personalized nodes).
 */
const TITLE_KEYWORDS: { pattern: RegExp; region: RegionId }[] = [
  { pattern: /流量|发现|渠道|推广|转化|KOL|下单|买家.*看到|买家.*从哪|从哪里.*商品|funnel|channel|traffic|acquisition|discovery|promotion|conversion/i, region: "traffic" },
  { pattern: /交易|平台规则|收入|佣金|定价|revenue|transaction|platform|commission|pricing/i, region: "transaction" },
  { pattern: /履约|物流|配送|发货|海外|海关|快递|中国.*海外|fulfillment|logistics|shipping|delivery|customs/i, region: "fulfillment" },
  { pattern: /基础|概念|系统|数据|复盘|foundation|concept|system|data|review|mechanic/i, region: "infrastructure" },
];

/**
 * Classify a node into its primary region based on tags.
 * Uses best-match scoring: the region with the most matching tags wins.
 * Ties are broken by REGION_PRIORITY order.
 * Falls back to title keyword matching, then track_ids, then defaults to "infrastructure".
 */
export function classifyNodeToRegion(node: GraphNode): RegionId {
  const tags = node.tags || [];

  // Score each region by how many of the node's tags match
  let bestRegion: RegionId = "infrastructure";
  let bestScore = 0;

  for (const regionId of Object.keys(REGIONS) as RegionId[]) {
    const def = REGIONS[regionId];
    let score = 0;
    for (const tag of tags) {
      if (def.tags.has(tag)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRegion = regionId;
    } else if (score === bestScore && score > 0) {
      // Tie-break by priority order
      const currentIdx = REGION_PRIORITY.indexOf(regionId);
      const bestIdx = REGION_PRIORITY.indexOf(bestRegion);
      if (currentIdx < bestIdx) {
        bestRegion = regionId;
      }
    }
  }

  // If no tag matched, try title-based keyword matching.
  // Only match on the title — summaries often mention cross-region concepts
  // (e.g. a roles node mentioning "海外买家" shouldn't be classified as fulfillment).
  if (bestScore === 0) {
    const title = node.title?.zh || "";
    for (const { pattern, region } of TITLE_KEYWORDS) {
      if (pattern.test(title)) return region;
    }
  }

  // If still no match, try track_ids as fallback
  if (bestScore === 0 && node.track_ids?.length) {
    for (const tid of node.track_ids) {
      for (const regionId of Object.keys(REGIONS) as RegionId[]) {
        if (REGIONS[regionId].tags.has(tid)) {
          return regionId;
        }
      }
    }
  }

  return bestRegion;
}

/**
 * Group track-filtered nodes into their respective regions.
 * Nodes are sorted by step order within each region.
 */
export function groupNodesByRegion(
  nodes: GraphNode[],
): Map<RegionId, GraphNode[]> {
  const groups = new Map<RegionId, GraphNode[]>();
  for (const regionId of Object.keys(REGIONS) as RegionId[]) {
    groups.set(regionId, []);
  }
  for (const node of nodes) {
    const region = classifyNodeToRegion(node);
    groups.get(region)!.push(node);
  }
  return groups;
}

// ─── Cross-Region Connections ────────────────────────────────────

export interface CrossRegionConnection {
  sourceNodeId: string;
  targetNodeId: string;
  targetRegion: RegionId;
}

/**
 * Find all connections from a given node to nodes in OTHER regions.
 * Includes both prerequisite relationships and reverse dependencies.
 */
export function getCrossRegionConnections(
  node: GraphNode,
  allNodes: GraphNode[],
): CrossRegionConnection[] {
  const sourceRegion = classifyNodeToRegion(node);
  const nodeIdSet = new Set(allNodes.map((n) => n.id));
  const results: CrossRegionConnection[] = [];
  const seen = new Set<string>();

  // 1. Direct prerequisites
  for (const prereqId of node.prerequisites || []) {
    if (!nodeIdSet.has(prereqId) || seen.has(prereqId)) continue;
    const targetNode = allNodes.find((n) => n.id === prereqId);
    if (!targetNode) continue;
    const targetRegion = classifyNodeToRegion(targetNode);
    if (targetRegion !== sourceRegion) {
      results.push({ sourceNodeId: node.id, targetNodeId: prereqId, targetRegion });
      seen.add(prereqId);
    }
  }

  // 2. Reverse: nodes that have THIS node as prerequisite
  for (const other of allNodes) {
    if (other.id === node.id) continue;
    if ((other.prerequisites || []).includes(node.id)) {
      if (seen.has(other.id)) continue;
      const targetRegion = classifyNodeToRegion(other);
      if (targetRegion !== sourceRegion) {
        results.push({ sourceNodeId: node.id, targetNodeId: other.id, targetRegion });
        seen.add(other.id);
      }
    }
  }

  return results.slice(0, 8); // max 8 connections
}

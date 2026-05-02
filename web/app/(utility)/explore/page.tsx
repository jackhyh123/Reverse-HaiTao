"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import FloatingAITutor from "@/components/learn/FloatingAITutor";
import {
  DEFAULT_EXPLORE_GRAPH,
  type ExploreNode as ExploreNodeType,
} from "@/lib/explore-graph";

type LocaleKey = "zh" | "en";

// ═══════════════════════════════════════════════════════════════
// Data: Journey Stages & Roles
// ═══════════════════════════════════════════════════════════════

const JOURNEY_STAGES = [
  { id: "discovery", label: { zh: "发现", en: "Discovery" }, desc: { zh: "用户在哪看到产品", en: "Where buyers discover" }, color: "#f59e0b" },
  { id: "verification", label: { zh: "验证", en: "Verification" }, desc: { zh: "判断靠不靠谱", en: "Verify trust" }, color: "#f97316" },
  { id: "decision", label: { zh: "决策", en: "Decision" }, desc: { zh: "下决心购买", en: "Make decision" }, color: "#ef4444" },
  { id: "purchase", label: { zh: "购买", en: "Purchase" }, desc: { zh: "下单付款", en: "Place order" }, color: "#3b82f6" },
  { id: "delivery", label: { zh: "收货", en: "Delivery" }, desc: { zh: "商品到手", en: "Receive goods" }, color: "#10b981" },
  { id: "sharing", label: { zh: "分享", en: "Sharing" }, desc: { zh: "晒单口碑回流", en: "Share & review" }, color: "#8b5cf6" },
];

interface RoleDef {
  id: string;
  label: { zh: string; en: string };
  color: string;
  subtypes: string;
  /** Which journey stages this role participates in (in order) */
  activeStages: string[];
}

const ROLES: RoleDef[] = [
  { id: "buyer", label: { zh: "用户/买家", en: "Buyer" }, color: "#10b981", subtypes: "搜索型 · 冲动型 · 社区型 · 批发型", activeStages: ["discovery", "verification", "decision", "purchase", "delivery", "sharing"] },
  { id: "kol", label: { zh: "KOL/社区版主", en: "KOL/Moderator" }, color: "#ec4899", subtypes: "大KOL · 小KOL · Reddit版主 · Discord主", activeStages: ["discovery", "verification", "decision", "sharing"] },
  { id: "platform", label: { zh: "反淘平台", en: "Platform" }, color: "#3b82f6", subtypes: "代理型 · 工具型 · 自营/半自营", activeStages: ["discovery", "purchase", "delivery"] },
  { id: "seller", label: { zh: "卖家", en: "Seller" }, color: "#f59e0b", subtypes: "签约卖家 · 独立卖家 · 纯国内卖家", activeStages: ["purchase", "delivery"] },
];

// Node → stages & roles mapping
const NODE_PLACEMENT: Record<string, { stages: string[]; roles: string[] }> = {
  kol_general:            { stages: ["discovery", "decision", "sharing"],  roles: ["kol"] },
  private_community:       { stages: ["verification", "decision"],          roles: ["kol"] },
  reddit_community:        { stages: ["verification", "sharing"],           roles: ["kol"] },
  platform_traffic:        { stages: ["discovery"],                         roles: ["platform"] },
  ecom_platform:           { stages: ["purchase"],                          roles: ["platform", "seller"] },
  agent_platform:          { stages: ["purchase", "delivery"],              roles: ["platform"] },
  standalone_site:         { stages: ["purchase"],                          roles: ["platform"] },
  social_commerce:         { stages: ["discovery", "decision", "purchase"], roles: ["kol", "platform"] },
  seller_distributor:      { stages: ["purchase", "delivery"],              roles: ["seller"] },
  warehouse_logistics:     { stages: ["delivery"],                          roles: ["seller", "platform"] },
  qc_inspection:           { stages: ["verification", "delivery"],          roles: ["seller", "platform"] },
  payment_api:             { stages: ["purchase"],                          roles: ["platform"] },
  domestic_api:            { stages: ["purchase"],                          roles: ["platform"] },
  supply_chain_upstream:   { stages: ["purchase"],                          roles: ["seller"] },
  currency_tax:            { stages: ["purchase", "delivery"],              roles: ["platform"] },
};

// ═══════════════════════════════════════════════════════════════
// Subway map layout constants
// ═══════════════════════════════════════════════════════════════

const SVG_W = 1100;
const SVG_H = 600;

// Station X positions (centers of station circles)
const STATION_X: Record<string, number> = {
  discovery:    120,
  verification: 290,
  decision:     460,
  purchase:     630,
  delivery:     800,
  sharing:      970,
};

// Role track Y positions (line centers)
const TRACK_Y: Record<string, number> = {
  buyer:    140,
  kol:      290,
  platform: 430,
  seller:   530,
};

const STATION_R = 14;  // big station circle radius
const LINE_W = 5;      // line stroke width
const BUYER_LINE_W = 7;

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// Quick questions
// ═══════════════════════════════════════════════════════════════

const EXPLORE_QUICK_QUESTIONS = [
  "我想做 TikTok 带货，怎么入手？",
  "怎么找到靠谱的国内货源？",
  "独立站和代理平台哪个更适合新手？",
  "跨境物流都有哪些方式？",
];

// ═══════════════════════════════════════════════════════════════
// Helper: get nodes for a stage+role cell
// ═══════════════════════════════════════════════════════════════

function getNodesForStation(
  nodes: ExploreNodeType[],
  stageId: string,
  roleId: string,
): ExploreNodeType[] {
  return nodes.filter((n) => {
    const p = NODE_PLACEMENT[n.id];
    if (!p) return false;
    return p.stages.includes(stageId) && p.roles.includes(roleId);
  });
}

// ═══════════════════════════════════════════════════════════════
// Subway line path generator
// ═══════════════════════════════════════════════════════════════

function buildLinePath(role: RoleDef): string {
  const { activeStages } = role;
  if (activeStages.length === 0) return "";
  if (activeStages.length === 1) {
    const x = STATION_X[activeStages[0]];
    const y = TRACK_Y[role.id];
    return `M ${x - 20} ${y} L ${x + 20} ${y}`;
  }

  const y = TRACK_Y[role.id];
  const points = activeStages.map((sid) => ({ x: STATION_X[sid], y }));

  // Smooth path through all active stations using cubic beziers
  let d = `M ${points[0].x} ${y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${y}, ${cpx} ${y}, ${curr.x} ${y}`;
  }
  return d;
}

// ═══════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════

export default function ExplorePage() {
  const locale: LocaleKey = "zh";
  const { domains, nodes: graphNodes } = DEFAULT_EXPLORE_GRAPH;

  const [hoveredRole, setHoveredRole] = useState<string | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [selectedRoleStage, setSelectedRoleStage] = useState<{ role: string; stage: string } | null>(null);
  const [aiFocusState, setAiFocusState] = useState<AiFocusState | null>(null);

  const inAiFocus = aiFocusState !== null;

  const aiHighlightedSet = useMemo(
    () => new Set(aiFocusState?.highlightedNodes || []),
    [aiFocusState],
  );

  // Graph context for API
  const graphContext = useMemo(
    () => ({
      domains: domains.map((d) => ({ id: d.id, label: d.label, summary: d.summary, color: d.color })),
      nodes: graphNodes.map((n) => ({
        id: n.id, domain: n.domain, title: n.title, summary: n.summary,
        tags: n.tags, connections: n.connections,
      })),
    }),
    [domains, graphNodes],
  );

  // Which nodes are dimmed in AI focus
  const isDimmed = useCallback(
    (nodeId: string) => inAiFocus && !aiHighlightedSet.has(nodeId),
    [inAiFocus, aiHighlightedSet],
  );

  // AI response
  const handleAIResponse = useCallback((data: Record<string, unknown>) => {
    const highlightedNodes = data.highlighted_nodes as string[] | undefined;
    const actionSteps = data.action_steps as ActionStep[] | undefined;
    if (highlightedNodes && highlightedNodes.length > 0) {
      setSelectedRoleStage(null);
      setAiFocusState({
        highlightedNodes,
        actionSteps: actionSteps || [],
        completedSteps: new Set(),
      });
    }
  }, []);

  const exitAiFocus = useCallback(() => setAiFocusState(null), []);
  const clearAll = useCallback(() => { setSelectedRoleStage(null); exitAiFocus(); }, [exitAiFocus]);

  const toggleStepComplete = useCallback((index: number) => {
    setAiFocusState((prev) => {
      if (!prev) return null;
      const next = new Set(prev.completedSteps);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...prev, completedSteps: next };
    });
  }, []);

  const focusBannerText = useMemo(() => {
    if (!aiFocusState) return "";
    const names = aiFocusState.highlightedNodes
      .slice(0, 3)
      .map((id) => graphNodes.find((n) => n.id === id)?.title[locale] || id)
      .join(" · ");
    return `已为你聚焦"${names}"相关路径`;
  }, [aiFocusState, graphNodes, locale]);

  // Determine if a role line should be dimmed
  const isRoleDimmed = useCallback(
    (roleId: string) => {
      if (!inAiFocus) return false;
      // A role is dimmed if NONE of its nodes are highlighted AND the role is not the buyer
      const hasHighlight = graphNodes.some(
        (n) => NODE_PLACEMENT[n.id]?.roles.includes(roleId) && aiHighlightedSet.has(n.id),
      );
      return !hasHighlight;
    },
    [inAiFocus, aiHighlightedSet, graphNodes],
  );

  // ═════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <div className="shrink-0 border-b border-slate-200/60 bg-white/80 px-4 py-2.5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              反淘生态探索
            </h1>
            <span className="hidden text-[11px] text-slate-500 md:inline dark:text-slate-400">
              角色地铁图 · 每条线 = 一个角色 · 大站 = 协作交汇点
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(selectedRoleStage || inAiFocus) && (
              <button
                onClick={clearAll}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                查看全景
              </button>
            )}
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800">
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
            <button onClick={exitAiFocus} className="rounded-lg p-1 text-amber-500 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main: SVG subway map + action panel */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="h-full overflow-auto"
          style={inAiFocus ? { marginRight: 340 } : undefined}
        >
          {/* ── Legend ── */}
          <div className="flex items-center justify-center gap-6 px-4 py-3">
            {ROLES.map((role) => {
              const dimmed = isRoleDimmed(role.id);
              return (
                <button
                  key={role.id}
                  onClick={() => {
                    if (selectedRoleStage?.role === role.id && !selectedRoleStage?.stage) {
                      setSelectedRoleStage(null);
                    } else {
                      setSelectedRoleStage({ role: role.id, stage: "" });
                      exitAiFocus();
                    }
                  }}
                  onMouseEnter={() => setHoveredRole(role.id)}
                  onMouseLeave={() => setHoveredRole(null)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    dimmed ? "opacity-20" : "opacity-100"
                  } ${
                    selectedRoleStage?.role === role.id
                      ? "bg-slate-200 dark:bg-slate-700"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  style={{
                    color: dimmed ? "#94a3b8" : role.color,
                  }}
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: dimmed ? "#94a3b8" : role.color }}
                  />
                  {role.label[locale]}
                </button>
              );
            })}
          </div>

          {/* ── SVG Subway Map ── */}
          <div className="relative mx-auto" style={{ maxWidth: SVG_W + 80 }}>
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="h-auto w-full"
              style={{ minWidth: 800 }}
            >
              {/* Background grid lines (stage verticals) */}
              {JOURNEY_STAGES.map((stage) => {
                const x = STATION_X[stage.id];
                const isActive = hoveredStage === stage.id || selectedRoleStage?.stage === stage.id;
                return (
                  <g key={`vgrid-${stage.id}`}>
                    <line
                      x1={x} y1={30} x2={x} y2={SVG_H - 10}
                      stroke={isActive ? "#cbd5e1" : "#e2e8f0"}
                      strokeWidth={isActive ? 1.5 : 0.5}
                      strokeDasharray="5 5"
                      className="dark:stroke-slate-700"
                    />
                  </g>
                );
              })}

              {/* Role subway lines */}
              {ROLES.map((role) => {
                const dimmed = isRoleDimmed(role.id);
                const isHovered = hoveredRole === role.id;
                const isSelected = selectedRoleStage?.role === role.id;
                const isBuyer = role.id === "buyer";
                const strokeW = isBuyer ? BUYER_LINE_W : LINE_W;

                return (
                  <g key={`line-${role.id}`}>
                    {/* The line path */}
                    <path
                      d={buildLinePath(role)}
                      fill="none"
                      stroke={dimmed ? "#cbd5e1" : role.color}
                      strokeWidth={strokeW + (isHovered || isSelected ? 2 : 0)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={
                        dimmed
                          ? 0.12
                          : hoveredRole && hoveredRole !== role.id
                            ? 0.25
                            : isSelected
                              ? 1
                              : 0.75
                      }
                      className="transition-all duration-300"
                    />

                    {/* Station circles */}
                    {role.activeStages.map((stageId) => {
                      const x = STATION_X[stageId];
                      const y = TRACK_Y[role.id];
                      const stageHovered = hoveredStage === stageId;
                      const stageSelected = selectedRoleStage?.stage === stageId;
                      const isActiveStation = stageHovered || stageSelected;
                      const r = isActiveStation ? STATION_R + 3 : STATION_R;

                      return (
                        <g
                          key={`station-${role.id}-${stageId}`}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredStage(stageId)}
                          onMouseLeave={() => setHoveredStage(null)}
                          onClick={() => {
                            exitAiFocus();
                            if (selectedRoleStage?.role === role.id && selectedRoleStage?.stage === stageId) {
                              setSelectedRoleStage(null);
                            } else {
                              setSelectedRoleStage({ role: role.id, stage: stageId });
                            }
                          }}
                        >
                          {/* Outer ring */}
                          <circle
                            cx={x} cy={y} r={r}
                            fill="white"
                            stroke={dimmed ? "#cbd5e1" : role.color}
                            strokeWidth={isBuyer ? 3 : 2.5}
                            className="transition-all duration-200 dark:fill-slate-900"
                          />
                          {/* Inner dot for buyer line */}
                          {isBuyer && (
                            <circle
                              cx={x} cy={y} r={4}
                              fill={dimmed ? "#cbd5e1" : role.color}
                              className="transition-all duration-200"
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Interchange connectors: vertical lines linking stations at the same stage */}
              {JOURNEY_STAGES.map((stage) => {
                const x = STATION_X[stage.id];
                // Get roles active at this stage
                const activeRoles = ROLES.filter((r) => r.activeStages.includes(stage.id));
                if (activeRoles.length < 2) return null;

                const minY = Math.min(...activeRoles.map((r) => TRACK_Y[r.id]));
                const maxY = Math.max(...activeRoles.map((r) => TRACK_Y[r.id]));
                const isHovered = hoveredStage === stage.id;

                return (
                  <line
                    key={`interchange-${stage.id}`}
                    x1={x} y1={minY + STATION_R}
                    x2={x} y2={maxY - STATION_R}
                    stroke={isHovered ? "#94a3b8" : "#cbd5e1"}
                    strokeWidth={isHovered ? 2 : 1}
                    className="transition-all duration-200 dark:stroke-slate-600"
                  />
                );
              })}

              {/* Stage labels at top */}
              {JOURNEY_STAGES.map((stage) => {
                const x = STATION_X[stage.id];
                return (
                  <g key={`label-${stage.id}`}>
                    <text
                      x={x}
                      y={48}
                      textAnchor="middle"
                      className="fill-slate-500 dark:fill-slate-400"
                      style={{ fontSize: 11, fontWeight: 700 }}
                    >
                      {stage.label[locale]}
                    </text>
                    <text
                      x={x}
                      y={64}
                      textAnchor="middle"
                      className="fill-slate-400 dark:fill-slate-500"
                      style={{ fontSize: 9 }}
                    >
                      {stage.desc[locale]}
                    </text>
                  </g>
                );
              })}

              {/* Station labels: role names next to stations */}
              {ROLES.map((role) => {
                const dimmed = isRoleDimmed(role.id);
                return role.activeStages.map((stageId) => {
                  const x = STATION_X[stageId];
                  const y = TRACK_Y[role.id];
                  const stageHovered = hoveredStage === stageId;
                  const isSelected = selectedRoleStage?.role === role.id && selectedRoleStage?.stage === stageId;
                  if (!stageHovered && !isSelected && !(selectedRoleStage?.role === role.id && !selectedRoleStage.stage)) return null;
                  return (
                    <text
                      key={`sname-${role.id}-${stageId}`}
                      x={x + STATION_R + 8}
                      y={y + 4}
                      className="fill-slate-700 dark:fill-slate-300"
                      style={{ fontSize: 9, fontWeight: 600 }}
                      opacity={dimmed ? 0.3 : 1}
                    >
                      {role.label[locale]}
                    </text>
                  );
                });
              })}
            </svg>

            {/* ── Overlay: node cards near stations ── */}
            <div className="relative pb-10" style={{ marginTop: -10 }}>
              {ROLES.map((role) =>
                role.activeStages.map((stageId) => {
                  const cellNodes = getNodesForStation(graphNodes, stageId, role.id);
                  if (cellNodes.length === 0) return null;

                  const stageIdx = JOURNEY_STAGES.findIndex((s) => s.id === stageId);
                  const xPct = ((STATION_X[stageId] - 40) / SVG_W) * 100;
                  const roleIdx = ROLES.findIndex((r) => r.id === role.id);
                  const isSelected = selectedRoleStage?.role === role.id && selectedRoleStage?.stage === stageId;
                  const isOtherSelected = selectedRoleStage && (selectedRoleStage.role !== role.id || selectedRoleStage.stage !== stageId);

                  return (
                    <div
                      key={`cards-${role.id}-${stageId}`}
                      className="absolute transition-all duration-300"
                      style={{
                        left: `${xPct}%`,
                        top: `${roleIdx * 32}px`,
                        width: 170,
                        opacity: isOtherSelected ? 0.15 : 1,
                        transform: isSelected ? "scale(1.05)" : "scale(1)",
                        zIndex: isSelected ? 10 : 1,
                      }}
                    >
                      <div className="flex flex-wrap gap-1">
                        {cellNodes.map((node) => {
                          const dimmed = isDimmed(node.id);
                          const highlighted = aiHighlightedSet.has(node.id);
                          return (
                            <button
                              key={node.id}
                              onClick={() => {
                                exitAiFocus();
                                setSelectedRoleStage({ role: role.id, stage: stageId });
                              }}
                              className={`rounded-lg border px-2 py-1 text-left transition-all hover:shadow-sm ${
                                dimmed
                                  ? "border-slate-100 bg-white/30 opacity-25 dark:border-slate-800 dark:bg-slate-900/20"
                                  : highlighted
                                    ? "border-amber-400 bg-amber-50 shadow-sm dark:border-amber-500 dark:bg-amber-950/50"
                                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                              }`}
                              style={{
                                ...(highlighted && !dimmed ? { borderColor: role.color } : {}),
                              }}
                            >
                              <div
                                className="text-[10px] font-semibold leading-tight"
                                style={{ color: dimmed ? "#94a3b8" : role.color }}
                              >
                                {node.title[locale]}
                              </div>
                              {node.tags.length > 0 && (
                                <div className="mt-0.5 flex gap-0.5">
                                  {node.tags.slice(0, 2).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded px-1 py-0 text-[7px] font-medium text-slate-400 dark:text-slate-500"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }),
              )}
              {/* Spacer for card area */}
              <div style={{ height: ROLES.length * 32 + 40 }} />
            </div>
          </div>
        </div>

        {/* ── Action steps panel ── */}
        {inAiFocus && aiFocusState.actionSteps.length > 0 && (
          <div className="absolute right-0 top-0 z-20 flex h-full w-[340px] flex-col border-l border-slate-200/60 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/95">
            <div className="shrink-0 border-b border-slate-200/40 px-4 py-3 dark:border-slate-800/40">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                你的行动路径
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {aiFocusState.completedSteps.size} / {aiFocusState.actionSteps.length} 步已完成
              </div>
            </div>
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
                          <div className={`text-[13px] font-semibold leading-tight ${
                            done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                          }`}>
                            {i + 1}. {step.title}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                            {step.description}
                          </div>
                          {step.resource_url && (
                            <a href={step.resource_url} target="_blank" rel="noopener noreferrer"
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
            <div className="shrink-0 border-t border-slate-200/40 px-4 py-2.5 dark:border-slate-800/40">
              <div className="flex items-center gap-2">
                <button onClick={exitAiFocus}
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  返回全景
                </button>
                <button className="flex-1 rounded-lg bg-slate-900 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                  保存路径
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Tutor */}
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

"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import FloatingAITutor from "@/components/learn/FloatingAITutor";
import {
  DEFAULT_EXPLORE_GRAPH,
  type ExploreNode as ExploreNodeType,
} from "@/lib/explore-graph";

type LocaleKey = "zh" | "en";

// ═══════════════════════════════════════════════════════════════
// Data: Journey Stages
// ═══════════════════════════════════════════════════════════════

interface StageDef {
  id: string;
  label: { zh: string; en: string };
  number: number;
  buyerAction: { zh: string; en: string };
  desc: { zh: string; en: string };
  color: string;
  /** Which roles participate at this stage */
  activeRoles: string[];
}

const JOURNEY_STAGES: StageDef[] = [
  {
    id: "discovery", number: 1,
    label: { zh: "发现", en: "Discovery" },
    buyerAction: { zh: "刷到种草内容，被勾起兴趣", en: "Stumbles upon engaging content" },
    desc: { zh: "买家在TikTok/YouTube/小红书刷到达人或平台推送的内容，第一次接触到产品", en: "Buyer first discovers the product via KOL content or platform algorithm" },
    color: "#f59e0b",
    activeRoles: ["kol", "platform"],
  },
  {
    id: "verification", number: 2,
    label: { zh: "验证", en: "Verification" },
    buyerAction: { zh: "上Reddit搜索评价，看QC实拍图", en: "Searches Reddit for reviews and QC photos" },
    desc: { zh: "买家不信任广告，转向Reddit社区和Yupoo相册验证产品质量和卖家信誉", en: "Buyer distrusts ads and turns to Reddit communities and Yupoo galleries" },
    color: "#f97316",
    activeRoles: ["kol", "seller", "platform"],
  },
  {
    id: "decision", number: 3,
    label: { zh: "决策", en: "Decision" },
    buyerAction: { zh: "进Discord群讨论，问尺码和细节", en: "Joins Discord to ask about sizing and details" },
    desc: { zh: "买家进入私域社区深度交流，KOL和资深买家给出建议，最终下定决心", en: "Buyer enters private communities for deep discussion before committing" },
    color: "#ef4444",
    activeRoles: ["kol"],
  },
  {
    id: "purchase", number: 4,
    label: { zh: "购买", en: "Purchase" },
    buyerAction: { zh: "在代理平台下单付款", en: "Places order on agent platform" },
    desc: { zh: "买家通过Pandabuy/Superbuy等代理平台下单，平台接入国内电商API完成采购", en: "Buyer orders through agent platforms connected to domestic e-commerce APIs" },
    color: "#3b82f6",
    activeRoles: ["platform", "seller", "kol"],
  },
  {
    id: "delivery", number: 5,
    label: { zh: "收货", en: "Delivery" },
    buyerAction: { zh: "等待仓库质检→集运→国际快递→到手", en: "Awaits QC → consolidation → international shipping" },
    desc: { zh: "仓库收货验货后合包集运发往海外，清关后派送到买家手中", en: "Warehouse QC, consolidation, international shipping, customs clearance, final delivery" },
    color: "#10b981",
    activeRoles: ["platform", "seller"],
  },
  {
    id: "sharing", number: 6,
    label: { zh: "分享", en: "Sharing" },
    buyerAction: { zh: "在Reddit发帖晒单，形成口碑回流", en: "Posts review on Reddit, creating word-of-mouth" },
    desc: { zh: "买家晒出开箱照和评价，回流到发现阶段的Reddit社区，完成流量闭环", en: "Buyer shares unboxing and review, feeding back into Reddit discovery — closing the traffic loop" },
    color: "#8b5cf6",
    activeRoles: ["kol"],
  },
];

// ═══════════════════════════════════════════════════════════════
// Role definitions
// ═══════════════════════════════════════════════════════════════

const ROLE_META: Record<string, { label: { zh: string; en: string }; color: string; icon: string }> = {
  buyer:  { label: { zh: "买家", en: "Buyer" }, color: "#10b981", icon: "🧑‍💻" },
  kol:    { label: { zh: "KOL/社区", en: "KOL/Community" }, color: "#ec4899", icon: "📢" },
  platform: { label: { zh: "平台", en: "Platform" }, color: "#3b82f6", icon: "🏪" },
  seller: { label: { zh: "卖家", en: "Seller" }, color: "#f59e0b", icon: "📦" },
};

// Node → stages & roles
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
// Helper: get nodes for a stage+role
// ═══════════════════════════════════════════════════════════════

function getNodesForStageRole(
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

function getNodesForStage(
  nodes: ExploreNodeType[],
  stageId: string,
): ExploreNodeType[] {
  return nodes.filter((n) => {
    const p = NODE_PLACEMENT[n.id];
    if (!p) return false;
    return p.stages.includes(stageId);
  });
}

// ═══════════════════════════════════════════════════════════════
// Minimap component (small version of the full matrix)
// ═══════════════════════════════════════════════════════════════

function Minimap({ currentStage, onNavigate, nodes: graphNodes }: {
  currentStage: string;
  onNavigate: (stageId: string) => void;
  nodes: ExploreNodeType[];
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/90">
      <div className="mb-2 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
        全景导航
      </div>
      <div className="grid grid-cols-[auto_repeat(6,1fr)] gap-0.5">
        {/* Role row headers + cells (compact) */}
        {Object.entries(ROLE_META)
          .filter(([id]) => id !== "buyer")
          .map(([roleId, meta]) => (
            <div key={roleId} className="contents">
              <div
                className="flex items-center px-1 py-0.5 text-[9px] font-semibold"
                style={{ color: meta.color }}
              >
                {meta.label.zh}
              </div>
              {JOURNEY_STAGES.map((stage) => {
                const hasNodes = getNodesForStageRole(graphNodes, stage.id, roleId).length > 0;
                const isCurrent = stage.id === currentStage;
                return (
                  <button
                    key={`${roleId}-${stage.id}`}
                    onClick={() => onNavigate(stage.id)}
                    className={`rounded-sm transition-all ${
                      hasNodes
                        ? isCurrent
                          ? "ring-2 ring-offset-1"
                          : "hover:opacity-80"
                        : ""
                    }`}
                    style={{
                      backgroundColor: hasNodes
                        ? isCurrent
                          ? meta.color
                          : `${meta.color}40`
                        : "transparent",
                      ...(isCurrent ? { ringColor: meta.color } : {}),
                      minHeight: 14,
                    }}
                    title={hasNodes ? `${meta.label.zh} · ${stage.label.zh}` : undefined}
                  />
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════

export default function ExplorePage() {
  const locale: LocaleKey = "zh";
  const { domains, nodes: graphNodes } = DEFAULT_EXPLORE_GRAPH;

  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [aiFocusState, setAiFocusState] = useState<AiFocusState | null>(null);

  const currentStage = JOURNEY_STAGES[currentStageIdx];
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

  // Current stage nodes grouped by role
  const currentStageNodes = useMemo(
    () => getNodesForStage(graphNodes, currentStage.id),
    [graphNodes, currentStage],
  );

  const nodesByRole = useMemo(() => {
    const grouped: Record<string, ExploreNodeType[]> = {};
    for (const roleId of [...currentStage.activeRoles, "buyer"]) {
      grouped[roleId] = getNodesForStageRole(graphNodes, currentStage.id, roleId);
    }
    return grouped;
  }, [graphNodes, currentStage, currentStage.activeRoles]);

  // Navigation
  const goToStage = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(JOURNEY_STAGES.length - 1, idx));
      setCurrentStageIdx(clamped);
    },
    [],
  );

  const goNext = useCallback(() => goToStage(currentStageIdx + 1), [currentStageIdx, goToStage]);
  const goPrev = useCallback(() => goToStage(currentStageIdx - 1), [currentStageIdx, goToStage]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // AI response
  const handleAIResponse = useCallback((data: Record<string, unknown>) => {
    const highlightedNodes = data.highlighted_nodes as string[] | undefined;
    const actionSteps = data.action_steps as ActionStep[] | undefined;
    if (highlightedNodes && highlightedNodes.length > 0) {
      setAiFocusState({
        highlightedNodes,
        actionSteps: actionSteps || [],
        completedSteps: new Set(),
      });
    }
  }, []);

  const exitAiFocus = useCallback(() => setAiFocusState(null), []);

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

  // Determine if a node is AI-highlighted
  const isAiHighlighted = useCallback(
    (nodeId: string) => aiHighlightedSet.has(nodeId),
    [aiHighlightedSet],
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
              场景演替 · 逐阶段深入买家旅程
            </span>
          </div>
          <div className="flex items-center gap-2">
            {inAiFocus && (
              <button
                onClick={exitAiFocus}
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
            <button
              onClick={exitAiFocus}
              className="rounded-lg p-1 text-amber-500 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main: stage scene + action panel */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full flex-col overflow-auto"
          style={inAiFocus ? { marginRight: 340 } : undefined}
        >
          {/* ── Stage title bar ── */}
          <div className="shrink-0 border-b border-slate-200/60 bg-white/60 px-4 py-4 text-center backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/60">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={goPrev}
                disabled={currentStageIdx === 0}
                className="rounded-full border border-slate-200 p-2 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600 disabled:opacity-20 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:text-slate-300"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: currentStage.color }}
                  >
                    {currentStage.number}/6
                  </span>
                  <h2
                    className="text-xl font-black tracking-tight"
                    style={{ color: currentStage.color }}
                  >
                    {currentStage.label[locale]}
                  </h2>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {currentStage.desc[locale]}
                </div>
              </div>

              <button
                onClick={goNext}
                disabled={currentStageIdx === JOURNEY_STAGES.length - 1}
                className="rounded-full border border-slate-200 p-2 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600 disabled:opacity-20 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:text-slate-300"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Scene: role cards around buyer ── */}
          <div className="min-h-0 flex-1 overflow-auto p-6">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
              {/* Buyer card (center, always present) */}
              <div className="w-full max-w-sm">
                <div
                  className="relative rounded-2xl border-2 bg-white p-5 shadow-lg dark:bg-slate-900"
                  style={{ borderColor: "#10b981" }}
                >
                  <div className="absolute -top-3 left-4 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-bold text-white">
                    {ROLE_META.buyer.icon} 买家此刻
                  </div>
                  <div className="mt-1 text-[15px] font-bold text-slate-900 dark:text-slate-100">
                    {currentStage.buyerAction[locale]}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {currentStage.activeRoles.map((roleId) => {
                      const meta = ROLE_META[roleId];
                      return (
                        <span
                          key={roleId}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${meta.color}18`,
                            color: meta.color,
                          }}
                        >
                          {meta.icon} 与{meta.label[locale]}互动
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Other role cards */}
              <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                {currentStage.activeRoles.map((roleId) => {
                  const meta = ROLE_META[roleId];
                  const roleNodes = nodesByRole[roleId] || [];
                  return (
                    <div
                      key={roleId}
                      className="rounded-2xl border-2 bg-white p-4 shadow-md transition-all dark:bg-slate-900"
                      style={{ borderColor: `${meta.color}60` }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-sm"
                          style={{
                            backgroundColor: `${meta.color}18`,
                            color: meta.color,
                          }}
                        >
                          {meta.icon}
                        </div>
                        <div>
                          <div
                            className="text-[13px] font-bold"
                            style={{ color: meta.color }}
                          >
                            {meta.label[locale]}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {roleNodes.length} 个节点参与
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {roleNodes.map((node) => {
                          const highlighted = isAiHighlighted(node.id);
                          return (
                            <span
                              key={node.id}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all ${
                                highlighted
                                  ? "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/50"
                                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                              }`}
                              style={{
                                color: highlighted ? undefined : meta.color,
                              }}
                            >
                              {node.title[locale]}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empty state when only buyer has action */}
              {currentStage.activeRoles.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  此阶段买家独立行动，无需与其他角色互动
                </div>
              )}

              {/* ── Minimap ── */}
              <div className="w-full max-w-2xl">
                <Minimap
                  currentStage={currentStage.id}
                  onNavigate={(stageId) => {
                    const idx = JOURNEY_STAGES.findIndex((s) => s.id === stageId);
                    if (idx >= 0) goToStage(idx);
                  }}
                  nodes={graphNodes}
                />
              </div>
            </div>
          </div>

          {/* ── Stage navigation timeline ── */}
          <div className="shrink-0 border-t border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/80">
            <div className="mx-auto flex max-w-2xl items-center justify-between">
              {JOURNEY_STAGES.map((stage, i) => {
                const isCurrent = i === currentStageIdx;
                const isPast = i < currentStageIdx;
                return (
                  <button
                    key={stage.id}
                    onClick={() => goToStage(i)}
                    className="group flex flex-col items-center gap-1"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        isCurrent
                          ? "scale-110 text-white shadow-lg"
                          : isPast
                            ? "text-white opacity-60"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                      }`}
                      style={{
                        backgroundColor: isCurrent || isPast ? stage.color : undefined,
                      }}
                      title={`${stage.label[locale]}: ${stage.buyerAction[locale]}`}
                    >
                      {isPast ? <Check className="h-4 w-4" /> : stage.number}
                    </div>
                    <span
                      className={`text-[10px] font-medium transition-colors ${
                        isCurrent
                          ? "text-slate-800 dark:text-slate-200"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {stage.label[locale]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mx-auto mt-2 max-w-2xl">
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${((currentStageIdx + 1) / JOURNEY_STAGES.length) * 100}%`,
                    backgroundColor: currentStage.color,
                  }}
                />
              </div>
            </div>

            <div className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
              ← → 方向键切换阶段 · 点击时间轴跳转 · 底部 AI 导师按需规划路径
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

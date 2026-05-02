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
// Data: Journey Stages & Roles (buyer-journey × role matrix)
// ═══════════════════════════════════════════════════════════════

const JOURNEY_STAGES = [
  { id: "discovery", label: { zh: "① 发现", en: "① Discovery" }, desc: { zh: "用户在哪看到产品", en: "Where buyers discover" }, color: "#f59e0b" },
  { id: "verification", label: { zh: "② 验证", en: "② Verification" }, desc: { zh: "判断靠不靠谱", en: "Verify trust" }, color: "#f97316" },
  { id: "decision", label: { zh: "③ 决策", en: "③ Decision" }, desc: { zh: "下决心购买", en: "Make decision" }, color: "#ef4444" },
  { id: "purchase", label: { zh: "④ 购买", en: "④ Purchase" }, desc: { zh: "下单付款", en: "Place order" }, color: "#3b82f6" },
  { id: "delivery", label: { zh: "⑤ 收货", en: "⑤ Delivery" }, desc: { zh: "商品到手", en: "Receive goods" }, color: "#10b981" },
  { id: "sharing", label: { zh: "⑥ 分享", en: "⑥ Sharing" }, desc: { zh: "晒单口碑回流", en: "Share & review" }, color: "#8b5cf6" },
];

const ROLES = [
  { id: "buyer", label: { zh: "用户/买家", en: "Buyer" }, color: "#10b981", subtypes: "搜索型 · 冲动型 · 社区型 · 批发型" },
  { id: "kol", label: { zh: "KOL / 社区版主", en: "KOL / Moderator" }, color: "#ec4899", subtypes: "大KOL · 小KOL · Reddit版主 · Discord主 · 招募者" },
  { id: "platform", label: { zh: "反淘平台", en: "Platform" }, color: "#3b82f6", subtypes: "代理型 · 工具型 · 自营/半自营" },
  { id: "seller", label: { zh: "卖家", en: "Seller" }, color: "#f59e0b", subtypes: "签约卖家 · 独立卖家 · 纯国内卖家" },
];

// Map each graph node to journey stages & roles
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
// Helpers
// ═══════════════════════════════════════════════════════════════

function getNodesForCell(
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
// Main page
// ═══════════════════════════════════════════════════════════════

export default function ExplorePage() {
  const locale: LocaleKey = "zh";
  const { domains, nodes: graphNodes } = DEFAULT_EXPLORE_GRAPH;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [aiFocusState, setAiFocusState] = useState<AiFocusState | null>(null);

  const inAiFocus = aiFocusState !== null;
  const inSelect = selectedNodeId !== null;

  const aiHighlightedSet = useMemo(
    () => new Set(aiFocusState?.highlightedNodes || []),
    [aiFocusState],
  );

  // Build graph context for AI API calls
  const graphContext = useMemo(
    () => ({
      domains: domains.map((d) => ({
        id: d.id,
        label: d.label,
        summary: d.summary,
        color: d.color,
      })),
      nodes: graphNodes.map((n) => ({
        id: n.id,
        domain: n.domain,
        title: n.title,
        summary: n.summary,
        tags: n.tags,
        connections: n.connections,
      })),
    }),
    [domains, graphNodes],
  );

  // Connected nodes for manual selection
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const node = graphNodes.find((n) => n.id === selectedNodeId);
    if (!node) return new Set<string>();
    return new Set((node.connections || []).map((c) => c.target));
  }, [selectedNodeId, graphNodes]);

  // ---------- Node highlight classification ----------

  type Highlight = "selected" | "connected" | "ai-highlight" | "dimmed" | "normal";

  const classifyHighlight = useCallback(
    (nodeId: string): Highlight => {
      if (nodeId === selectedNodeId) return "selected";
      if (inSelect && connectedNodeIds.has(nodeId)) return "connected";
      if (inAiFocus && aiHighlightedSet.has(nodeId)) return "ai-highlight";
      if (inAiFocus || inSelect) return "dimmed";
      return "normal";
    },
    [selectedNodeId, connectedNodeIds, inAiFocus, aiHighlightedSet, inSelect],
  );

  // ---------- AI response handler ----------

  const handleAIResponse = useCallback((data: Record<string, unknown>) => {
    const highlightedNodes = data.highlighted_nodes as string[] | undefined;
    const actionSteps = data.action_steps as ActionStep[] | undefined;
    if (highlightedNodes && highlightedNodes.length > 0) {
      setSelectedNodeId(null);
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

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    exitAiFocus();
  }, [exitAiFocus]);

  // Focus banner text
  const focusBannerText = useMemo(() => {
    if (!aiFocusState) return "";
    const nodeNames = aiFocusState.highlightedNodes
      .slice(0, 3)
      .map((id) => graphNodes.find((n) => n.id === id)?.title[locale] || id)
      .join(" · ");
    return `已为你聚焦"${nodeNames}"相关路径`;
  }, [aiFocusState, graphNodes, locale]);

  // ---------- Render ----------

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-slate-200/60 bg-white/80 px-4 py-2.5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              反淘生态探索
            </h1>
            <span className="hidden text-[11px] text-slate-500 md:inline dark:text-slate-400">
              买家旅程 × 角色矩阵 · 点击卡片查看关联 · 悬停看详情
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(inSelect || inAiFocus) && (
              <button
                onClick={clearSelection}
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

      {/* ── AI Focus banner ── */}
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

      {/* ── Main content: matrix + action panel ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="h-full overflow-auto"
          style={inAiFocus ? { marginRight: 340 } : undefined}
        >
          {/* ── Stage headers ── */}
          <div className="sticky top-0 z-10 grid grid-cols-[150px_repeat(6,1fr)] border-b border-slate-200/60 bg-white/95 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/95">
            <div className="flex items-center justify-center px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              角色 ↓ / 旅程 →
            </div>
            {JOURNEY_STAGES.map((stage) => (
              <div
                key={stage.id}
                className="flex flex-col items-center justify-center border-l border-slate-100 px-2 py-3 dark:border-slate-800"
              >
                <div
                  className="text-[13px] font-bold"
                  style={{ color: stage.color }}
                >
                  {stage.label[locale]}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                  {stage.desc[locale]}
                </div>
              </div>
            ))}
          </div>

          {/* ── Role rows ── */}
          {ROLES.map((role) => {
            const isBuyer = role.id === "buyer";
            return (
              <div
                key={role.id}
                className={`grid grid-cols-[150px_repeat(6,1fr)] border-b border-slate-100 transition-colors dark:border-slate-800 ${
                  isBuyer
                    ? "bg-emerald-50/30 dark:bg-emerald-950/15"
                    : "bg-white/60 hover:bg-white/90 dark:bg-slate-950/40 dark:hover:bg-slate-900/60"
                }`}
              >
                {/* Role label cell */}
                <div className="sticky left-0 z-[5] flex flex-col justify-center border-r border-slate-200/60 bg-inherit px-3 py-3 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <span
                      className="text-[13px] font-bold text-slate-800 dark:text-slate-200"
                      style={{ color: isBuyer ? role.color : undefined }}
                    >
                      {role.label[locale]}
                    </span>
                  </div>
                  <span className="mt-0.5 text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                    {role.subtypes}
                  </span>
                </div>

                {/* Stage cells for this role */}
                {JOURNEY_STAGES.map((stage) => {
                  const cellNodes = getNodesForCell(graphNodes, stage.id, role.id);
                  return (
                    <div
                      key={`${role.id}-${stage.id}`}
                      className={`min-h-[105px] border-l border-slate-100 p-2 dark:border-slate-800 ${
                        isBuyer && cellNodes.length === 0
                          ? "bg-emerald-50/15 dark:bg-emerald-950/5"
                          : ""
                      }`}
                    >
                      {cellNodes.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-[10px] text-slate-200 dark:text-slate-800">
                            —
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {cellNodes.map((node) => {
                            const hl = classifyHighlight(node.id);
                            const isHovered = hoveredNodeId === node.id;
                            return (
                              <button
                                key={node.id}
                                onClick={() => {
                                  if (selectedNodeId === node.id) {
                                    setSelectedNodeId(null);
                                  } else {
                                    setSelectedNodeId(node.id);
                                    exitAiFocus();
                                  }
                                }}
                                onMouseEnter={() => setHoveredNodeId(node.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                className={`group relative rounded-lg border px-2.5 py-1.5 text-left transition-all duration-200 ${
                                  hl === "selected"
                                    ? "z-10 scale-105 border-slate-800 bg-slate-800 text-white shadow-lg dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                                    : hl === "connected"
                                      ? "scale-[1.02] border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800"
                                      : hl === "ai-highlight"
                                        ? "scale-[1.03] border-amber-400 bg-amber-50 shadow-md dark:border-amber-500 dark:bg-amber-950/50"
                                        : hl === "dimmed"
                                          ? "border-slate-100 bg-white/40 opacity-25 dark:border-slate-800 dark:bg-slate-900/20"
                                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                                }`}
                                style={{
                                  ...((hl === "connected" || hl === "ai-highlight")
                                    ? { borderColor: role.color }
                                    : {}),
                                }}
                              >
                                <div className="text-[11px] font-semibold leading-tight">
                                  {node.title[locale]}
                                </div>
                                {node.tags.length > 0 && (
                                  <div className="mt-0.5 flex gap-0.5">
                                    {node.tags.slice(0, 2).map((tag) => (
                                      <span
                                        key={tag}
                                        className={`rounded px-1 py-0 text-[8px] font-medium ${
                                          hl === "selected"
                                            ? "bg-white/20 text-white/80"
                                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                        }`}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Tooltip on hover */}
                                {isHovered && (
                                  <div
                                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                                    style={{ minWidth: 220 }}
                                  >
                                    <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                                      {node.summary[locale]}
                                    </div>
                                    {node.connections && node.connections.length > 0 && (
                                      <div className="mt-1.5 border-t border-slate-100 pt-1.5 dark:border-slate-800">
                                        <div className="mb-0.5 text-[9px] font-bold uppercase text-slate-400">
                                          关联节点
                                        </div>
                                        {node.connections.map((c, i) => (
                                          <div
                                            key={i}
                                            className="text-[10px] text-slate-500 dark:text-slate-400"
                                          >
                                            →{" "}
                                            {graphNodes.find((n) => n.id === c.target)
                                              ?.title[locale] || c.target}{" "}
                                            <span className="text-slate-300 dark:text-slate-600">
                                              ({c.relation})
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── Footer hint ── */}
          <div className="px-4 py-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              💡 点击卡片查看节点关联 · 悬停查看详情 · 底部 AI 导师帮你规划行动路径
            </span>
          </div>
        </div>

        {/* ── Action steps panel (AI focus mode only) ── */}
        {inAiFocus && aiFocusState.actionSteps.length > 0 && (
          <div className="absolute right-0 top-0 z-20 flex h-full w-[340px] flex-col border-l border-slate-200/60 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/95">
            <div className="shrink-0 border-b border-slate-200/40 px-4 py-3 dark:border-slate-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    你的行动路径
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {aiFocusState.completedSteps.size} /{" "}
                    {aiFocusState.actionSteps.length} 步已完成
                  </div>
                </div>
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
                          <div
                            className={`text-[13px] font-semibold leading-tight ${
                              done
                                ? "text-slate-400 line-through dark:text-slate-500"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {i + 1}. {step.title}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                            {step.description}
                          </div>
                          {step.resource_url && (
                            <a
                              href={step.resource_url}
                              target="_blank"
                              rel="noopener noreferrer"
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
                <button
                  onClick={exitAiFocus}
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

      {/* ── AI Tutor bar ── */}
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

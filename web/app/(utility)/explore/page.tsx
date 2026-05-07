"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  type GraphNode,
  type KnowledgeGraph,
  fetchGraph,
  fetchResourceContent,
  type FeishuBlock,
  type FeishuElement,
} from "@/lib/knowledge-graph";
import { classifyNodeToRegion } from "@/lib/ecosystem";
import type { RegionId } from "@/lib/ecosystem";
import {
  type FlowStageId,
  type Perspective,
  type SubModuleDef,
  type FlowStageDef,
  type ClassificationResult,
  FLOW_STAGES,
  findTopicById,
  getFeishuUrl,
} from "@/lib/ecosystem-data";

type ExplorePerspective = Perspective | "industry";

// ─── Icon resolver ──────────────────────────────────────────────────

function stageIcon(name: string, cls?: string) {
  const c = cls ?? "h-5 w-5";
  const map: Record<string, React.ReactNode> = {
    Globe: <Globe className={c} />,
    ShieldCheck: <ShieldCheck className={c} />,
    ShoppingCart: <ShoppingCart className={c} />,
    Truck: <Truck className={c} />,
    MessageCircle: <MessageCircle className={c} />,
    BookOpen: <BookOpen className={c} />,
    Layers: <Layers className={c} />,
  };
  return map[name] ?? <Globe className={c} />;
}

// ─── Node → Stage classification ────────────────────────────────────

function classifyToStage(node: GraphNode): ClassificationResult {
  const searchText = [
    node.title?.zh ?? "",
    node.title?.en ?? "",
    node.summary?.zh ?? "",
    node.summary?.en ?? "",
    ...(node.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const stageKeywords: { stage: FlowStageId; pattern: RegExp; label: string }[] = [
    {
      stage: "traffic_entry",
      label: "traffic keywords",
      pattern:
        /discovery|traffic|kol|tiktok|channels?|promotion|发现|流量|达人|渠道|推广|引流|曝光|获取用户|从哪里|第一次.*看到|怎么.*发现/i,
    },
    {
      stage: "trust_building",
      label: "trust keywords",
      pattern:
        /review|qc|verification|discord|trust|reputation|feedback|信任|验证|质检|评价|口碑|社区反馈|信誉|靠谱|真假/i,
    },
    {
      stage: "order_decision",
      label: "order keywords",
      pattern:
        /conversion|platform|agent|payment|order|pricing|commission|下单|决策|代理|支付|定价|转化|购买|选择|怎么.*买|在哪里.*买/i,
    },
    {
      stage: "fulfillment",
      label: "fulfillment keywords",
      pattern:
        /logistics|shipping|warehouse|customs|delivery|fulfillment|物流|履约|仓储|配送|发货|清关|集运|海关|怎么.*到/i,
    },
    {
      stage: "content_loop",
      label: "content keywords",
      pattern:
        /sharing|unboxing|review|ugc|晒单|回流|分享|开箱|内容.*传播|二次.*传播|反馈.*优化|复购/i,
    },
  ];

  for (const { stage, pattern, label } of stageKeywords) {
    if (pattern.test(searchText)) {
      return { stage, confidence: "high", matchedBy: label };
    }
  }

  // Fallback: use region-based classification
  const region = classifyNodeToRegion(node);
  const regionToStage: Record<RegionId, FlowStageId> = {
    traffic: "traffic_entry",
    transaction: "order_decision",
    fulfillment: "fulfillment",
    infrastructure: "content_loop",
  };
  const stage = regionToStage[region] ?? null;
  return {
    stage,
    confidence: stage ? "fallback" : "low",
    matchedBy: stage ? `region fallback: ${region}` : null,
  };
}

// ─── Page ───────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [perspective, setPerspective] = useState<ExplorePerspective>("buyer");
  const [expandedId, setExpandedId] = useState<FlowStageId | null>(null);
  const [hoveredId, setHoveredId] = useState<FlowStageId | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [modalTopicId, setModalTopicId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setOffline(false);
      try {
        const data = await fetchGraph();
        if (!cancelled) setGraph(data);
      } catch {
        if (!cancelled) setOffline(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const stageMappings = useMemo(() => {
    const map = new Map<FlowStageId, GraphNode[]>();
    for (const s of FLOW_STAGES) map.set(s.id, []);
    if (!graph) return map;
    for (const node of graph.nodes) {
      const result = classifyToStage(node);
      if (result.stage) map.get(result.stage)!.push(node);
    }
    return map;
  }, [graph]);

  const nodeMap = useMemo(() => {
    if (!graph) return new Map<string, GraphNode>();
    return new Map(graph.nodes.map((n) => [n.id, n]));
  }, [graph]);

  const expandRef = useRef<HTMLDivElement>(null);

  const toggleExpand = useCallback(
    (id: FlowStageId) => setExpandedId((p) => (p === id ? null : id)),
    [],
  );

  /** Mobile: toggle + scroll to expand area */
  const mobileToggleExpand = useCallback(
    (id: FlowStageId) => {
      setExpandedId((p) => {
        const next = p === id ? null : id;
        if (next) {
          setTimeout(() => {
            expandRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 120);
        }
        return next;
      });
    },
    [],
  );

  const expandedStage = FLOW_STAGES.find((s) => s.id === expandedId) ?? null;
  const expandedNodes = expandedId ? stageMappings.get(expandedId) ?? [] : [];
  const isIndustryPerspective = perspective === "industry";
  const flowPerspective: Perspective = isIndustryPerspective ? "seller" : perspective;

  const handleRetry = useCallback(() => {
    setLoading(true);
    setOffline(false);
    fetchGraph()
      .then(setGraph)
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ background: "var(--background)" }}
    >
      <div className="mx-auto w-full max-w-[1520px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        {/* ═══════ PAGE HEADER ═══════ */}
        <div className="shrink-0 pb-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <h1
              className="font-sans text-lg font-black tracking-tight md:text-xl"
              style={{ color: "var(--foreground)" }}
            >
              反淘生态图谱
            </h1>
            {offline && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--muted-foreground)",
                  background: "var(--muted)",
                }}
              >
                离线模式
                <button
                  onClick={handleRetry}
                  className="ml-0.5 hover:text-[var(--primary)]"
                  title="重新连接"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
          <p
            className="mx-auto mt-1 max-w-lg text-[12px] leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            看清反淘行业全貌——从流量到回流，理解每个环节的角色、关系和运作逻辑
          </p>

          {/* Perspective Switcher */}
          <div
            className="mt-3 inline-flex items-center gap-1 rounded-full border-2 p-1"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            {([
              { id: "buyer" as Perspective, zh: "买家视角", en: "Buyer" },
              { id: "platform" as Perspective, zh: "平台视角", en: "Platform" },
              { id: "seller" as Perspective, zh: "卖家视角", en: "Seller" },
              { id: "industry" as const, zh: "行业视角", en: "Industry" },
            ]).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPerspective(p.id);
                  setExpandedId(null);
                  setHoveredId(null);
                }}
                className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200 md:px-4"
                style={{
                  background:
                    perspective === p.id ? "var(--primary)" : "transparent",
                  color:
                    perspective === p.id
                      ? "var(--primary-foreground)"
                      : "var(--muted-foreground)",
                  boxShadow:
                    perspective === p.id
                      ? "0 2px 8px rgba(176,80,30,0.25)"
                      : "none",
                }}
              >
                {p.zh}
              </button>
            ))}
          </div>

          {/* Mobile Pill Strip — horizontally scrollable */}
          {!isIndustryPerspective && (
            <div
              className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 md:hidden"
              style={{ scrollbarWidth: "none" }}
            >
              {FLOW_STAGES.map((stage) => {
                const isActive = expandedId === stage.id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => mobileToggleExpand(stage.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-200 active:scale-95"
                    style={{
                      borderColor: isActive ? stage.color : "var(--border)",
                      background: isActive ? stage.bgColor : "var(--card)",
                      color: isActive ? stage.color : "var(--muted-foreground)",
                      boxShadow: isActive
                        ? `0 1px 4px ${stage.color}30`
                        : "none",
                    }}
                  >
                    <span style={{ color: isActive ? stage.color : "var(--muted-foreground)" }}>
                      {stageIcon(stage.iconName, "h-3.5 w-3.5")}
                    </span>
                    <span className="text-[11px]">{stage.title.zh}</span>
                    {isActive ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2
              className="h-4 w-4 animate-spin"
              style={{ color: "var(--primary)" }}
            />
            <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              加载节点数据…
            </span>
          </div>
        )}

        {!isIndustryPerspective && (
          <>
            {/* ── Flow Bar — horizontally scrollable (desktop only) ── */}
            <div
              className="hidden shrink-0 overflow-x-auto pb-2 md:block"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "var(--border) transparent",
              }}
            >
              <div className="flex w-full items-stretch gap-1.5 sm:gap-2 lg:gap-2.5">
                {FLOW_STAGES.map((stage, idx) => (
                  <FlowNode
                    key={stage.id}
                    stage={stage}
                    perspective={flowPerspective}
                    isExpanded={expandedId === stage.id}
                    isHovered={hoveredId === stage.id}
                    onExpand={() => toggleExpand(stage.id)}
                    onHover={() => setHoveredId(stage.id)}
                    onLeave={() => setHoveredId(null)}
                    showArrow={idx < FLOW_STAGES.length - 1}
                  />
                ))}
              </div>
            </div>

            {/* ── Bottom area: Overview State vs Detail State ── */}
          </>
        )}

        {isIndustryPerspective ? (
          <IndustryPyramidPanel />
        ) : expandedId === null ? (
          <OverviewPanel
            stageMappings={stageMappings}
            onStageClick={toggleExpand}
            hoveredId={hoveredId}
          />
        ) : (
          <div ref={expandRef} className="pt-4">
            {/* ── Expand Panel ── */}
            {expandedStage && (
              <div
                className="mx-auto max-w-5xl rounded-[20px] border p-4 sm:p-5 md:p-6"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-xl"
                      style={{
                        background: expandedStage.bgColor,
                        color: expandedStage.color,
                      }}
                    >
                      {stageIcon(expandedStage.iconName, "h-4 w-4")}
                    </div>
                    <div>
                      <h3
                        className="text-[15px] font-black sm:text-[17px]"
                        style={{ color: "var(--foreground)" }}
                      >
                        {expandedStage.title.zh}
                      </h3>
                      <p className="max-w-2xl text-[12px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                        {expandedStage.perspectives[flowPerspective].description}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/learn?stage=${expandedStage.id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold transition-all hover:-translate-y-0.5"
                      style={{
                        background: expandedStage.bgColor,
                        color: expandedStage.color,
                      }}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      系统学习
                    </Link>
                    <button
                      onClick={() => setExpandedId(null)}
                      className="rounded-lg p-1.5 transition-colors hover:bg-[var(--secondary)]"
                      style={{ color: "var(--muted-foreground)" }}
                      title="收起详情"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-module cards */}
                <div className="grid gap-2.5 md:grid-cols-2">
                  {expandedStage.subModules.map((sm) => (
                    <SubModuleCard
                      key={sm.id}
                      subModule={sm}
                      stageColor={expandedStage.color}
                      onTopicClick={setModalTopicId}
                    />
                  ))}
                </div>

                {/* Related nodes */}
                {expandedNodes.length > 0 && (
                  <div className="mt-4">
                    <h4
                      className="mb-2 text-[11px] font-semibold sm:text-[12px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      关联知识点 ({expandedNodes.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {expandedNodes.slice(0, 12).map((node) => {
                        const chipClass = "clay-chip inline-flex items-center gap-1 px-2 py-0.5 text-[11px] transition-colors hover:border-[var(--primary)]";
                        const chipStyle = { color: "var(--muted-foreground)" };
                        const content = node.title?.zh || node.id;
                        return (
                          <span key={node.id} onClick={() => setModalTopicId(node.id)}
                            className={`${chipClass} cursor-pointer`} style={chipStyle}>
                            {content}
                          </span>
                        );
                      })}
                      {expandedNodes.length > 12 && (
                        <span
                          className="inline-flex items-center px-2 py-1 text-[11px]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          +{expandedNodes.length - 12} 更多
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {expandedNodes.length === 0 && !loading && (
                  <p className="mt-3 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    暂无关联节点数据
                    {offline && "（离线模式）"}
                  </p>
                )}

                {/* Mobile collapse button */}
                <div className="mt-4 md:hidden">
                  <button
                    onClick={() => setExpandedId(null)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all active:scale-[0.98]"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    <ChevronUp className="h-4 w-4" />
                    收起详情
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p
          className="mt-6 pb-6 text-center text-[11px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          反向海淘 = 海外买家通过中国电商平台 + 代理服务购买中国商品
        </p>
      </div>

      {/* ── Topic Modal ── */}
      {modalTopicId && (
        <TopicModal
          topicId={modalTopicId}
          nodeMap={nodeMap}
          onClose={() => setModalTopicId(null)}
        />
      )}
    </div>
  );
}

// ─── IndustryPyramidPanel ────────────────────────────────────────────

const INDUSTRY_LAYERS = [
  {
    id: "control",
    title: "流量与规则控制层",
    subtitle: "谁掌握入口，谁就更接近利润中心",
    color: "#f59e0b",
    icon: Crown,
    width: "md:w-[46%]",
    actors: ["大 KOL", "大社区", "头部代理平台", "大卖家"],
    desc: "掌握曝光、入口、规则和用户心智。",
  },
  {
    id: "conversion",
    title: "转化与信任建设层",
    subtitle: "把流量变成能下单的理由",
    color: "#10b981",
    icon: Users,
    width: "md:w-[62%]",
    actors: ["中小 KOL / KOC", "社群运营", "买手", "内容号"],
    desc: "把用户的兴趣转成理解、信任和下单理由。",
  },
  {
    id: "service",
    title: "供给与履约服务层",
    subtitle: "决定成本、交付体验和复购风险",
    color: "#3b82f6",
    icon: Store,
    width: "md:w-[78%]",
    actors: ["国内卖家", "淘宝 / 微店 / 1688", "仓库", "支付 / 物流 / 售后"],
    desc: "决定商品成本、交付质量、时效和售后风险。",
  },
  {
    id: "demand",
    title: "海外用户需求层",
    subtitle: "所有角色最终围绕需求分配利润",
    color: "#8b5cf6",
    icon: Sparkles,
    width: "md:w-[94%]",
    actors: ["低价替代", "潮流单品", "国货", "Rep / W2C 需求"],
    desc: "所有角色最终都围绕用户想买什么来分配利润。",
  },
];

const INDUSTRY_FLOWS = [
  {
    id: "traffic",
    title: "流量流",
    color: "#0ea5e9",
    route: "KOL / 社区 → 用户 → 平台 / 卖家",
  },
  {
    id: "money",
    title: "资金流",
    color: "#f97316",
    route: "买家 → 代理平台 → 卖家 / 物流",
  },
  {
    id: "trust",
    title: "信任流",
    color: "#10b981",
    route: "QC / 晒单 → 社区 → 新买家",
  },
];

function IndustryPyramidPanel() {
  return (
    <div className="mt-2 pb-6">
      <section
        className="rounded-[28px] border p-4 sm:p-6 lg:p-8"
        style={{
          borderColor: "var(--border)",
          background:
            "radial-gradient(circle at 50% 0%, rgba(245,158,11,0.10), transparent 36%), var(--card)",
          boxShadow: "0 4px 16px rgba(120,100,80,0.10), 0 1px 4px rgba(120,100,80,0.06)",
        }}
      >
        <div className="mb-6 text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Industry Pyramid
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl" style={{ color: "var(--foreground)" }}>
            反淘行业金字塔
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            越靠上越掌握流量、信任和规则，越靠下越承担供给、履约和真实用户需求。
          </p>
        </div>

        <div className="mx-auto mb-6 grid max-w-4xl gap-2.5 md:grid-cols-3">
          {INDUSTRY_FLOWS.map((flow) => (
            <div
              key={flow.id}
              className="rounded-2xl border p-3"
              style={{
                borderColor: `${flow.color}40`,
                background: `linear-gradient(135deg, ${flow.color}12, transparent 62%), var(--background)`,
              }}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: flow.color }} />
                <p className="text-[12px] font-black" style={{ color: flow.color }}>
                  {flow.title}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold leading-relaxed" style={{ color: "var(--foreground)" }}>
                {flow.route.split(" → ").map((step, index, arr) => (
                  <React.Fragment key={step}>
                    <span>{step}</span>
                    {index < arr.length - 1 && (
                      <ArrowRight className="h-3 w-3 shrink-0" style={{ color: flow.color }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          {INDUSTRY_LAYERS.map((layer, index) => {
            const Icon = layer.icon;
            return (
              <article
                key={layer.id}
                className={`group relative w-full ${layer.width} overflow-hidden rounded-[24px] border p-4 transition-all duration-200 hover:-translate-y-0.5 sm:p-5`}
                style={{
                  borderColor: `${layer.color}55`,
                  background: `linear-gradient(135deg, ${layer.color}16, transparent 46%), var(--background)`,
                  boxShadow: `0 12px 36px ${layer.color}12`,
                }}
              >
                <div
                  className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl"
                  style={{ background: layer.color }}
                />
                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: `${layer.color}20`, color: layer.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{ background: `${layer.color}18`, color: layer.color }}
                      >
                        第 {index + 1} 层
                      </span>
                      <h3 className="text-[15px] font-black sm:text-[17px]" style={{ color: "var(--foreground)" }}>
                        {layer.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-[12px] font-semibold" style={{ color: layer.color }}>
                      {layer.subtitle}
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed sm:text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                      {layer.desc}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {layer.actors.map((actor) => (
                        <span
                          key={actor}
                          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            borderColor: `${layer.color}38`,
                            background: "var(--card)",
                            color: "var(--foreground)",
                          }}
                        >
                          {actor}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── OverviewPanel ───────────────────────────────────────────────────

function OverviewPanel({
  stageMappings,
  onStageClick,
  hoveredId,
}: {
  stageMappings: Map<FlowStageId, GraphNode[]>;
  onStageClick: (id: FlowStageId) => void;
  hoveredId: FlowStageId | null;
}) {
  const hoveredStage = hoveredId ? FLOW_STAGES.find((s) => s.id === hoveredId) : null;

  return (
    <div
      className="mt-2 rounded-[24px] border p-6 sm:p-7 lg:mt-0"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
        boxShadow: "0 4px 16px rgba(120,100,80,0.10), 0 1px 4px rgba(120,100,80,0.06)",
      }}
    >
      <div className="mb-5 text-center">
        <h2
          className="mb-1 font-sans text-lg font-bold tracking-tight sm:text-xl"
          style={{ color: "var(--foreground)" }}
        >
          先选一个阶段看
        </h2>
        <p className="text-[13px] leading-relaxed sm:text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          从流量、信任、下单、履约、回流五个阶段理解反淘生态。
        </p>
      </div>

      {/* Stage quick-jump chips */}
      <div>
        <p
          className="mb-2 text-center text-[11px] font-medium"
          style={{ color: "var(--muted-foreground)" }}
        >
          {hoveredStage
            ? `点击查看「${hoveredStage.title.zh}」阶段详情`
            : "点击上方任一阶段，查看该阶段详情"}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {FLOW_STAGES.map((stage) => {
            const count = stageMappings.get(stage.id)?.length ?? 0;
            return (
              <button
                key={stage.id}
                onClick={() => onStageClick(stage.id)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[11px] font-medium transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  borderColor: stage.color,
                  background: hoveredId === stage.id ? stage.bgColor : "transparent",
                  color: stage.color,
                  boxShadow:
                    hoveredId === stage.id
                      ? `0 2px 8px ${stage.color}20`
                      : "none",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: stage.color }}
                />
                {stage.title.zh}
                {count > 0 && (
                  <span style={{ opacity: 0.6 }}>·{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── FlowNode ───────────────────────────────────────────────────────

function FlowNode({
  stage,
  perspective,
  isExpanded,
  isHovered,
  onExpand,
  onHover,
  onLeave,
  showArrow,
}: {
  stage: FlowStageDef;
  perspective: Perspective;
  isExpanded: boolean;
  isHovered: boolean;
  onExpand: () => void;
  onHover: () => void;
  onLeave: () => void;
  showArrow: boolean;
}) {
  const pd = stage.perspectives[perspective];

  return (
    <div className="flex min-w-0 flex-1 items-stretch gap-0 md:gap-1">
      <div
        className="group relative flex w-full cursor-pointer flex-col rounded-[20px] transition-all duration-200"
        style={{
          minHeight: "116px",
          background: "var(--card)",
          border: isExpanded
            ? `2.5px solid ${stage.color}`
            : `2px solid ${stage.color}40`,
          boxShadow: isExpanded
            ? "inset 0 1px 0 rgba(255,255,255,0.6), 0 0 0 3px " + stage.color + "18, 0 6px 20px rgba(120,100,80,0.16)"
            : isHovered
              ? "inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 8px rgba(120,100,80,0.06)"
              : "none",
          transform: isExpanded ? "scale(1.03)" : "scale(1)",
        }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onClick={onExpand}
      >
        <div className="flex flex-1 flex-col p-3">
          {/* Icon + title row */}
          <div className="mb-1.5 flex items-center gap-2">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
              style={{
                background: stage.bgColor,
                color: stage.color,
              }}
            >
              {stageIcon(stage.iconName, "h-3 w-3")}
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="truncate text-[13px] leading-tight transition-colors duration-200"
                style={{
                  color: "var(--foreground)",
                  fontWeight: isExpanded ? 700 : 600,
                }}
              >
                {stage.title.zh}
              </h3>
            </div>
          </div>

          <div className="mb-2">
            <span
              className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none"
              style={{
                background: stage.region.color + "18",
                color: stage.region.color,
              }}
            >
              {stage.region.zh}
            </span>
          </div>

          <p
            className="line-clamp-2 text-[11px] leading-relaxed"
            style={{ color: "var(--muted-foreground)", opacity: 0.8 }}
          >
            {pd.description}
          </p>
        </div>

        {/* Triangle connector */}
        {isExpanded && (
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: "-8px" }}>
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderTop: `7px solid ${stage.color}`,
              }}
            />
          </div>
        )}
      </div>

      {/* Arrow between nodes */}
      {showArrow && (
        <div className="hidden shrink-0 items-center md:flex">
          <ArrowRight className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
        </div>
      )}
    </div>
  );
}

// ─── SubModuleCard ──────────────────────────────────────────────────

function SubModuleCard({
  subModule,
  stageColor,
  onTopicClick,
}: {
  subModule: SubModuleDef;
  stageColor: string;
  onTopicClick: (id: string) => void;
}) {
  const ctaContent = (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 hover:gap-1.5"
      style={{
        background: "var(--secondary)",
        color: stageColor,
      }}
    >
      {subModule.actionLabel.zh}
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </span>
  );

  return (
    <div
      className="group rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
        boxShadow: "none",
      }}
    >
      <h4
        className="mb-1.5 text-[13px] font-bold"
        style={{ color: "var(--foreground)" }}
      >
        {subModule.title.zh}
      </h4>
      <p
        className="mb-2.5 line-clamp-2 text-[11px] leading-relaxed"
        style={{ color: "var(--muted-foreground)" }}
      >
        {subModule.what.zh}
      </p>
      <span onClick={() => onTopicClick(subModule.id)} className="cursor-pointer">
        {ctaContent}
      </span>
    </div>
  );
}

// ─── Feishu block render helpers ────────────────────────────────────

/** Render inline elements with bold/italic/code/link styling. */
function ModalElementsRenderer({ elements }: { elements: FeishuElement[] }) {
  if (!elements || elements.length === 0) return null;
  return (
    <>
      {elements.map((el, i) => {
        let node: React.ReactNode = el.text;
        if (el.bold) node = <strong key={i} className="font-bold text-[var(--foreground)]">{node}</strong>;
        if (el.italic) node = <em key={i} className="italic text-[var(--muted-foreground)]">{node}</em>;
        if (el.code) node = <code key={i} className="rounded bg-[var(--secondary)]/60 px-1 py-0.5 text-[0.85em] font-mono text-rose-600">{node}</code>;
        if (el.link) {
          node = (
            <a key={i} href={el.link} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline decoration-[var(--primary)]/30 underline-offset-2 hover:decoration-[var(--primary)]">
              {node}
            </a>
          );
        }
        if (typeof node === "string") return <React.Fragment key={i}>{node}</React.Fragment>;
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </>
  );
}

type ModalRenderBlock =
  | { type: "block"; block: FeishuBlock }
  | { type: "list_group"; ordered: boolean; items: FeishuBlock[] };

function modalGroupListItems(blocks: FeishuBlock[]): ModalRenderBlock[] {
  const result: ModalRenderBlock[] = [];
  let listBuf: FeishuBlock[] = [];

  const flush = () => {
    if (listBuf.length > 0) {
      result.push({
        type: "list_group",
        ordered: listBuf[0].type === "list" ? listBuf[0].ordered : false,
        items: listBuf,
      });
      listBuf = [];
    }
  };

  for (const block of blocks) {
    if (block.type === "list") {
      if (listBuf.length > 0 && listBuf[0].type === "list" && listBuf[0].ordered !== block.ordered) {
        flush();
      }
      listBuf.push(block);
    } else {
      flush();
      result.push({ type: "block", block });
    }
  }
  flush();
  return result;
}

const MODAL_HEADING_CLASSES: Record<number, string> = {
  1: "text-xl font-extrabold tracking-tight mt-6 mb-2 pb-2 border-b border-[var(--border)]/30",
  2: "text-lg font-bold tracking-tight mt-5 mb-2 pb-1.5 border-b border-[var(--border)]/20",
  3: "text-base font-semibold mt-4 mb-1.5",
  4: "text-sm font-semibold mt-3 mb-1",
  5: "text-xs font-semibold mt-3 mb-0.5 text-[var(--muted-foreground)]",
  6: "text-[11px] font-bold uppercase tracking-wider mt-2 mb-0.5 text-[var(--muted-foreground)]",
};

function ModalContentBlock({ rb }: { rb: ModalRenderBlock }) {
  // List group
  if (rb.type === "list_group") {
    const Tag = rb.ordered ? "ol" : "ul";
    return (
      <Tag className={`my-2 space-y-1 pl-5 ${rb.ordered ? "list-decimal" : "list-disc"}`}>
        {rb.items.map((item, i) => (
          <li key={i} className="text-[13px] leading-7 text-[var(--foreground)]/90 marker:text-[var(--muted-foreground)]">
            <ModalElementsRenderer elements={"elements" in item ? (item as any).elements : []} />
          </li>
        ))}
      </Tag>
    );
  }

  const block = rb.block;

  // Divider
  if (block.type === "divider") {
    return <div className="my-3 h-px bg-[var(--border)]/30" />;
  }

  // Heading
  if (block.type === "heading") {
    const cls = MODAL_HEADING_CLASSES[block.level] || MODAL_HEADING_CLASSES[3];
    const content = <ModalElementsRenderer elements={block.elements} />;
    switch (block.level) {
      case 1: return <h1 className={cls}>{content}</h1>;
      case 2: return <h2 className={cls}>{content}</h2>;
      case 3: return <h3 className={cls}>{content}</h3>;
      case 4: return <h4 className={cls}>{content}</h4>;
      case 5: return <h5 className={cls}>{content}</h5>;
      default: return <h6 className={cls}>{content}</h6>;
    }
  }

  // Paragraph
  if (block.type === "paragraph") {
    return (
      <p className="my-2 text-[13px] leading-7 text-[var(--foreground)]/90">
        <ModalElementsRenderer elements={block.elements} />
      </p>
    );
  }

  // Single list item (shouldn't happen after grouping)
  if (block.type === "list") {
    return (
      <p className="my-1 text-[13px] leading-7 text-[var(--foreground)]/90">
        <span className="mr-2 text-[var(--muted-foreground)]">{block.ordered ? "1." : "•"}</span>
        <ModalElementsRenderer elements={block.elements} />
      </p>
    );
  }

  // Blockquote
  if (block.type === "blockquote") {
    return (
      <blockquote className="my-3 border-l-3 border-[var(--primary)]/40 pl-4 text-[13px] leading-7 text-[var(--muted-foreground)] italic bg-[var(--secondary)]/20 rounded-r-lg py-2 pr-3">
        <ModalElementsRenderer elements={block.elements} />
      </blockquote>
    );
  }

  // Code
  if (block.type === "code") {
    return (
      <pre className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]/40 bg-[var(--secondary)]/30 p-4 text-xs leading-6 font-mono text-[var(--foreground)]/80">
        <code>{block.text}</code>
      </pre>
    );
  }

  // Callout
  if (block.type === "callout") {
    return (
      <div className="my-3 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-4 text-[13px] leading-7 text-[var(--foreground)]/90">
        <ModalElementsRenderer elements={block.elements} />
      </div>
    );
  }

  return null;
}

// ─── TopicModal ─────────────────────────────────────────────────────

function TopicModal({
  topicId,
  nodeMap,
  onClose,
}: {
  topicId: string;
  nodeMap: Map<string, GraphNode>;
  onClose: () => void;
}) {
  const result = findTopicById(topicId);
  let feishuUrl = getFeishuUrl(topicId);

  // Resolve from knowledge graph node if not a stage/submodule
  const kgNode: GraphNode | undefined = (!result ? nodeMap.get(topicId) : undefined);

  // Try to find a Feishu URL from knowledge graph node resources
  if (!feishuUrl && kgNode?.resources) {
    const feishuRes = kgNode.resources.find(
      (r) => r.type === "doc" && r.url.includes("feishu.cn"),
    );
    if (feishuRes) feishuUrl = feishuRes.url;
  }

  // Also try any Feishu-like URL in resources
  if (!feishuUrl && kgNode?.resources) {
    const anyFeishu = kgNode.resources.find((r) => r.url.includes("feishu.cn"));
    if (anyFeishu) feishuUrl = anyFeishu.url;
  }

  const [blocks, setBlocks] = useState<FeishuBlock[]>([]);
  const [pageTitle, setPageTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [fetchStarted, setFetchStarted] = useState(false);

  // Title: from ecosystem-data → knowledge graph node → raw topicId
  const title =
    result?.type === "subModule"
      ? result.subModule!.title.zh
      : result?.type === "stage"
        ? result.stage!.title.zh
        : kgNode
          ? (kgNode.title?.zh || kgNode.id)
          : topicId;

  // Stage color & breadcrumb info
  const stageColor = (() => {
    if (result?.type === "subModule") return result.stage!.color;
    if (result?.type === "stage") return result.stage!.color;
    if (kgNode) {
      const cls = classifyToStage(kgNode);
      if (cls.stage) {
        const s = FLOW_STAGES.find((fs) => fs.id === cls.stage);
        if (s) return s.color;
      }
    }
    return "var(--primary)";
  })();

  const stageTitle = (() => {
    if (result?.type === "subModule") return result.stage!.title.zh;
    if (result?.type === "stage") return null;
    if (kgNode) {
      const cls = classifyToStage(kgNode);
      if (cls.stage) {
        const s = FLOW_STAGES.find((fs) => fs.id === cls.stage);
        if (s) return s.title.zh;
      }
    }
    return null;
  })();

  const stageIconName = (() => {
    if (result?.type === "subModule") return result.stage!.iconName;
    if (result?.type === "stage") return null;
    if (kgNode) {
      const cls = classifyToStage(kgNode);
      if (cls.stage) {
        const s = FLOW_STAGES.find((fs) => fs.id === cls.stage);
        if (s) return s.iconName;
      }
    }
    return null;
  })();

  // Local summary data has been removed per user request.
  // Only full Feishu content is shown.

  // Fetch full Feishu document content (only if URL is available)
  useEffect(() => {
    if (!feishuUrl) {
      setLoading(false);
      setFetchStarted(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFetchStarted(true);
    setFetchError("");
    setBlocks([]);
    (async () => {
      try {
        const data = await fetchResourceContent(feishuUrl);
        if (cancelled) return;
        if (data.error) {
          setFetchError(data.error);
        } else {
          setPageTitle(data.title || title);
          setBlocks(data.blocks || []);
        }
      } catch (e) {
        if (!cancelled) setFetchError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [feishuUrl, title]);

  const renderBlocks = useMemo(
    () => modalGroupListItems(blocks),
    [blocks],
  );

  const hasFeishuContent = renderBlocks.length > 0;
  const noUrl = !feishuUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden border shadow-2xl md:max-h-[85vh] md:max-w-[640px] md:rounded-2xl"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0 flex-1">
            {/* Stage breadcrumb */}
            {stageTitle && (
              <div className="mb-0.5 flex items-center gap-1.5">
                {stageIconName && (
                  <span style={{ color: stageColor }}>
                    {stageIcon(stageIconName, "h-3 w-3")}
                  </span>
                )}
                <span
                  className="text-[10px] font-medium"
                  style={{ color: stageColor }}
                >
                  {stageTitle}
                </span>
              </div>
            )}
            <h2
              className="truncate pr-4 text-base font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {pageTitle || title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {feishuUrl && (
              <a
                href={feishuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)]/60 px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40 hover:text-[var(--foreground)] transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                飞书原文
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--secondary)]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content area — only full Feishu document content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在加载文档内容…
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                文档内容加载失败
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
                {fetchError}
              </p>
              {feishuUrl && (
                <a
                  href={feishuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--secondary)]"
                  style={{ color: stageColor }}
                >
                  <ExternalLink className="h-3 w-3" />
                  在飞书查看完整文档
                </a>
              )}
            </div>
          ) : hasFeishuContent ? (
            <article className="pb-2">
              {renderBlocks.map((rb, i) => (
                <ModalContentBlock key={i} rb={rb} />
              ))}
            </article>
          ) : noUrl ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                暂无该主题的文档内容
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                文档内容为空
              </p>
              {feishuUrl && (
                <a
                  href={feishuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--secondary)]"
                  style={{ color: stageColor }}
                >
                  <ExternalLink className="h-3 w-3" />
                  在飞书查看完整文档
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer: Feishu link (always visible when URL exists and content loaded) */}
        {feishuUrl && hasFeishuContent && !loading && (
          <div
            className="shrink-0 border-t px-5 py-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <a
              href={feishuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--secondary)]"
              style={{ color: stageColor }}
            >
              <ExternalLink className="h-3 w-3" />
              在飞书查看完整文档
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

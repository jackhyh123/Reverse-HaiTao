"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, FileText, FolderOpen, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useAppShell } from "@/context/AppShellContext";
import FloatingAITutor from "@/components/learn/FloatingAITutor";
import KnowledgeMapFlow from "@/components/learn/KnowledgeMapFlow";
import NodeDetailPanel from "@/components/learn/NodeDetailPanel";
import {
  type GraphNode,
  type KnowledgeGraph,
  type NodeResource,
  fetchGraph,
  fetchMyProgress,
  resetProgress,
} from "@/lib/knowledge-graph";

type LocaleKey = "zh" | "en";

export default function LearnPage() {
  const { t, i18n } = useTranslation();
  const locale: LocaleKey = i18n.language.startsWith("zh") ? "zh" : "en";
  const { user } = useAuth();
  const { sidebarCollapsed } = useAppShell();
  const isMobile = useIsMobile();

  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [trackId, setTrackId] = useState<string>("seller");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [previewNode, setPreviewNode] = useState<GraphNode | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ nodeId: string | null; nonce: number }>({
    nodeId: null,
    nonce: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const g = await fetchGraph();
      setGraph(g);
      setLoading(false);
      const p = await fetchMyProgress().catch(() => ({
        progress: [],
        mastered_node_ids: [],
      }));
      setMasteredIds(new Set(p.mastered_node_ids));
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const trackNodes = useMemo(
    () => (graph ? graph.nodes.filter((n) => n.track_ids.includes(trackId)) : []),
    [graph, trackId],
  );

  const masteredCount = useMemo(
    () => trackNodes.filter((n) => masteredIds.has(n.id)).length,
    [trackNodes, masteredIds],
  );

  const resourceDesktop = useMemo(() => {
    if (!graph) return { left: [], right: [] };
    const left = uniqueResources(
      graph.nodes
        .slice(0, 3)
        .flatMap((node) => node.resources || []),
    ).slice(0, 3);
    const activePreview =
      previewNode && previewNode.track_ids.includes(trackId) ? previewNode : null;
    const right = activePreview
      ? uniqueResources(activePreview.resources || []).slice(0, 4)
      : uniqueResources(
          trackNodes
            .slice(3, 9)
            .flatMap((node) => node.resources || []),
        ).slice(0, 4);
    return { left, right };
  }, [graph, previewNode, trackId, trackNodes]);

  const handleMarkMastered = async () => {
    await reload();
  };

  const requestNodeFocus = useCallback((nodeId: string) => {
    setFocusRequest((prev) => ({ nodeId, nonce: prev.nonce + 1 }));
  }, []);

  const handleSelectNodeById = (nodeId: string) => {
    const next = graph?.nodes.find((n) => n.id === nodeId);
    if (!next) return;
    if (!next.track_ids.includes(trackId)) {
      setTrackId(next.track_ids[0] || trackId);
    }
    setPreviewNode(next);
    setSelectedNode(next);
    requestNodeFocus(next.id);
  };

  const handleReset = async () => {
    if (!user) return;
    if (!confirm(t("learn.confirmReset"))) return;
    await resetProgress();
    await reload();
    setSelectedNode(null);
  };

  if (loading || !graph) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("learn.loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[var(--border)]/40 bg-[var(--background)] px-3 py-2 md:px-5 md:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 md:flex-none">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-base font-semibold md:text-lg">{t("learn.title")}</h1>
              <div className="hidden text-xs text-[var(--muted-foreground)] md:block">
                {t("learn.subtitle")}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] md:gap-2 md:text-xs">
            <span>
              {user ? `${masteredCount}/${trackNodes.length} 已掌握` : "公测中"}
            </span>
            {user && (
              <button
                onClick={handleReset}
                title={t("learn.resetProgress")}
                className="rounded-lg border border-[var(--border)]/60 p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 md:mt-0 md:overflow-visible md:pb-0">
          {graph.tracks.map((tr) => (
            <button
              key={tr.id}
              onClick={() => {
                setTrackId(tr.id);
                setPreviewNode(null);
                setSelectedNode(null);
              }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors md:py-1 ${
                tr.id === trackId
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                  : "border-[var(--border)]/70 hover:bg-[var(--secondary)]/50"
              }`}
            >
              {tr.label[locale]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="border-b border-red-300 bg-red-50 px-5 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Welcome strip: track cards + progress + resources (only when no node selected) */}
      {!selectedNode && (
        <WelcomeStrip
          graph={graph}
          trackId={trackId}
          masteredCount={masteredCount}
          totalCount={trackNodes.length}
          locale={locale}
          onPickTrack={(tid) => {
            setTrackId(tid);
            setPreviewNode(null);
            setSelectedNode(null);
          }}
        />
      )}

      {/* Main layout: map (left) + detail panel (right) */}
      <div className="relative flex min-h-0 flex-1">
        {/* Map */}
        <div
          className={`relative min-w-0 transition-all duration-300 ${
            selectedNode ? "flex-1" : "flex-1"
          }`}
        >
          <KnowledgeMapFlow
            graph={graph}
            trackId={trackId}
            masteredIds={masteredIds}
            selectedNodeId={selectedNode?.id || null}
            focusNodeId={focusRequest.nodeId}
            focusVersion={focusRequest.nonce}
            openOnSingleTap={isMobile}
            onPreviewNode={(node) => setPreviewNode(node)}
            onSelectNode={(node) => {
              setPreviewNode(node);
              setSelectedNode(node);
              requestNodeFocus(node.id);
            }}
            locale={locale}
          />
          {selectedNode && (
            <NodeMiniRail
              nodes={trackNodes}
              selectedNodeId={selectedNode.id}
              masteredIds={masteredIds}
              locale={locale}
              onSelect={(node) => {
                setPreviewNode(node);
                setSelectedNode(node);
                requestNodeFocus(node.id);
              }}
            />
          )}
          {!selectedNode && (
            <>
              <ResourceDesktop
                locale={locale}
                leftResources={resourceDesktop.left}
                rightResources={resourceDesktop.right}
                rightTitle={
                  previewNode?.track_ids.includes(trackId)
                    ? previewNode.title[locale]
                    : undefined
                }
              />
              <ResourceMobileThumbs
                locale={locale}
                resources={uniqueResources([
                  ...resourceDesktop.left,
                  ...resourceDesktop.right,
                ]).slice(0, 5)}
              />
            </>
          )}
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="fixed inset-x-0 bottom-0 z-50 flex h-[82dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-[var(--border)]/60 bg-[var(--background)] shadow-[0_-24px_80px_rgba(15,23,42,0.22)] md:static md:h-auto md:w-[480px] md:shrink-0 md:rounded-none md:border-l md:border-t-0 md:shadow-none">
            <NodeMiniStrip
              nodes={trackNodes}
              selectedNodeId={selectedNode.id}
              masteredIds={masteredIds}
              locale={locale}
              onSelect={(node) => {
                setPreviewNode(node);
                setSelectedNode(node);
                requestNodeFocus(node.id);
              }}
            />
            <NodeDetailPanel
              node={selectedNode}
              locale={locale}
              isMastered={masteredIds.has(selectedNode.id)}
              isLoggedIn={!!user}
              onClose={() => setSelectedNode(null)}
              onMarkMastered={handleMarkMastered}
              onSelectNodeById={handleSelectNodeById}
            />
          </div>
        )}
      </div>

      {/* 固定的 AI 导师长条（节点详情面板打开时让出右侧 480px） */}
      <FloatingAITutor
        trackLabel={graph.tracks.find((tr) => tr.id === trackId)?.label[locale]}
        leftOffsetPx={isMobile ? 0 : sidebarCollapsed ? 60 : 220}
        rightOffsetPx={isMobile ? 0 : selectedNode ? 480 : 0}
        isLoggedIn={!!user}
        disabled={!!selectedNode}
      />
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobile;
}

function NodeMiniRail({
  nodes,
  selectedNodeId,
  masteredIds,
  locale,
  onSelect,
}: {
  nodes: GraphNode[];
  selectedNodeId: string;
  masteredIds: Set<string>;
  locale: LocaleKey;
  onSelect: (node: GraphNode) => void;
}) {
  return (
    <nav className="pointer-events-none absolute left-4 top-1/2 z-30 hidden max-h-[72vh] -translate-y-1/2 md:block">
      <div className="pointer-events-auto flex flex-col gap-2 overflow-y-auto rounded-[22px] border border-[var(--border)]/55 bg-[var(--background)]/70 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        {nodes.map((node, index) => {
          const active = node.id === selectedNodeId;
          const mastered = masteredIds.has(node.id);
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              title={node.title[locale]}
              className={`group flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-black transition-all ${
                active
                  ? "scale-110 border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg"
                  : mastered
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-[var(--primary)]"
                  : "border-[var(--border)]/65 bg-[var(--card)]/80 text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
              }`}
            >
              {index + 1}
              <span className="pointer-events-none absolute left-14 hidden max-w-[220px] rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] px-3 py-2 text-left text-xs font-semibold text-[var(--foreground)] shadow-xl group-hover:block">
                {node.title[locale]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function NodeMiniStrip({
  nodes,
  selectedNodeId,
  masteredIds,
  locale,
  onSelect,
}: {
  nodes: GraphNode[];
  selectedNodeId: string;
  masteredIds: Set<string>;
  locale: LocaleKey;
  onSelect: (node: GraphNode) => void;
}) {
  return (
    <nav className="shrink-0 border-b border-[var(--border)]/45 bg-[var(--background)]/92 px-3 py-2 backdrop-blur md:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {nodes.map((node, index) => {
          const active = node.id === selectedNodeId;
          const mastered = masteredIds.has(node.id);
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              className={`flex min-w-[92px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : mastered
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-[var(--border)]/65 bg-[var(--secondary)]/25 text-[var(--muted-foreground)]"
              }`}
              title={node.title[locale]}
            >
              <span>{index + 1}</span>
              <span className="truncate">{node.title[locale]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Welcome strip ────────────────────────────────────────────────
// 整合自旧首页 LaunchHub：双轨道描述卡 + 进度概览 + 推荐资源链接

const TRACK_DESCRIPTIONS: Record<string, { tagline: { zh: string; en: string }; outcome: { zh: string; en: string } }> = {
  seller: {
    tagline: {
      zh: "面向反淘卖家——找到能卖货的渠道路径",
      en: "For sellers — find proven sales-channel paths",
    },
    outcome: {
      zh: "学完后你能：判断哪些平台/KOL/渠道值得入驻 + 复盘自己的数据",
      en: "Outcome: judge which platforms/KOLs/channels to invest in + review your own data",
    },
  },
  operator: {
    tagline: {
      zh: "面向反淘平台——监控竞品、拦截渠道、设计后台",
      en: "For operators — monitor competitors, capture channels, design back-office",
    },
    outcome: {
      zh: "学完后你能：搭出平台 MVP + 制定渠道策略 + 设计收入模型",
      en: "Outcome: scaffold platform MVP + plan channel strategy + design revenue model",
    },
  },
};

const RECOMMENDED_RESOURCES = [
  {
    title: { zh: "反淘从 0 到 1：行业概览", en: "AntiTao 0→1 industry overview" },
    href: "https://xcn8pgdlg8x0.feishu.cn/wiki/RmmJwBcJjiM4mzks2z2cjyQvnFc",
    desc: { zh: "起源 / 市场规模 / 关键玩家", en: "Origins / size / key players" },
  },
  {
    title: { zh: "反向海淘淘金榜（实时数据）", en: "AntiTao Leaderboard" },
    href: "https://xcn8pgdlg8x0.feishu.cn/base/HBq8bRILLaGwNPssyxdcjFdkn4c",
    desc: { zh: "平台 / 工具 / 渠道实时排名", en: "Live ranking of platforms / tools / channels" },
  },
];

function WelcomeStrip({
  graph,
  trackId,
  masteredCount,
  totalCount,
  locale,
  onPickTrack,
}: {
  graph: KnowledgeGraph;
  trackId: string;
  masteredCount: number;
  totalCount: number;
  locale: LocaleKey;
  onPickTrack: (id: string) => void;
}) {
  const pct = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100);
  const trackColor = graph.tracks.find((t) => t.id === trackId)?.color || "#1a73e8";
  return (
    <div className="hidden border-b border-[var(--border)]/40 bg-[var(--secondary)]/15 px-5 py-2 md:block">
      <div className="flex items-center gap-3">
        {/* 双轨道选择卡——单行紧凑 */}
        <div className="flex flex-1 gap-2 min-w-0">
          {graph.tracks.map((tr) => {
            const desc = TRACK_DESCRIPTIONS[tr.id];
            const active = tr.id === trackId;
            return (
              <button
                key={tr.id}
                onClick={() => onPickTrack(tr.id)}
                className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-all min-w-0 ${
                  active
                    ? "border-[var(--primary)] bg-[var(--background)] shadow-sm"
                    : "border-[var(--border)]/40 bg-[var(--background)]/40 hover:border-[var(--border)]/80"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tr.color }}
                />
                <span className="text-xs font-semibold whitespace-nowrap">{tr.label[locale]}</span>
                {desc && (
                  <span className="truncate text-[11px] text-[var(--muted-foreground)]">
                    {desc.tagline[locale]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 进度——内联 */}
        <div className="hidden md:flex items-center gap-2 shrink-0 rounded-xl border border-[var(--border)]/40 bg-[var(--background)] px-3 py-1.5">
          <Sparkles className="h-3 w-3 text-[var(--primary)]" />
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5 text-[11px]">
              <span className="font-semibold">{t_progress(masteredCount, totalCount, pct)}</span>
            </div>
            <div className="mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-[var(--secondary)]/50">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: trackColor }}
              />
            </div>
          </div>
        </div>

        {/* 资源——下拉 hover */}
        <details className="hidden lg:block group relative shrink-0">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-[var(--border)]/40 bg-[var(--background)] px-3 py-2 text-xs hover:border-[var(--border)]/80">
            <BookOpen className="h-3 w-3 text-[var(--primary)]" />
            <span>{locale === "zh" ? "延伸阅读" : "Reading"}</span>
            <span className="text-[10px] text-[var(--muted-foreground)]">▾</span>
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1 w-[260px] rounded-xl border border-[var(--border)]/60 bg-[var(--background)] p-2 shadow-2xl">
            {RECOMMENDED_RESOURCES.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-lg p-2 text-xs hover:bg-[var(--secondary)]/40"
              >
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
                <div className="min-w-0">
                  <div className="font-semibold">{r.title[locale]}</div>
                  <div className="truncate text-[10px] text-[var(--muted-foreground)]">
                    {r.desc[locale]}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

function t_progress(done: number, total: number, pct: number): string {
  return `${done}/${total} · ${pct}%`;
}

function uniqueResources(resources: NodeResource[]): NodeResource[] {
  const seen = new Set<string>();
  return resources.filter((resource) => {
    const key = resource.url || resource.title.zh;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ResourceDesktop({
  locale,
  leftResources,
  rightResources,
  rightTitle,
}: {
  locale: LocaleKey;
  leftResources: NodeResource[];
  rightResources: NodeResource[];
  rightTitle?: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-8 z-10 hidden justify-between gap-4 md:flex">
      <ResourceStack
        locale={locale}
        title={locale === "zh" ? "开始前必读" : "Start Here"}
        subtitle={locale === "zh" ? "先校准概念，再进入节点" : "Calibrate the basics before nodes"}
        resources={leftResources}
        align="left"
      />
      <ResourceStack
        locale={locale}
        title={rightTitle || (locale === "zh" ? "当前路径资料" : "Track Files")}
        subtitle={rightTitle ? (locale === "zh" ? "当前节点的资料" : "Current node files") : (locale === "zh" ? "点击节点后切换资料" : "Click a node to switch files")}
        resources={rightResources}
        align="right"
      />
    </div>
  );
}

function ResourceStack({
  locale,
  title,
  subtitle,
  resources,
  align,
}: {
  locale: LocaleKey;
  title: string;
  subtitle: string;
  resources: NodeResource[];
  align: "left" | "right";
}) {
  if (resources.length === 0) return null;
  return (
    <section
      className={`pointer-events-auto w-[188px] rounded-[24px] border border-[var(--border)]/35 bg-[var(--background)]/58 p-2.5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-slate-950/50 lg:w-[220px] xl:w-[240px] ${
        align === "right" ? "translate-y-10" : ""
      }`}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-300/20 dark:text-amber-200">
          <FolderOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-black">{title}</div>
          <div className="truncate text-[11px] text-[var(--muted-foreground)]">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-2">
        {resources.map((resource, index) => (
          <a
            key={`${resource.url}-${resource.title[locale]}`}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
            style={{ transform: `rotate(${align === "left" ? -1.5 + index * 1.2 : 1.5 - index * 1.1}deg)` }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border)]/45 bg-[var(--background)]/86 p-2.5 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:border-[var(--primary)]/50 group-hover:shadow-xl dark:bg-slate-900/86 lg:p-3">
              <div className="absolute right-0 top-0 h-8 w-8 rounded-bl-2xl bg-amber-100 dark:bg-amber-300/20" />
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-xs font-black leading-5">
                    {resource.title[locale]}
                  </div>
                  {resource.summary?.[locale] && (
                    <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--muted-foreground)]">
                      {resource.summary[locale]}
                    </div>
                  )}
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] opacity-60 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function ResourceMobileThumbs({
  locale,
  resources,
}: {
  locale: LocaleKey;
  resources: NodeResource[];
}) {
  if (resources.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 md:hidden">
      <div className="pointer-events-auto flex gap-2 overflow-x-auto rounded-2xl border border-[var(--border)]/45 bg-[var(--background)]/62 p-2 shadow-[0_14px_42px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        {resources.map((resource, index) => (
          <a
            key={`${resource.url}-${index}`}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-[132px] max-w-[150px] shrink-0 items-center gap-2 rounded-xl border border-[var(--border)]/45 bg-[var(--card)]/82 px-2.5 py-2 text-xs shadow-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-black">
                {resource.title[locale]}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-[var(--muted-foreground)]">
                {resource.type.toUpperCase()}
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

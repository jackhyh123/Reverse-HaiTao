"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ExternalLink, FileText, FolderOpen, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useAppShell } from "@/context/AppShellContext";
import FloatingAITutor from "@/components/learn/FloatingAITutor";
import InlineResourceReader from "@/components/learn/InlineResourceReader";
import KnowledgeMapFlow from "@/components/learn/KnowledgeMapFlow";
import NodeDetailPanel from "@/components/learn/NodeDetailPanel";
import { detectMilestones, MilestoneToast, type MilestoneDef } from "@/components/learn/MilestoneNotification";
import AchievementBadges from "@/components/learn/AchievementBadges";
import {
  type GraphNode,
  type KnowledgeGraph,
  type NodeResource,
  fetchGraph,
  fetchMyProgress,
  resetProgress,
} from "@/lib/knowledge-graph";
import { updateStreak } from "@/lib/learning-streak";

type LocaleKey = "zh" | "en";

export default function LearnPage() {
  const { t, i18n } = useTranslation();
  const locale: LocaleKey = i18n.language.startsWith("zh") ? "zh" : "en";
  const { user } = useAuth();
  const { sidebarCollapsed } = useAppShell();
  const isMobile = useIsMobile();

  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [notesByNodeId, setNotesByNodeId] = useState<Map<string, string>>(new Map());
  const [trackId, setTrackId] = useState<string>("seller");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [previewNode, setPreviewNode] = useState<GraphNode | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ nodeId: string | null; nonce: number }>({
    nodeId: null,
    nonce: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingMilestones, setPendingMilestones] = useState<MilestoneDef[]>([]);
  const [streak, setStreak] = useState(0);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [readerTitle, setReaderTitle] = useState("");
  const [readerNodeId, setReaderNodeId] = useState("");
  const [readerStack, setReaderStack] = useState<
    { url: string; title: string; nodeId: string }[]
  >([]);
  // Refs for latest reader state (avoids stale closure in navigation callbacks)
  const readerUrlRef = useRef(readerUrl);
  const readerTitleRef = useRef(readerTitle);
  const readerNodeIdRef = useRef(readerNodeId);
  readerUrlRef.current = readerUrl;
  readerTitleRef.current = readerTitle;
  readerNodeIdRef.current = readerNodeId;

  // P4.2: Drawer fullscreen with drag-down-to-close (mobile)
  const [drawerDragY, setDrawerDragY] = useState(0);
  const [drawerDragging, setDrawerDragging] = useState(false);
  const drawerTouchStartRef = useRef(0);
  const drawerDragYRef = useRef(0);
  const drawerDraggingRef = useRef(false);

  const onDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    drawerTouchStartRef.current = e.touches[0].clientY;
    drawerDraggingRef.current = true;
    setDrawerDragging(true);
    setDrawerDragY(0);
    drawerDragYRef.current = 0;
  }, []);

  const onDrawerTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drawerDraggingRef.current) return;
    const delta = e.touches[0].clientY - drawerTouchStartRef.current;
    // Only allow dragging down, not up
    drawerDragYRef.current = Math.max(0, delta);
    setDrawerDragY(Math.max(0, delta));
  }, []);

  const onDrawerTouchEnd = useCallback(() => {
    drawerDraggingRef.current = false;
    setDrawerDragging(false);
    const delta = drawerDragYRef.current;
    setDrawerDragY(0);
    drawerDragYRef.current = 0;

    if (delta > 100) {
      // Swiped down significantly → close drawer
      setSelectedNode(null);
      setPreviewNode(null);
    }
    // Otherwise snap back
  }, []);

  // Reset drawer drag state when node changes
  useEffect(() => {
    setDrawerDragY(0);
    setDrawerDragging(false);
  }, [selectedNode?.id]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const g = await fetchGraph();
      setGraph(g);
      setLoading(false);
      const p = await fetchMyProgress().catch(() => ({
        progress: [] as any[],
        mastered_node_ids: [] as string[],
      }));
      setMasteredIds(new Set(p.mastered_node_ids));
      const notesMap = new Map<string, string>();
      for (const row of p.progress) {
        if (row.notes) notesMap.set(row.node_id, row.notes);
      }
      setNotesByNodeId(notesMap);

      // Detect milestones
      const foundationIds = g.nodes
        .filter((n) => n.track_ids.length >= 2)
        .map((n) => n.id);
      const sellerIds = g.nodes
        .filter((n) => n.track_ids.includes("seller"))
        .map((n) => n.id);
      const operatorIds = g.nodes
        .filter((n) => n.track_ids.includes("operator"))
        .map((n) => n.id);
      const allIds = g.nodes.map((n) => n.id);
      const newMilestones = detectMilestones(
        foundationIds, sellerIds, operatorIds, allIds,
        new Set(p.mastered_node_ids),
      );
      if (newMilestones.length > 0) {
        setPendingMilestones(newMilestones);
      }
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    // Update streak
    const data = updateStreak();
    setStreak(data.currentStreak);
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

  const badgeConditions = useMemo(() => {
    if (!graph) return { foundationMastered: false, sellerTrackMastered: false, operatorTrackMastered: false, allMastered: false, notesNodeCount: 0 };
    const allIds = graph.nodes.map((n) => n.id);
    const foundationIds = graph.nodes.filter((n) => n.track_ids.length >= 2).map((n) => n.id);
    const sellerIds = graph.nodes.filter((n) => n.track_ids.includes("seller")).map((n) => n.id);
    const operatorIds = graph.nodes.filter((n) => n.track_ids.includes("operator")).map((n) => n.id);
    return {
      foundationMastered: foundationIds.every((id) => masteredIds.has(id)),
      sellerTrackMastered: sellerIds.every((id) => masteredIds.has(id)),
      operatorTrackMastered: operatorIds.every((id) => masteredIds.has(id)),
      allMastered: allIds.every((id) => masteredIds.has(id)),
      notesNodeCount: Array.from(notesByNodeId.values()).filter((n) => n && n.trim()).length,
    };
  }, [graph, masteredIds, notesByNodeId]);

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

  const handleOpenResource = useCallback((url: string, title: string) => {
    // Find which node this resource belongs to
    const owner = graph?.nodes.find((n) =>
      (n.resources || []).some((r) => r.url === url),
    );
    setReaderNodeId(owner?.id || "");
    setReaderUrl(url);
    setReaderTitle(title);
    setReaderStack([]); // Clear navigation stack on new resource open
  }, [graph]);

  const handleNavigateToLinkedDoc = useCallback(
    (url: string, title: string, nodeId: string) => {
      const currentUrl = readerUrlRef.current;
      if (currentUrl) {
        setReaderStack((prev) => [
          ...prev,
          {
            url: currentUrl,
            title: readerTitleRef.current,
            nodeId: readerNodeIdRef.current,
          },
        ]);
      }
      setReaderUrl(url);
      setReaderTitle(title);
      setReaderNodeId(nodeId);
    },
    [],
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      let target: { url: string; title: string; nodeId: string } | undefined;
      setReaderStack((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        target = prev[index];
        return prev.slice(0, index);
      });
      if (target) {
        setReaderUrl(target.url);
        setReaderTitle(target.title);
        setReaderNodeId(target.nodeId);
      }
    },
    [],
  );

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
            {streak > 0 && user && (
              <span className="hidden md:inline">🔥 {streak} 天</span>
            )}
            <span>
              {user ? `${masteredCount}/${trackNodes.length} 已掌握` : "公测中"}
            </span>
            {graph && user && (
              <AchievementBadges
                locale={locale}
                masteredCount={masteredCount}
                foundationMastered={badgeConditions.foundationMastered}
                sellerTrackMastered={badgeConditions.sellerTrackMastered}
                operatorTrackMastered={badgeConditions.operatorTrackMastered}
                allMastered={badgeConditions.allMastered}
                notesNodeCount={badgeConditions.notesNodeCount}
              />
            )}
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

      {/* Compact progress card (mobile only, above the map) */}
      {!selectedNode && (
        <MobileProgressCard
          trackNodes={trackNodes}
          masteredIds={masteredIds}
          masteredCount={masteredCount}
          trackColor={graph.tracks.find((t) => t.id === trackId)?.color || "#1a73e8"}
        />
      )}

      {/* Welcome strip: track cards + progress + resources (only when no node selected) */}
      {!selectedNode && (
        <WelcomeStrip
          graph={graph}
          trackId={trackId}
          trackNodes={trackNodes}
          masteredIds={masteredIds}
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
            compact={isMobile}
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
            <ResourceDesktop
              locale={locale}
              leftResources={resourceDesktop.left}
              rightResources={resourceDesktop.right}
              rightTitle={
                previewNode?.track_ids.includes(trackId)
                  ? previewNode.title[locale]
                  : undefined
              }
              onOpenResource={handleOpenResource}
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] border-t border-[var(--border)]/60 bg-[var(--background)] shadow-[0_-24px_80px_rgba(15,23,42,0.22)] md:static md:h-auto md:w-[480px] md:shrink-0 md:rounded-none md:border-l md:border-t-0 md:shadow-none"
            style={{
              height: "92dvh",
              transform: drawerDragY ? `translateY(${Math.max(0, drawerDragY)}px)` : undefined,
              transition: drawerDragging ? "none" : "height 0.3s ease, transform 0.3s ease",
            }}
          >
            {/* Drag handle (mobile only) */}
            <div
              className="flex shrink-0 justify-center py-2 md:hidden"
              onTouchStart={onDrawerTouchStart}
              onTouchMove={onDrawerTouchMove}
              onTouchEnd={onDrawerTouchEnd}
            >
              <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
            </div>

            <NodeDetailPanel
              node={selectedNode}
              locale={locale}
              isMastered={masteredIds.has(selectedNode.id)}
              isLoggedIn={!!user}
              initialNotes={notesByNodeId.get(selectedNode.id) || ""}
              onClose={() => setSelectedNode(null)}
              onMarkMastered={handleMarkMastered}
              onSelectNodeById={handleSelectNodeById}
              onPrevNode={() => {
                  const idx = trackNodes.findIndex((n) => n.id === selectedNode.id);
                  const prev = idx > 0 ? trackNodes[idx - 1] : null;
                  if (prev) handleSelectNodeById(prev.id);
                }}
              onNextNode={() => {
                  const idx = trackNodes.findIndex((n) => n.id === selectedNode.id);
                  const next = idx < trackNodes.length - 1 ? trackNodes[idx + 1] : null;
                  if (next) handleSelectNodeById(next.id);
                }}
              hasPrev={
                trackNodes.findIndex((n) => n.id === selectedNode.id) > 0
              }
              hasNext={
                trackNodes.findIndex((n) => n.id === selectedNode.id) < trackNodes.length - 1
              }
            />
          </div>
        )}
      </div>

      {/* Inline resource reader */}
      {readerUrl && (
        <InlineResourceReader
          nodeId={readerNodeId}
          url={readerUrl}
          title={readerTitle}
          locale={locale}
          onClose={() => { setReaderUrl(null); setReaderTitle(""); setReaderNodeId(""); setReaderStack([]); }}
          onNavigate={handleNavigateToLinkedDoc}
          breadcrumbStack={readerStack}
          onBreadcrumbClick={handleBreadcrumbClick}
        />
      )}

      {/* Milestone toasts */}
      {pendingMilestones.map((ms) => (
        <MilestoneToast
          key={ms.id}
          milestone={ms}
          locale={locale}
          onDismiss={() =>
            setPendingMilestones((prev) => prev.filter((m) => m.id !== ms.id))
          }
        />
      ))}

      {/* 固定的 AI 导师长条（移动端抽屉打开时隐藏，桌面端让出右侧面板） */}
      {!(isMobile && selectedNode) && (
        <FloatingAITutor
          trackLabel={graph.tracks.find((tr) => tr.id === trackId)?.label[locale]}
          leftOffsetPx={isMobile ? 0 : sidebarCollapsed ? 60 : 220}
          rightOffsetPx={isMobile ? 0 : selectedNode ? 480 : 0}
          isLoggedIn={!!user}
          disabled={!!selectedNode}
        />
      )}
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
  trackNodes,
  masteredIds,
  masteredCount,
  totalCount,
  locale,
  onPickTrack,
}: {
  graph: KnowledgeGraph;
  trackId: string;
  trackNodes: GraphNode[];
  masteredIds: Set<string>;
  masteredCount: number;
  totalCount: number;
  locale: LocaleKey;
  onPickTrack: (id: string) => void;
}) {
  const pct = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100);
  const trackColor = graph.tracks.find((t) => t.id === trackId)?.color || "#1a73e8";
  const desc = TRACK_DESCRIPTIONS[trackId];

  // Find current step: first unlocked-but-not-mastered node
  const currentStepIndex = trackNodes.findIndex(
    (n) => !masteredIds.has(n.id) && n.prerequisites.every((p) => masteredIds.has(p))
  );
  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : totalCount;
  const nextNode = currentStepIndex >= 0 ? trackNodes[currentStepIndex] : null;
  const allMastered = masteredCount >= totalCount && totalCount > 0;

  return (
    <div className="hidden border-b border-[var(--border)]/40 bg-[var(--secondary)]/15 px-5 py-2 md:block">
      <div className="flex items-center gap-3">
        {/* 双轨道选择卡——单行紧凑 */}
        <div className="flex flex-1 gap-2 min-w-0">
          {graph.tracks.map((tr) => {
            const td = TRACK_DESCRIPTIONS[tr.id];
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
                {td && (
                  <span className="truncate text-[11px] text-[var(--muted-foreground)]">
                    {td.tagline[locale]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 路线图导引 */}
        <div className="hidden md:flex items-center gap-2 shrink-0 rounded-xl border border-[var(--border)]/40 bg-[var(--background)] px-3 py-1.5 min-w-0 max-w-xs">
          <Sparkles className="h-3 w-3 shrink-0 text-[var(--primary)]" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1.5 text-[11px]">
              {allMastered ? (
                <span className="font-semibold text-emerald-600">
                  {locale === "zh" ? "🎉 全部通关！" : "🎉 All mastered!"}
                </span>
              ) : (
                <>
                  <span className="font-semibold whitespace-nowrap">
                    {locale === "zh"
                      ? `第 ${currentStep}/${totalCount} 步`
                      : `Step ${currentStep}/${totalCount}`}
                  </span>
                  <span className="text-[var(--muted-foreground)]">
                    {t_progress(masteredCount, totalCount, pct)}
                  </span>
                </>
              )}
            </div>
            <div className="mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-[var(--secondary)]/50">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: trackColor }}
              />
            </div>
            {nextNode && (
              <div className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)] leading-4">
                {locale === "zh" ? "下一步：" : "Next: "}
                <span className="font-medium text-[var(--foreground)]">
                  {nextNode.title[locale]}
                </span>
              </div>
            )}
            {allMastered && desc && (
              <div className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)] leading-4">
                {desc.outcome[locale]}
              </div>
            )}
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

function MobileProgressCard({
  trackNodes,
  masteredIds,
  masteredCount,
  trackColor,
}: {
  trackNodes: GraphNode[];
  masteredIds: Set<string>;
  masteredCount: number;
  trackColor: string;
}) {
  const totalCount = trackNodes.length;
  const pct = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100);

  // Find current step: first unlocked-but-not-mastered node
  const currentStepIndex = trackNodes.findIndex(
    (n) => !masteredIds.has(n.id) && n.prerequisites.every((p) => masteredIds.has(p)),
  );
  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : totalCount;
  const allMastered = masteredCount >= totalCount && totalCount > 0;

  return (
    <div className="shrink-0 border-b border-[var(--border)]/40 bg-[var(--secondary)]/10 px-4 py-2 md:hidden">
      <div className="flex items-center gap-3">
        {/* Step indicator */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          {allMastered ? (
            <span className="text-xs font-bold text-emerald-600">🎉 全部通关</span>
          ) : (
            <>
              <span className="text-sm font-black whitespace-nowrap">
                第 {currentStep}/{totalCount} 步
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                · {pct}%
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]/60">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: trackColor }}
          />
        </div>

        {/* Badge */}
        <span className="shrink-0 text-xs font-semibold text-[var(--muted-foreground)]">
          {masteredCount}/{totalCount}
        </span>
      </div>
      {!allMastered && currentStepIndex >= 0 && (
        <div className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">
          下一步：<span className="font-medium text-[var(--foreground)]">{trackNodes[currentStepIndex]?.title?.zh || ""}</span>
        </div>
      )}
    </div>
  );
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
  onOpenResource,
}: {
  locale: LocaleKey;
  leftResources: NodeResource[];
  rightResources: NodeResource[];
  rightTitle?: string;
  onOpenResource?: (url: string, title: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-8 z-10 hidden justify-between gap-4 md:flex">
      <ResourceStack
        locale={locale}
        title={locale === "zh" ? "开始前必读" : "Start Here"}
        subtitle={locale === "zh" ? "先校准概念，再进入节点" : "Calibrate the basics before nodes"}
        resources={leftResources}
        align="left"
        onOpenResource={onOpenResource}
      />
      <ResourceStack
        locale={locale}
        title={rightTitle || (locale === "zh" ? "当前路径资料" : "Track Files")}
        subtitle={rightTitle ? (locale === "zh" ? "当前节点的资料" : "Current node files") : (locale === "zh" ? "点击节点后切换资料" : "Click a node to switch files")}
        resources={rightResources}
        align="right"
        onOpenResource={onOpenResource}
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
  onOpenResource,
}: {
  locale: LocaleKey;
  title: string;
  subtitle: string;
  resources: NodeResource[];
  align: "left" | "right";
  onOpenResource?: (url: string, title: string) => void;
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
          <button
            key={`${resource.url}-${resource.title[locale]}`}
            onClick={() => onOpenResource?.(resource.url, resource.title[locale])}
            className="group block w-full text-left"
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
          </button>
        ))}
      </div>
    </section>
  );
}


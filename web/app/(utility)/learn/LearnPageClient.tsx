"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import EcosystemView from "@/components/learn/EcosystemView";
import LearnTopBar from "@/components/learn/LearnTopBar";
import StagePath from "@/components/learn/StagePath";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useAppShell } from "@/context/AppShellContext";
import FloatingAITutor from "@/components/learn/FloatingAITutor";
import InlineResourceReader from "@/components/learn/InlineResourceReader";
import KnowledgeMapFlow from "@/components/learn/KnowledgeMapFlow";
import NodeDetailPanel from "@/components/learn/NodeDetailPanel";
import { NodeMiniRail, NodeMiniStrip } from "@/components/learn/NodeMiniRail";
import { ResourceDesktop, uniqueResources } from "@/components/learn/ResourceDesktop";
import { detectMilestones, MilestoneToast, type MilestoneDef } from "@/components/learn/MilestoneNotification";
import DiagnosticOverlay, {
  getDiagnosticCompleted,
  getDiagnosticResult,
  clearDiagnostic,
} from "@/components/learn/DiagnosticOverlay";
import type { ViewMode } from "@/components/learn/ViewToggle";
import {
  type GraphNode,
  type KnowledgeGraph,
  fetchGraph,
  fetchMyProgress,
  resetProgress,
} from "@/lib/knowledge-graph";
import { updateStreak } from "@/lib/learning-streak";
import { useIsMobile } from "@/lib/useIsMobile";
import type { FlowStageId, FocusDirectionId, FlowStageDef } from "@/lib/ecosystem-data";
import {
  FOCUS_DIRECTIONS,
  FLOW_STAGES,
  STAGE_ORDER,
  classifyNodeToStage,
} from "@/lib/ecosystem-data";
import { recommendNode, computeStageStatuses } from "@/lib/node-recommender";

type LocaleKey = "zh" | "en";

// ─── Helpers ────────────────────────────────────────────────────

/** Validate and coerce a URL stage param to a FlowStageId */
function parseStageParam(raw: string | null): FlowStageId | null {
  if (!raw) return null;
  return STAGE_ORDER.includes(raw as FlowStageId) ? (raw as FlowStageId) : null;
}

/** Validate and coerce a URL focus param to a FocusDirectionId */
function parseFocusParam(raw: string | null): FocusDirectionId | null {
  if (!raw) return null;
  return FOCUS_DIRECTIONS.some((f) => f.id === raw) ? (raw as FocusDirectionId) : null;
}

// ─── Page ───────────────────────────────────────────────────────

export default function LearnPageClient() {
  const { t, i18n } = useTranslation();
  const locale: LocaleKey = i18n.language.startsWith("zh") ? "zh" : "en";
  const { user } = useAuth();
  const { sidebarCollapsed } = useAppShell();
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();

  // ── URL params ──
  const urlStage = parseStageParam(searchParams.get("stage"));
  const urlFocus = parseFocusParam(searchParams.get("focus"));

  // ── Core state ──
  const [currentStage, setCurrentStage] = useState<FlowStageId>(
    urlStage ?? "traffic_entry",
  );
  const [currentFocus, setCurrentFocus] = useState<FocusDirectionId>(
    () => {
      if (urlFocus) return urlFocus;
      if (typeof window === "undefined") return "all";
      const saved = getDiagnosticResult();
      if (saved?.suggested_track === "seller") return "seller_growth";
      if (saved?.suggested_track === "operator") return "platform_ops";
      return "all";
    },
  );

  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [notesByNodeId, setNotesByNodeId] = useState<Map<string, string>>(new Map());
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [previewNode, setPreviewNode] = useState<GraphNode | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ nodeId: string | null; nonce: number }>({
    nodeId: null,
    nonce: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingMilestones, setPendingMilestones] = useState<MilestoneDef[]>([]);
  const [streak] = useState(() => {
    if (typeof window === "undefined") return 0;
    return updateStreak().currentStreak;
  });

  // ── Reader state ──
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [readerTitle, setReaderTitle] = useState("");
  const [readerNodeId, setReaderNodeId] = useState("");
  const [readerStack, setReaderStack] = useState<
    { url: string; title: string; nodeId: string }[]
  >([]);
  const readerUrlRef = useRef(readerUrl);
  const readerTitleRef = useRef(readerTitle);
  const readerNodeIdRef = useRef(readerNodeId);

  useEffect(() => {
    readerUrlRef.current = readerUrl;
    readerTitleRef.current = readerTitle;
    readerNodeIdRef.current = readerNodeId;
  }, [readerUrl, readerTitle, readerNodeId]);

  // ── View mode ──
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "graph";
    return "graph";
  });
  useEffect(() => {
    localStorage.setItem("learn-view-mode", "graph");
  }, [viewMode]);

  // ── Diagnostic state ──
  const [diagnosticCompleted, setDiagnosticCompleted] = useState(() => {
    if (typeof window === "undefined") return true;
    return getDiagnosticCompleted();
  });
  const [diagnosticResult, setDiagnosticResult] = useState<{
    level: string;
    level_label: string;
    suggested_track: string;
    summary: string;
    personalized_nodes: GraphNode[];
  } | null>(() => {
    if (typeof window === "undefined") return null;
    return getDiagnosticResult();
  });
  const [diagnosticMode, setDiagnosticMode] = useState<"none" | "banner" | "subtle" | "overlay">("none");

  // ── Mobile drawer ──
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
      setSelectedNode(null);
      setPreviewNode(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setDrawerDragY(0);
      setDrawerDragging(false);
    });
  }, [selectedNode?.id]);

  // ── Data loading ──
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
        setPendingMilestones((prev) => [...prev, ...newMilestones]);
      }
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }, []);

  // ── Load data ──
  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  const effectiveDiagnosticMode =
    diagnosticMode === "overlay"
      ? "overlay"
      : diagnosticCompleted
        ? "none"
        : urlStage
          ? "subtle"
          : "banner";

  // ── Diagnostic handlers ──
  const handleDiagnosticComplete = useCallback(
    (result: {
      level: string;
      level_label: string;
      suggested_track: string;
      summary: string;
      personalized_nodes: GraphNode[];
    }) => {
      setDiagnosticResult(result);
      setDiagnosticCompleted(true);
      setDiagnosticMode("none");
      // Apply suggested focus
      if (result.suggested_track === "seller") setCurrentFocus("seller_growth");
      else if (result.suggested_track === "operator") setCurrentFocus("platform_ops");
    },
    [],
  );

  const handleSkipDiagnostic = useCallback(() => {
    setDiagnosticCompleted(true);
    setDiagnosticMode("none");
    localStorage.setItem("learn_diagnostic_completed", "true");
  }, []);

  const handleRedoDiagnostic = useCallback(() => {
    clearDiagnostic();
    setDiagnosticCompleted(false);
    setDiagnosticResult(null);
    setDiagnosticMode("overlay");
  }, []);

  // ── Derived data ──

  // Stage definitions lookup
  const stageDefMap = useMemo(() => {
    const map = new Map<FlowStageId, FlowStageDef>();
    for (const s of FLOW_STAGES) map.set(s.id, s);
    return map;
  }, []);

  // Current stage definition
  const currentStageDef = stageDefMap.get(currentStage) ?? null;

  // All nodes in current focus direction
  const focusNodes = useMemo(() => {
    if (!graph) return [] as GraphNode[];
    const focusDef = FOCUS_DIRECTIONS.find((f) => f.id === currentFocus);
    const legacyId = focusDef?.legacyTrackId;
    if (currentFocus === "all" || !legacyId) return graph.nodes;
    return graph.nodes.filter((n) => n.track_ids.includes(legacyId));
  }, [graph, currentFocus]);

  // Nodes belonging to current stage
  const currentStageNodes = useMemo(() => {
    return focusNodes.filter((n) => classifyNodeToStage(n) === currentStage);
  }, [focusNodes, currentStage]);

  // Active track ID for the graph views (map focus → legacy track)
  const activeTrackId = useMemo(() => {
    const focusDef = FOCUS_DIRECTIONS.find((f) => f.id === currentFocus);
    return focusDef?.legacyTrackId || "seller";
  }, [currentFocus]);

  const currentTrackNodes = useMemo(() => {
    if (!graph) return [] as GraphNode[];
    return graph.nodes.filter((n) => n.track_ids.includes(activeTrackId));
  }, [graph, activeTrackId]);

  // Stage statuses for the path display
  const stageStatuses = useMemo(
    () => computeStageStatuses(focusNodes, masteredIds),
    [focusNodes, masteredIds],
  );

  // Recommended node
  const recommendation = useMemo(
    () => recommendNode(currentStageNodes, currentStage, currentFocus, masteredIds),
    [currentStageNodes, currentStage, currentFocus, masteredIds],
  );

  const fallbackFocusNode = useMemo(() => {
    return (
      recommendation.node ??
      currentStageNodes[0] ??
      currentTrackNodes.find((node) => !masteredIds.has(node.id)) ??
      currentTrackNodes[0] ??
      null
    );
  }, [currentStageNodes, currentTrackNodes, masteredIds, recommendation.node]);

  const activeResourceNode = selectedNode ?? previewNode ?? fallbackFocusNode;

  const leftResources = useMemo(() => {
    if (!graph) return [];
    const foundationResources = graph.nodes
      .filter((node) => node.tags?.includes("foundation") || node.id === "antitao-concept")
      .flatMap((node) => node.resources || []);
    return uniqueResources(foundationResources).slice(0, 3);
  }, [graph]);

  const rightResources = useMemo(() => {
    if (!activeResourceNode) return [];
    return uniqueResources(activeResourceNode.resources || []).slice(0, 4);
  }, [activeResourceNode]);

  // Counts
  const masteredCount = useMemo(
    () => focusNodes.filter((n) => masteredIds.has(n.id)).length,
    [focusNodes, masteredIds],
  );

  // Achievement badge conditions
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

  // ── Handlers ──

  const handleMarkMastered = async () => {
    await reload();
  };

  const requestNodeFocus = useCallback((nodeId: string) => {
    setFocusRequest((prev) => ({ nodeId, nonce: prev.nonce + 1 }));
  }, []);

  const previewAndFocusNode = useCallback((node: GraphNode) => {
    setPreviewNode(node);
    requestNodeFocus(node.id);
  }, [requestNodeFocus]);

  const selectAndFocusNode = useCallback((node: GraphNode) => {
    setPreviewNode(node);
    setSelectedNode(node);
    requestNodeFocus(node.id);
  }, [requestNodeFocus]);

  const handleSelectNodeById = (nodeId: string) => {
    const next = graph?.nodes.find((n) => n.id === nodeId);
    if (!next) return;
    selectAndFocusNode(next);
  };

  const handleOpenResource = useCallback((url: string, title: string) => {
    const owner = graph?.nodes.find((n) =>
      (n.resources || []).some((r) => r.url === url),
    );
    setReaderNodeId(owner?.id || "");
    setReaderUrl(url);
    setReaderTitle(title);
    setReaderStack([]);
  }, [graph]);

  const handleNavigateToLinkedDoc = useCallback(
    (url: string, title: string, nodeId: string) => {
      const currentUrl = readerUrlRef.current;
      if (currentUrl) {
        setReaderStack((prev) => [
          ...prev,
          { url: currentUrl, title: readerTitleRef.current, nodeId: readerNodeIdRef.current },
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

  const handleStageSelect = useCallback((stage: FlowStageId) => {
    setCurrentStage(stage);
    setSelectedNode(null);
    setPreviewNode(null);
    setFocusRequest((prev) => ({ nodeId: null, nonce: prev.nonce + 1 }));
  }, []);

  const handleFocusChange = useCallback((focus: FocusDirectionId) => {
    setCurrentFocus(focus);
    setSelectedNode(null);
    setPreviewNode(null);
    setFocusRequest((prev) => ({ nodeId: null, nonce: prev.nonce + 1 }));
  }, []);

  const handleReset = async () => {
    if (!user) return;
    if (!confirm(t("learn.confirmReset"))) return;
    await resetProgress();
    await reload();
    setSelectedNode(null);
  };

  // ── Loading state ──
  if (loading && !graph) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("learn.loading")}
      </div>
    );
  }

  // ── Diagnostic overlay (full screen, blocking) ──
  if (effectiveDiagnosticMode === "overlay") {
    return (
      <DiagnosticOverlay
        onComplete={handleDiagnosticComplete}
        onSkip={handleSkipDiagnostic}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <LearnTopBar
        currentStage={currentStage}
        currentFocus={currentFocus}
        onFocusChange={handleFocusChange}
        masteredCount={masteredCount}
        totalCount={focusNodes.length}
        streak={streak}
        onRediagnose={handleRedoDiagnostic}
        onReset={handleReset}
        diagnosticMode={effectiveDiagnosticMode}
        diagnosticLevelLabel={diagnosticResult?.level_label}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        locale={locale}
        isLoggedIn={!!user}
        isMobile={isMobile}
        foundationMastered={badgeConditions.foundationMastered}
        sellerTrackMastered={badgeConditions.sellerTrackMastered}
        operatorTrackMastered={badgeConditions.operatorTrackMastered}
        allMastered={badgeConditions.allMastered}
        notesNodeCount={badgeConditions.notesNodeCount}
      />

      {/* Stage path */}
      <StagePath
        currentStage={currentStage}
        stageStatuses={stageStatuses}
        onStageSelect={handleStageSelect}
        locale={locale}
      />

      {/* Diagnostic banner / subtle hint */}
      {effectiveDiagnosticMode === "banner" && (
        <div className="shrink-0 border-b border-amber-200/60 bg-amber-50/70 px-5 py-2.5 dark:border-amber-500/20 dark:bg-amber-950/30">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              在开始学习之前，让 AI 导师了解你的水平，为你推荐最适合的学习路线（约1-2分钟）
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setDiagnosticMode("overlay")}
                className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-amber-400 transition-colors"
              >
                开始诊断
              </button>
              <button
                onClick={handleSkipDiagnostic}
                className="text-[11px] text-amber-600 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400"
              >
                跳过
              </button>
            </div>
          </div>
        </div>
      )}

      {effectiveDiagnosticMode === "subtle" && (
        <div className="shrink-0 border-b border-amber-100/40 bg-amber-50/30 px-5 py-1.5 dark:bg-amber-950/10">
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70">
            个性化学习路线可提升学习效率——
            <button
              onClick={() => setDiagnosticMode("overlay")}
              className="ml-1 underline underline-offset-2 font-semibold hover:text-amber-900 dark:hover:text-amber-100"
            >
              花1分钟完成诊断
            </button>
          </p>
        </div>
      )}

      {error && (
        <div className="border-b border-red-300 bg-red-50 px-5 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="relative flex min-h-0 flex-1">
        {viewMode === "panel" ? (
          <>
            {/* Main: Learning panel */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {recommendation.node ? (
                <NodeDetailPanel
                  node={recommendation.node}
                  locale={locale}
                  isMastered={masteredIds.has(recommendation.node.id)}
                  isLoggedIn={!!user}
                  isPremiumUser={!!user?.is_premium}
                  initialNotes={notesByNodeId.get(recommendation.node.id) || ""}
                  onClose={() => setSelectedNode(null)}
                  onMarkMastered={handleMarkMastered}
                  onSelectNodeById={handleSelectNodeById}
                  hasPrev={false}
                  hasNext={false}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center p-8">
                  <div className="text-center max-w-md">
                    <div className="text-4xl mb-4">🎯</div>
                    <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">
                      {currentStageDef?.title[locale] ?? currentStage}
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                      {currentStageDef?.essence[locale] ??
                        "该阶段暂无可用学习节点，请切换关注方向或联系管理员添加内容。"}
                    </p>
                    <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                      {recommendation.reason}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Aside: Stage node list */}
            <aside className="hidden w-[320px] shrink-0 flex-col border-l border-[var(--border)]/40 bg-[var(--background)]/60 md:flex">
              <div className="border-b border-[var(--border)]/30 px-4 py-3">
                <div className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                  {currentStageDef?.title[locale] ?? currentStage} 学习节点
                </div>
                <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  {currentStageNodes.length} 个节点 · {masteredCount} 已掌握
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {currentStageNodes.map((node) => {
                  const isMastered = masteredIds.has(node.id);
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => {
                        setPreviewNode(node);
                        setSelectedNode(node);
                      }}
                      className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left transition-all ${
                        isSelected
                          ? "border-2 border-[var(--primary)]/40 bg-[var(--primary)]/10"
                          : "border-2 border-transparent hover:bg-[var(--secondary)]/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            isMastered ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        <span className="text-xs font-semibold text-[var(--foreground)] line-clamp-1">
                          {node.title[locale]}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                        <span>{node.estimated_minutes ?? "?"} 分钟</span>
                        {(node.resources?.length ?? 0) > 0 && (
                          <span>· {node.resources!.length} 资源</span>
                        )}
                        {isMastered && (
                          <span className="text-emerald-500 font-semibold">· 已掌握</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Recommendation info */}
              {recommendation.node && (
                <div className="border-t border-[var(--border)]/30 px-4 py-3">
                  <div className="text-[10px] text-[var(--muted-foreground)] leading-relaxed">
                    推荐理由: {recommendation.reason}
                  </div>
                </div>
              )}
            </aside>
          </>
        ) : viewMode === "ecosystem" ? (
          /* Ecosystem view */
          <div className="relative min-w-0 flex-1">
            {graph && (
              <EcosystemView
                graph={graph}
                trackId={activeTrackId}
                masteredIds={masteredIds}
                selectedNodeId={selectedNode?.id || null}
                locale={locale}
                onSelectNode={(node) => {
                  setPreviewNode(node);
                  setSelectedNode(node);
                  requestNodeFocus(node.id);
                }}
              />
            )}
            {/* Mobile: selected node drawer */}
            {isMobile && selectedNode && (
              <div
                className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] border-t border-[var(--border)]/60 bg-[var(--background)] shadow-[0_-24px_80px_rgba(15,23,42,0.22)]"
                style={{
                  height: "92dvh",
                  transform: drawerDragY ? `translateY(${Math.max(0, drawerDragY)}px)` : undefined,
                  transition: drawerDragging ? "none" : "height 0.3s ease, transform 0.3s ease",
                }}
              >
                <div
                  className="flex shrink-0 justify-center py-2"
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
                  isPremiumUser={!!user?.is_premium}
                  initialNotes={notesByNodeId.get(selectedNode.id) || ""}
                  onClose={() => setSelectedNode(null)}
                  onMarkMastered={handleMarkMastered}
                  onSelectNodeById={handleSelectNodeById}
                  hasPrev={false}
                  hasNext={false}
                />
              </div>
            )}
          </div>
        ) : (
          /* Graph view */
          <div className="relative min-w-0 flex-1">
            {graph && (
              <>
                <KnowledgeMapFlow
                  graph={graph}
                  trackId={activeTrackId}
                  masteredIds={masteredIds}
                  selectedNodeId={selectedNode?.id || null}
                  focusNodeId={focusRequest.nodeId ?? fallbackFocusNode?.id ?? null}
                  focusVersion={focusRequest.nonce}
                  openOnSingleTap={isMobile}
                  compact={isMobile}
                  onPreviewNode={previewAndFocusNode}
                  onSelectNode={selectAndFocusNode}
                  locale={locale}
                />
                {!selectedNode && (
                  <ResourceDesktop
                    locale={locale}
                    leftResources={leftResources}
                    rightResources={rightResources}
                    rightTitle={activeResourceNode?.title[locale]}
                    isPremiumUser={!!user?.is_premium}
                    onOpenResource={handleOpenResource}
                  />
                )}
                {!isMobile && selectedNode && (
                  <NodeMiniRail
                    nodes={currentTrackNodes}
                    selectedNodeId={selectedNode.id}
                    masteredIds={masteredIds}
                    locale={locale}
                    onSelect={selectAndFocusNode}
                  />
                )}
              </>
            )}
            {/* Mobile: selected node drawer */}
            {isMobile && selectedNode && (
              <div
                className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] border-t border-[var(--border)]/60 bg-[var(--background)] shadow-[0_-24px_80px_rgba(15,23,42,0.22)]"
                style={{
                  height: "92dvh",
                  transform: drawerDragY ? `translateY(${Math.max(0, drawerDragY)}px)` : undefined,
                  transition: drawerDragging ? "none" : "height 0.3s ease, transform 0.3s ease",
                }}
              >
                <div
                  className="flex shrink-0 justify-center py-2"
                  onTouchStart={onDrawerTouchStart}
                  onTouchMove={onDrawerTouchMove}
                  onTouchEnd={onDrawerTouchEnd}
                >
                  <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
                </div>
                <NodeMiniStrip
                  nodes={currentTrackNodes}
                  selectedNodeId={selectedNode.id}
                  masteredIds={masteredIds}
                  locale={locale}
                  onSelect={selectAndFocusNode}
                />
                <NodeDetailPanel
                  node={selectedNode}
                  locale={locale}
                  isMastered={masteredIds.has(selectedNode.id)}
                  isLoggedIn={!!user}
                  isPremiumUser={!!user?.is_premium}
                  initialNotes={notesByNodeId.get(selectedNode.id) || ""}
                  onClose={() => setSelectedNode(null)}
                  onMarkMastered={handleMarkMastered}
                  onSelectNodeById={handleSelectNodeById}
                  hasPrev={false}
                  hasNext={false}
                />
              </div>
            )}
          </div>
        )}

        {/* Desktop detail panel (ecosystem & graph views) */}
        {!isMobile && viewMode !== "panel" && selectedNode && (
          <div className="h-full w-[480px] shrink-0 border-l border-[var(--border)]/60 bg-[var(--background)]">
            <NodeDetailPanel
              node={selectedNode}
              locale={locale}
              isMastered={masteredIds.has(selectedNode.id)}
              isLoggedIn={!!user}
              isPremiumUser={!!user?.is_premium}
              initialNotes={notesByNodeId.get(selectedNode.id) || ""}
              onClose={() => setSelectedNode(null)}
              onMarkMastered={handleMarkMastered}
              onSelectNodeById={handleSelectNodeById}
              hasPrev={false}
              hasNext={false}
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

      {/* Floating AI tutor */}
      {graph && (
        <FloatingAITutor
          trackLabel={currentStageDef?.title[locale] ?? "学习"}
          leftOffsetPx={isMobile ? 0 : sidebarCollapsed ? 60 : 220}
          rightOffsetPx={isMobile ? 0 : selectedNode && viewMode !== "panel" ? 480 : viewMode === "panel" ? 320 : 0}
          isLoggedIn={!!user}
          disabled={!!selectedNode}
        />
      )}
    </div>
  );
}

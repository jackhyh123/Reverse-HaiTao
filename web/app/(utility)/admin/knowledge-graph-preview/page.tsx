"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, RotateCcw, UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import KnowledgeMapFlow from "@/components/learn/KnowledgeMapFlow";
import NodeDetailPanel from "@/components/learn/NodeDetailPanel";
import { apiUrl } from "@/lib/api";
import {
  type GraphNode,
  type KnowledgeGraph,
  fetchGraph,
  fetchUserProgress,
} from "@/lib/knowledge-graph";

type LocaleKey = "zh" | "en";

interface MemberRow {
  email: string;
  created_at: number;
  last_login_at: number;
  login_count: number;
  status: string;
}

export default function AdminKnowledgeGraphPreviewPage() {
  const { t, i18n } = useTranslation();
  const locale: LocaleKey = i18n.language.startsWith("zh") ? "zh" : "en";
  const isZh = locale === "zh";

  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string>("");
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [trackId, setTrackId] = useState<string>("seller");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(false);
  const [error, setError] = useState("");

  const loadGraph = useCallback(async () => {
    try {
      const g = await fetchGraph();
      setGraph(g);
      if (!g.tracks.find((t) => t.id === trackId)) {
        setTrackId(g.tracks[0]?.id || "seller");
      }
    } catch (e) {
      setError(String(e));
    }
  }, [trackId]);

  const loadMembers = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/v1/admin/members"), {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = (await r.json()) as { members: MemberRow[] };
      setMembers(data.members || []);
    } catch {
      // non-critical
    }
  }, []);

  const loadProgress = useCallback(async (email: string) => {
    if (!email) {
      setMasteredIds(new Set());
      return;
    }
    setProgressLoading(true);
    try {
      const p = await fetchUserProgress(email);
      setMasteredIds(new Set(p.mastered_node_ids));
    } catch {
      setMasteredIds(new Set());
    } finally {
      setProgressLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadGraph(), loadMembers()]).finally(() => setLoading(false));
  }, [loadGraph, loadMembers]);

  useEffect(() => {
    loadProgress(selectedEmail);
  }, [selectedEmail, loadProgress]);

  const trackNodes = useMemo(
    () => (graph ? graph.nodes.filter((n) => n.track_ids.includes(trackId)) : []),
    [graph, trackId],
  );

  const masteredCount = useMemo(
    () => trackNodes.filter((n) => masteredIds.has(n.id)).length,
    [trackNodes, masteredIds],
  );

  const handleSelectNodeById = (nodeId: string) => {
    const next = graph?.nodes.find((n) => n.id === nodeId);
    if (!next) return;
    if (!next.track_ids.includes(trackId)) {
      setTrackId(next.track_ids[0] || trackId);
    }
    setSelectedNode(next);
  };

  if (loading || !graph) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isZh ? "正在加载知识图谱..." : "Loading knowledge graph..."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[var(--border)]/40 bg-[var(--background)] px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-400/20 dark:text-amber-200">
              <Eye className="h-3.5 w-3.5" />
              {isZh ? "用户视角预览" : "User View Preview"}
            </div>
            <h1 className="truncate text-base font-semibold">
              {isZh ? "知识图谱（用户视角）" : "Knowledge Graph (User View)"}
            </h1>
          </div>

          {/* User selector + stats */}
          <div className="flex items-center gap-3">
            <div className="text-xs text-[var(--muted-foreground)]">
              {selectedEmail
                ? `${masteredCount}/${trackNodes.length} ${isZh ? "已掌握" : "mastered"}`
                : isZh
                ? "未选择用户"
                : "No user selected"}
            </div>
            <select
              value={selectedEmail}
              onChange={(e) => {
                setSelectedEmail(e.target.value);
                setSelectedNode(null);
              }}
              className="rounded-xl border border-[var(--border)]/70 bg-[var(--background)] px-3 py-1.5 text-sm outline-none max-w-[260px]"
            >
              <option value="">
                {isZh ? "-- 选择要预览的用户 --" : "-- Select user to preview --"}
              </option>
              {members.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.email}
                </option>
              ))}
            </select>
            {progressLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
            )}
          </div>
        </div>

        {/* Track tabs */}
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {graph.tracks.map((tr) => (
            <button
              key={tr.id}
              onClick={() => {
                setTrackId(tr.id);
                setSelectedNode(null);
              }}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
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

      {/* Main layout */}
      <div className="relative flex min-h-0 flex-1">
        {/* Map */}
        <div className={`relative min-w-0 transition-all duration-300 flex-1`}>
          <KnowledgeMapFlow
            graph={graph}
            trackId={trackId}
            masteredIds={masteredIds}
            selectedNodeId={selectedNode?.id || null}
            onSelectNode={(node) => setSelectedNode(node)}
            locale={locale}
          />
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="w-[480px] shrink-0 overflow-y-auto border-l border-[var(--border)]/60 bg-[var(--background)]">
            <NodeDetailPanel
              node={selectedNode}
              locale={locale}
              isMastered={masteredIds.has(selectedNode.id)}
              isLoggedIn={!!selectedEmail}
              isPremiumUser={true /* admin preview: see all resources */}
              onClose={() => setSelectedNode(null)}
              onMarkMastered={async () => {
                // Preview mode: don't actually modify progress
              }}
              onSelectNodeById={handleSelectNodeById}
            />
          </div>
        )}
      </div>

      {/* Empty state when no user selected */}
      {!selectedNode && !selectedEmail && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-3xl border border-dashed border-[var(--border)]/70 bg-[var(--background)]/80 backdrop-blur-sm px-8 py-6 text-center pointer-events-auto">
            <UserIcon className="mx-auto mb-3 h-8 w-8 text-[var(--muted-foreground)]" />
            <p className="text-sm font-medium text-[var(--foreground)]">
              {isZh ? "选择一个用户来预览知识图谱" : "Select a user to preview their knowledge graph view"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {isZh
                ? "从上方下拉菜单中选择一名用户，即可查看他/她看到的学习地图"
                : "Pick a user from the dropdown above to see the learning map from their perspective"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

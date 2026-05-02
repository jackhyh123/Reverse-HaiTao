"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  DatabaseZap,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

interface SyncMatch {
  node_id: string;
  node_title: string;
  score: number;
  reason: string;
}

interface SyncSuggestion {
  page_title: string;
  section: string;
  url: string;
  source_path?: string | null;
  matches: SyncMatch[];
}

interface PublishedPage {
  title: string;
  section: string;
  url: string;
  source_path?: string | null;
  status: "created" | "existing" | string;
}

interface SyncReport {
  synced_at: string;
  root: { title: string; url: string; node_token: string };
  created_count: number;
  existing_count: number;
  pages: PublishedPage[];
  suggestions: SyncSuggestion[];
}

interface SyncStatus {
  configured: boolean;
  wiki_root: string;
  wiki_file_count: number;
  seed_dir: string;
  seed_page_count: number;
  root_node_token: string;
  last_report: SyncReport | null;
}

function timeText(value?: string) {
  if (!value) return "暂无";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminKnowledgeSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [adoptedKeys, setAdoptedKeys] = useState<Set<string>>(new Set());
  const [adopting, setAdopting] = useState<string | null>(null); // key being adopted, or "all"

  const report = status?.last_report || null;
  const createdPages = useMemo(
    () => (report?.pages || []).filter((page) => page.status === "created"),
    [report],
  );

  const refresh = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/v1/admin/feishu-wiki-sync"), {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setStatus((await res.json()) as SyncStatus);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const runSync = async () => {
    setError("");
    setSyncing(true);
    try {
      const res = await fetch(apiUrl("/api/v1/admin/feishu-wiki-sync"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const nextReport = (await res.json()) as SyncReport;
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              seed_page_count: nextReport.pages.length,
              last_report: nextReport,
            }
          : prev,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const adoptOne = async (nodeId: string, url: string, title: string, section: string, pageTitle: string) => {
    const key = `${nodeId}|${url}`;
    setAdopting(key);
    try {
      const res = await fetch(apiUrl("/api/v1/knowledge-graph/adopt-resource"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          node_id: nodeId,
          url,
          title: { zh: title, en: title },
          type: "feishu_doc",
          section,
          page_title: pageTitle,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setAdoptedKeys((prev) => new Set(prev).add(key));
    } catch (e) {
      setError(`采纳失败: ${e}`);
    } finally {
      setAdopting(null);
    }
  };

  const adoptAll = async () => {
    if (!report?.suggestions?.length) return;
    setAdopting("all");
    try {
      const adoptions = report.suggestions.flatMap((item) =>
        item.matches.map((m) => ({
          node_id: m.node_id,
          url: item.url,
          title: { zh: item.page_title, en: item.page_title },
          type: "feishu_doc" as const,
          section: item.section,
          page_title: item.page_title,
        })),
      );
      const res = await fetch(apiUrl("/api/v1/knowledge-graph/adopt-resources-batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ adoptions }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = await res.json();
      const keys = new Set(adoptedKeys);
      for (const a of data.adopted || []) {
        keys.add(`${a.node_id}|${a.resource.url}`);
      }
      setAdoptedKeys(keys);
    } catch (e) {
      setError(`批量采纳失败: ${e}`);
    } finally {
      setAdopting(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            管理后台 / 知识来源同步
          </div>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em]">
            本地知识库同步到飞书
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            一键读取本地 wiki，生成飞书知识库页面，并给出“这些云文档应该挂到哪些知识图谱节点”的资源建议。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={loading || syncing}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-2 text-sm font-medium hover:bg-[var(--secondary)]/50 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
          <button
            onClick={runSync}
            disabled={loading || syncing || !status?.configured}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
            {syncing ? "正在同步..." : "一键同步到飞书"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="飞书配置" value={status?.configured ? "已配置" : "未配置"} tone={status?.configured ? "ok" : "warn"} />
        <StatCard title="本地 wiki 文件" value={loading ? "..." : String(status?.wiki_file_count ?? 0)} />
        <StatCard title="飞书页面包" value={loading ? "..." : String(status?.seed_page_count ?? 0)} />
        <StatCard title="上次新增云文档" value={String(report?.created_count ?? 0)} tone={report?.created_count ? "ok" : "muted"} />
      </div>

      <div className="mt-4 rounded-3xl border border-[var(--border)]/70 bg-[var(--background)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">同步目标</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              本地来源：{status?.wiki_root || "加载中..."}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              飞书根节点：{report?.root?.title || status?.root_node_token || "加载中..."}
            </p>
          </div>
          {report?.root?.url && (
            <Link
              href={report.root.url}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 px-4 py-2 text-sm font-medium hover:bg-[var(--secondary)]/50"
            >
              打开飞书知识库
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="mt-4 rounded-2xl bg-[var(--secondary)]/35 p-4 text-sm text-[var(--muted-foreground)]">
          最近同步：{timeText(report?.synced_at)} · 已存在 {report?.existing_count ?? 0} 个页面 · 新建 {report?.created_count ?? 0} 个页面
        </div>
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.25fr]">
        <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--background)] p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">本次新增云文档</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            只显示本次真正新建的飞书文档；已存在的不会重复写入。
          </p>
          <div className="mt-4 space-y-3">
            {createdPages.length ? (
              createdPages.map((page) => (
                <Link
                  key={`${page.section}-${page.title}`}
                  href={page.url}
                  target="_blank"
                  className="block rounded-2xl border border-[var(--border)]/60 p-4 transition hover:border-[var(--primary)]/50 hover:bg-[var(--secondary)]/30"
                >
                  <div className="text-xs text-[var(--muted-foreground)]">{page.section}</div>
                  <div className="mt-1 font-semibold">{page.title}</div>
                  {page.source_path && (
                    <div className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                      来源：{page.source_path}
                    </div>
                  )}
                </Link>
              ))
            ) : (
              <EmptyState text="暂无新增。可能是这些页面已经创建过，本次同步只做了复查。" />
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--background)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">建议添加到知识图谱资源</h2>
            </div>
            {report?.suggestions?.length ? (
              <button
                onClick={adoptAll}
                disabled={adopting === "all"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 transition"
              >
                {adopting === "all" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                一键全部采纳
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            系统根据页面标题、目录和知识图谱节点内容自动推荐。点击「采纳」将文档加入对应节点的学习资源。
          </p>
          <div className="mt-4 space-y-4">
            {report?.suggestions?.length ? (
              report.suggestions.slice(0, 30).map((item) => (
                <div
                  key={`${item.section}-${item.page_title}`}
                  className="rounded-2xl border border-[var(--border)]/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">{item.section}</div>
                      <Link href={item.url} target="_blank" className="font-semibold hover:underline">
                        {item.page_title}
                      </Link>
                    </div>
                    <span className="rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                      {item.matches.length} 个建议
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {item.matches.map((match) => {
                      const key = `${match.node_id}|${item.url}`;
                      const isAdopted = adoptedKeys.has(key);
                      const isThisAdopting = adopting === key;
                      return (
                        <div
                          key={`${item.page_title}-${match.node_id}`}
                          className="rounded-xl bg-[var(--secondary)]/35 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{match.node_title}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[var(--muted-foreground)]">
                                匹配度 {match.score}
                              </span>
                              <button
                                onClick={() =>
                                  adoptOne(match.node_id, item.url, item.page_title, item.section, item.page_title)
                                }
                                disabled={isAdopted || !!adopting}
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium transition ${
                                  isAdopted
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                    : "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20"
                                } disabled:opacity-50`}
                              >
                                {isAdopted ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" /> 已采纳
                                  </>
                                ) : isThisAdopting ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" /> 采纳中
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3 w-3" /> 采纳
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                            {match.reason}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="暂无推荐。点击一键同步后，这里会生成推荐列表。" />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  tone = "muted",
}: {
  title: string;
  value: string;
  tone?: "ok" | "warn" | "muted";
}) {
  const iconColor =
    tone === "ok" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : "text-[var(--primary)]";
  return (
    <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--background)] p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <CheckCircle2 className={`h-4 w-4 ${iconColor}`} />
        {title}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.02em]">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)]/70 p-6 text-center text-sm text-[var(--muted-foreground)]">
      {text}
    </div>
  );
}

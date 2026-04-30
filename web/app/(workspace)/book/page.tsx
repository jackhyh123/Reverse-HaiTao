"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  fetchGraph,
  fetchMyProgress,
  type GraphNode,
  type KnowledgeGraph,
  type NodeResource,
  type ProgressRow,
} from "@/lib/knowledge-graph";

type LocaleKey = "zh" | "en";

interface TutorMessage {
  role: "assistant" | "user";
  content: string;
  mastery_signal?: boolean;
}

interface ManualNode {
  node: GraphNode;
  progress?: ProgressRow;
  messages: TutorMessage[];
  lastInsight: string;
}

const locale: LocaleKey = "zh";

export default function BookPage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [messagesByNode, setMessagesByNode] = useState<Record<string, TutorMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [nextGraph, nextProgress] = await Promise.all([
          fetchGraph(),
          fetchMyProgress().catch(() => ({ progress: [], mastered_node_ids: [] })),
        ]);
        if (cancelled) return;
        setGraph(nextGraph);
        setProgressRows(nextProgress.progress || []);

        const stored: Record<string, TutorMessage[]> = {};
        for (const node of nextGraph.nodes) {
          stored[node.id] = readTutorMessages(node.id);
        }
        setMessagesByNode(stored);
      } catch (e) {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const progressByNode = useMemo(() => {
    const map = new Map<string, ProgressRow>();
    for (const row of progressRows) map.set(row.node_id, row);
    return map;
  }, [progressRows]);

  const manualNodes = useMemo<ManualNode[]>(() => {
    if (!graph) return [];
    return graph.nodes.map((node) => {
      const messages = messagesByNode[node.id] || [];
      return {
        node,
        progress: progressByNode.get(node.id),
        messages,
        lastInsight: extractLastInsight(messages),
      };
    });
  }, [graph, messagesByNode, progressByNode]);

  const masteredNodes = manualNodes.filter((item) => item.progress?.status === "mastered");
  const activeNodes = manualNodes.filter(
    (item) => item.messages.length > 0 && item.progress?.status !== "mastered",
  );
  const nextNodes = manualNodes
    .filter((item) => item.messages.length === 0 && item.progress?.status !== "mastered")
    .slice(0, 3);
  const resourceCount = uniqueResources(
    masteredNodes.flatMap((item) => item.node.resources || []),
  ).length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在整理你的通关手册...
      </div>
    );
  }

  return (
    <main className="h-full overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-8 md:py-8">
        <section className="overflow-hidden rounded-[28px] border border-[var(--border)]/60 bg-[var(--card)]/80 shadow-sm">
          <div className="border-b border-[var(--border)]/50 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),transparent_45%)] p-5 md:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--background)]/70 px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
              <BookOpenCheck className="h-3.5 w-3.5 text-[var(--primary)]" />
              通关后的随身小抄
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] md:text-5xl">
              把你真正学过的内容，沉淀成一本可复习的通关手册。
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)] md:text-base">
              知识图谱负责告诉你路径，AI 导师负责解释和测试；这里负责把你通过的节点、聊过的重点和对应资料收起来，方便以后快速复习。
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard label="已通关节点" value={`${masteredNodes.length}`} />
              <MetricCard label="形成中的笔记" value={`${activeNodes.length}`} />
              <MetricCard label="可复习资料" value={`${resourceCount}`} />
            </div>
          </div>

          {error && (
            <div className="border-b border-red-300 bg-red-50 px-5 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-4 md:p-6">
              <SectionTitle
                icon={<CheckCircle2 className="h-4 w-4" />}
                title="已通关小抄"
                subtitle="只有通过测试或保存过学习进度的节点，才会沉淀到这里。"
              />

              {masteredNodes.length === 0 ? (
                <EmptyManual />
              ) : (
                <div className="mt-4 grid gap-4">
                  {masteredNodes.map((item) => (
                    <ManualCard key={item.node.id} item={item} />
                  ))}
                </div>
              )}

              {activeNodes.length > 0 && (
                <div className="mt-8">
                  <SectionTitle
                    icon={<MessageSquareText className="h-4 w-4" />}
                    title="正在形成的小抄"
                    subtitle="你和 AI 导师聊过，但还没有通关的节点，会先放在这里。"
                  />
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {activeNodes.map((item) => (
                      <DraftCard key={item.node.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="border-t border-[var(--border)]/50 bg-[var(--secondary)]/15 p-4 md:p-6 lg:border-l lg:border-t-0">
              <SectionTitle
                icon={<Sparkles className="h-4 w-4" />}
                title="怎么使用这本手册"
                subtitle="它不是知识库，而是你的个人复习层。"
              />
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted-foreground)]">
                <GuideStep title="先去首页学节点" text="点开知识图谱节点，让 AI 导师讲清楚，再用自己的话回答。" />
                <GuideStep title="通过测试后沉淀" text="通关成功的节点会成为稳定小抄，后续可以直接复习掌握标准和资料。" />
                <GuideStep title="没通关也不丢" text="只要你和 AI 导师聊过，这里会保留形成中的笔记，提醒你回去补完。" />
              </div>

              <div className="mt-6 rounded-3xl border border-[var(--border)]/60 bg-[var(--background)]/70 p-4">
                <div className="text-sm font-black">下一步建议</div>
                <div className="mt-3 space-y-2">
                  {nextNodes.length > 0 ? (
                    nextNodes.map((item) => (
                      <Link
                        key={item.node.id}
                        href="/learn"
                        className="group flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)]/50 bg-[var(--card)] px-3 py-2 text-sm hover:border-[var(--primary)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {item.node.title[locale]}
                          </span>
                          <span className="line-clamp-1 text-xs text-[var(--muted-foreground)]">
                            {item.node.mastery_criteria[locale]}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]" />
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-[var(--secondary)]/40 p-3 text-sm text-[var(--muted-foreground)]">
                      你已经有不少学习痕迹了，可以回首页继续挑战新的节点。
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--background)]/72 p-4">
      <div className="text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)]">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-black tracking-[-0.02em]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyManual() {
  return (
    <div className="mt-4 rounded-[28px] border border-dashed border-[var(--border)]/70 bg-[var(--secondary)]/20 p-6 text-center">
      <BookOpenCheck className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" />
      <h3 className="mt-3 text-base font-black">这本手册还没开始写</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
        回到首页，点开一个知识节点，和 AI 导师聊一轮并完成通关测试。通过后，这里会自动变成你的复习小抄。
      </p>
      <Link
        href="/learn"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
      >
        去首页学习
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ManualCard({ item }: { item: ManualNode }) {
  return (
    <article className="rounded-[26px] border border-[var(--border)]/60 bg-[var(--background)]/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-600">
            已通关
          </div>
          <h3 className="mt-1 text-xl font-black tracking-[-0.03em]">
            {item.node.title[locale]}
          </h3>
        </div>
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
      </div>
      <div className="mt-3 rounded-2xl bg-[var(--secondary)]/35 p-3">
        <div className="text-xs font-black text-[var(--muted-foreground)]">掌握标准</div>
        <p className="mt-1 text-sm leading-6">{item.node.mastery_criteria[locale]}</p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)]/50 p-3">
          <div className="text-xs font-black text-[var(--muted-foreground)]">我的理解</div>
          <p className="mt-1 line-clamp-4 text-sm leading-6">
            {item.progress?.notes || item.lastInsight || item.node.summary[locale]}
          </p>
        </div>
        <ResourceList resources={(item.node.resources || []).slice(0, 3)} />
      </div>
    </article>
  );
}

function DraftCard({ item }: { item: ManualNode }) {
  return (
    <article className="rounded-[24px] border border-[var(--border)]/60 bg-[var(--background)]/70 p-4">
      <div className="flex items-start gap-2">
        <MessageSquareText className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" />
        <div className="min-w-0">
          <h3 className="truncate text-base font-black">{item.node.title[locale]}</h3>
          <p className="mt-1 line-clamp-3 text-sm leading-6 text-[var(--muted-foreground)]">
            {item.lastInsight || "已经有对话记录，建议回到节点继续讲清楚并完成通关测试。"}
          </p>
          <Link
            href="/learn"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]"
          >
            回首页继续
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function ResourceList({ resources }: { resources: NodeResource[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-black text-[var(--muted-foreground)]">
        <FileText className="h-3.5 w-3.5" />
        复习资料
      </div>
      <div className="mt-2 space-y-1.5">
        {resources.length > 0 ? (
          resources.map((resource) => (
            <a
              key={resource.url}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl bg-[var(--secondary)]/30 px-2.5 py-2 text-sm hover:bg-[var(--secondary)]/55"
            >
              <span className="min-w-0 truncate">{resource.title[locale]}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            </a>
          ))
        ) : (
          <div className="rounded-xl bg-[var(--secondary)]/30 px-2.5 py-2 text-sm text-[var(--muted-foreground)]">
            暂无资料，先看节点讲解。
          </div>
        )}
      </div>
    </div>
  );
}

function GuideStep({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/50 bg-[var(--background)]/60 p-3">
      <div className="font-black text-[var(--foreground)]">{title}</div>
      <div className="mt-1">{text}</div>
    </div>
  );
}

function readTutorMessages(nodeId: string): TutorMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`learn_node_tutor_messages_${nodeId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TutorMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractLastInsight(messages: TutorMessage[]): string {
  const assistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.trim());
  return assistant?.content.replace(/\[MASTERY_SIGNAL\]/g, "").trim() || "";
}

function uniqueResources(resources: NodeResource[]): NodeResource[] {
  const seen = new Set<string>();
  return resources.filter((resource) => {
    const key = resource.url || resource.title[locale];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

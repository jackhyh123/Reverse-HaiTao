"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  checkMastery,
  type GraphNode,
  type MasteryCheckResult,
  type NodeResource,
  tutor,
  upsertProgress,
} from "@/lib/knowledge-graph";
import { loadFromStorage, saveToStorage } from "@/lib/persistence";

type LocaleKey = "zh" | "en";
type Tab = "resources" | "tutor";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  mastery_signal?: boolean;
}

interface NodeDetailPanelProps {
  node: GraphNode;
  locale: LocaleKey;
  isMastered: boolean;
  isLoggedIn: boolean;
  onClose: () => void;
  onMarkMastered: () => Promise<void>;
  onSelectNodeById?: (nodeId: string) => void;
}

const tutorStorageKey = (nodeId: string) => `learn_node_tutor_messages_${nodeId}`;

export default function NodeDetailPanel({
  node,
  locale,
  isMastered,
  isLoggedIn,
  onClose,
  onMarkMastered,
  onSelectNodeById,
}: NodeDetailPanelProps) {
  const hasResources = (node.resources?.length || 0) > 0;
  const [tab, setTab] = useState<Tab>(hasResources ? "resources" : "tutor");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [tutorOpened, setTutorOpened] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [checkResult, setCheckResult] = useState<MasteryCheckResult | null>(null);
  const [masteryCardDismissed, setMasteryCardDismissed] = useState(false);
  const loadedNodeIdRef = useRef<string | null>(null);
  const skipNextSaveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reset chat when switching node
  useEffect(() => {
    const savedMessages = loadFromStorage<ChatMessage[]>(
      tutorStorageKey(node.id),
      [],
    );
    loadedNodeIdRef.current = node.id;
    skipNextSaveRef.current = true;
    setMessages(savedMessages);
    setTutorOpened(savedMessages.length > 0);
    setCheckResult(null);
    setCheckError("");
    setMasteryCardDismissed(false);
    setTab(savedMessages.length > 0 ? "tutor" : hasResources ? "resources" : "tutor");
  }, [node.id, hasResources]);

  useEffect(() => {
    if (loadedNodeIdRef.current !== node.id) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveToStorage(tutorStorageKey(node.id), messages.slice(-80));
  }, [messages, node.id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-open tutor with first teaching turn
  const openTutor = async () => {
    if (tutorOpened) return;
    setTutorOpened(true);
    setSending(true);
    try {
      const r = await tutor(node.id, []);
      setMessages([
        { role: "assistant", content: r.reply, mastery_signal: r.mastery_signal },
      ]);
    } catch (e) {
      setMessages([
        { role: "assistant", content: `导师暂不可用：${String(e instanceof Error ? e.message : e)}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (tab === "tutor" && !tutorOpened) {
      void openTutor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const sendUserMessage = async () => {
    if (!input.trim() || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: input.trim() }];
    setMasteryCardDismissed(false);
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const r = await tutor(
        node.id,
        next.map(({ role, content }) => ({ role, content })),
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: r.reply, mastery_signal: r.mastery_signal },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `出错：${String(e instanceof Error ? e.message : e)}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleMasteryCheck = async () => {
    setChecking(true);
    setCheckError("");
    setCheckResult(null);
    setMasteryCardDismissed(false);
    try {
      const result = await checkMastery(
        node.id,
        messages.map(({ role, content }) => ({ role, content })),
      );
      setCheckResult(result);
      if (result.mastered) {
        if (isLoggedIn) {
          try {
            await upsertProgress(node.id, "mastered", result.reasoning);
            await onMarkMastered();
          } catch (progressError) {
            setCheckError(
              `通关已判定成功，但保存进度失败：${String(
                progressError instanceof Error ? progressError.message : progressError,
              )}`,
            );
          }
        }
      }
    } catch (e) {
      setCheckError(String(e instanceof Error ? e.message : e));
    } finally {
      setChecking(false);
    }
  };

  const dismissMasteryCard = () => {
    setCheckResult(null);
    setCheckError("");
    setMasteryCardDismissed(true);
  };

  const masterySignaled = messages.some((m) => m.mastery_signal);
  const hasMasteryPrompt =
    masterySignaled || messages.length >= 2 || checking || checkResult || checkError;
  const showMasteryCard = !masteryCardDismissed && hasMasteryPrompt;

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)]/40 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {node.estimated_minutes} min
            {isMastered && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                已掌握
              </span>
            )}
            {(node.tags || []).slice(0, 3).map((t) => (
              <span key={t} className="rounded bg-[var(--secondary)]/40 px-1.5 py-0.5">
                {t}
              </span>
            ))}
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {node.title[locale]}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {node.summary[locale]}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mastery criteria pill */}
      <div className="border-b border-[var(--border)]/40 bg-[var(--secondary)]/20 px-5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          掌握标准
        </div>
        <div className="mt-1 text-sm">{node.mastery_criteria[locale]}</div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]/40 px-3">
        <TabButton
          active={tab === "resources"}
          onClick={() => setTab("resources")}
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label={`资源 (${node.resources?.length || 0})`}
        />
        <TabButton
          active={tab === "tutor"}
          onClick={() => setTab("tutor")}
          icon={<Bot className="h-3.5 w-3.5" />}
          label="AI 导师"
        />
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "resources" && (
          <div className="h-full overflow-y-auto p-5">
            {hasResources ? (
              <ul className="space-y-3">
                {(node.resources || []).map((r, i) => (
                  <ResourceItem key={i} resource={r} locale={locale} />
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)]/60 bg-[var(--secondary)]/20 p-6 text-center">
                <BookOpen className="mx-auto h-6 w-6 text-[var(--muted-foreground)]" />
                <div className="mt-2 text-sm">本节点暂无学习资源</div>
                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                  你可以直接打开右上角「AI 导师」让 AI 讲给你听。
                </div>
                <button
                  onClick={() => setTab("tutor")}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90"
                >
                  <Bot className="h-3.5 w-3.5" />
                  让 AI 开始讲
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "tutor" && (
          <div className="flex h-full flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 && sending ? (
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 导师正在准备开场…
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <ChatBubble key={i} role={m.role} content={m.content} />
                  ))}
                  {sending && messages.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      正在回应…
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mastery check */}
            {showMasteryCard && (
              <div className="mx-4 mb-2 flex max-h-[34vh] flex-col overflow-hidden rounded-xl border border-[var(--border)]/60 bg-[var(--secondary)]/20 text-sm shadow-sm">
                <div className="shrink-0 border-b border-[var(--border)]/40 bg-[var(--background)]/95 p-2.5 backdrop-blur">
                  <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {isMastered ? "这个节点已通关" : "准备好了可以做一次通关测试"}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-[var(--muted-foreground)]">
                      {masterySignaled
                        ? "AI 导师已经看到掌握迹象，建议用测试确认一次。"
                        : "系统会根据你刚才的回答判断是否真的理解，而不是只靠自评。"}
                    </div>
                  </div>
                  {!isMastered && (
                    <button
                      onClick={handleMasteryCheck}
                      disabled={checking || messages.length === 0}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
                    >
                      {checking ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      开始通关测试
                    </button>
                  )}
                  <button
                    onClick={dismissMasteryCard}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]"
                    title="收起通关测试"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  </div>
                </div>

                <div className="min-h-0 space-y-2 overflow-y-auto p-2.5">
                  {checkError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-200">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>测试失败：{checkError}</span>
                    </div>
                  )}

                  {checking && !checkResult && !checkError && (
                    <div className="flex items-start gap-2 rounded-lg border border-[var(--border)]/60 bg-[var(--background)]/80 px-3 py-2 text-xs text-[var(--muted-foreground)]">
                      <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[var(--primary)]" />
                      <span>正在判定你的回答，通常需要几秒钟。你可以继续停留在这里，不会自动丢失结果。</span>
                    </div>
                  )}

                  {checkResult && (
                    <MasteryResultCard
                      result={checkResult}
                      locale={locale}
                      onSelectNodeById={onSelectNodeById}
                    />
                  )}
                </div>
              </div>
            )}

            {!showMasteryCard && masteryCardDismissed && hasMasteryPrompt && (
              <div className="mx-4 mb-2">
                <button
                  onClick={() => setMasteryCardDismissed(false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)]/70 bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] shadow-sm hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
                  通关测试
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-[var(--border)]/40 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void sendUserMessage();
                    }
                  }}
                  rows={2}
                  placeholder="问 AI 任何问题…  (⌘/Ctrl + Enter 发送)"
                  className="flex-1 resize-none rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
                <button
                  onClick={sendUserMessage}
                  disabled={sending || !input.trim()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
        active
          ? "border-[var(--primary)] text-[var(--foreground)]"
          : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MasteryResultCard({
  result,
  locale,
  onSelectNodeById,
}: {
  result: MasteryCheckResult;
  locale: LocaleKey;
  onSelectNodeById?: (nodeId: string) => void;
}) {
  const passed = result.mastered;
  const confidence = Math.round((result.confidence || 0) * 100);
  const nextNode = result.next_node;
  const resources = (result.review_resources || []).slice(0, 2);

  return (
    <div
      className={`rounded-xl border p-2.5 ${
        passed
          ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {passed ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          )}
          {passed ? "通关成功" : "还需要复习"}
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-black/20 dark:text-slate-200">
          置信度 {confidence}%
        </span>
      </div>

      {result.reasoning && (
        <p className="mt-1.5 line-clamp-3 text-[11px] leading-4 opacity-90">
          {result.reasoning}
        </p>
      )}

      {!passed && result.missing_points && result.missing_points.length > 0 && (
        <div className="mt-1.5 rounded-lg bg-white/55 p-2 text-[11px] dark:bg-black/15">
          <div className="font-semibold">还差一点：</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-4">
            {result.missing_points.slice(0, 2).map((point, index) => (
              <li key={`${point}-${index}`}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {result.next_followup && (
        <div className="mt-1.5 rounded-lg bg-white/55 p-2 text-[11px] leading-4 dark:bg-black/15">
          <span className="font-semibold">下一问：</span>
          {result.next_followup}
        </div>
      )}

      {nextNode && (
        <div className="mt-1.5 rounded-lg bg-white/65 p-2 text-[11px] dark:bg-black/15">
          <div className="mb-1 font-semibold">
            {passed ? "下一步：建议进入这个节点" : "下一步：先回到这个节点"}
          </div>
          <button
            onClick={() => onSelectNodeById?.(nextNode.id)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-current/15 bg-white/70 px-2 py-1.5 text-left transition-colors hover:bg-white dark:bg-black/20 dark:hover:bg-black/30"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{nextNode.title[locale]}</span>
              <span className="mt-0.5 line-clamp-1 block opacity-75">
                {nextNode.summary[locale]}
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      )}

      {resources.length > 0 && (
        <div className="mt-1.5 rounded-lg bg-white/65 p-2 text-[11px] dark:bg-black/15">
          <div className="mb-1 font-semibold">先复习这几篇文档</div>
          <div className="space-y-1">
            {resources.map((resource, index) => (
              <a
                key={`${resource.url}-${index}`}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg border border-current/15 bg-white/70 px-2 py-1.5 transition-colors hover:bg-white dark:bg-black/20 dark:hover:bg-black/30"
              >
                <span className="min-w-0 truncate">{resource.title[locale]}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceItem({ resource, locale }: { resource: NodeResource; locale: LocaleKey }) {
  const typeColor =
    resource.type === "article"
      ? "bg-blue-100 text-blue-700"
      : resource.type === "doc"
      ? "bg-purple-100 text-purple-700"
      : resource.type === "video"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-700";
  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-3 transition-colors hover:border-[var(--primary)]"
      >
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${typeColor}`}>
            {resource.type}
          </span>
          <span className="flex-1 text-sm font-semibold">
            {resource.title[locale]}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
        </div>
        {resource.summary && (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {resource.summary[locale]}
          </p>
        )}
      </a>
    </li>
  );
}

function ChatBubble({ role, content }: { role: "assistant" | "user"; content: string }) {
  if (role === "assistant") {
    return (
      <div className="flex gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/15 text-[var(--primary)]">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-[var(--secondary)]/40 px-3 py-2 text-sm leading-6">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--primary)] px-3 py-2 text-sm leading-6 text-[var(--primary-foreground)]">
        {content}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

interface FloatingAITutorProps {
  /** 当前 track 名（中文） */
  trackLabel?: string;
  /** 右侧节点详情面板宽度（px）。开着时长条要让出这块空间，不要盖到面板上 */
  rightOffsetPx?: number;
  /** 左侧边栏宽度（px），用于让 AI 长条始终居中在画布区域 */
  leftOffsetPx?: number;
  /** 未登录时只能浏览图谱，使用 AI 导师时再引导登录 */
  isLoggedIn: boolean;
  /** 节点详情抽屉打开时暂时安静下来，避免盖住学习内容 */
  disabled?: boolean;
  /** 自定义 API 路径（默认 /api/v1/knowledge-graph/ask） */
  apiPath?: string;
  /** API 请求额外的 body 字段（如 graph_context） */
  apiExtraBody?: Record<string, unknown>;
  /** 每次收到 AI 回复时回调，传入完整 response JSON */
  onResponse?: (data: Record<string, unknown>) => void;
  /** 自定义快捷问题（覆盖默认） */
  quickQuestions?: string[];
  /** rightOffsetPx > 0 时是否禁用 AI 导师（默认 true，/explore 传 false） */
  disableWhenOffset?: boolean;
}

interface ChatMsg {
  role: "assistant" | "user";
  content: string;
}

const DEFAULT_QUICK_QUESTIONS = [
  "反淘和普通跨境电商最大的区别是什么？",
  "新手卖家应该从哪条路径开始？",
  "Reddit 和 Discord 哪个更值得投入？",
  "代理平台是怎么赚钱的？",
];

const PUBLIC_BETA_AI_OPEN = true;

export default function FloatingAITutor({
  trackLabel,
  rightOffsetPx = 0,
  leftOffsetPx = 0,
  isLoggedIn,
  disabled = false,
  apiPath,
  apiExtraBody,
  onResponse,
  quickQuestions,
  disableWhenOffset = true,
}: FloatingAITutorProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 详情面板打开时禁用 AI 长条（避免抢注意力）
  const panelDisabled = disabled || (disableWhenOffset && rightOffsetPx > 0);
  // 公测期先放开 AI 体验；登录只用于长期保存个人学习进度。
  const authRequired = !PUBLIC_BETA_AI_OPEN && !isLoggedIn;

  // 详情面板打开 → 自动收起聊天弹层
  useEffect(() => {
    if (panelDisabled && open) setOpen(false);
  }, [panelDisabled, open]);

  // 自动滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const ensureOpenWithGreeting = () => {
    if (!open) setOpen(true);
    if (authRequired) return;
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: trackLabel
            ? `👋 我是反淘 AI 导师。你正在学「${trackLabel}」赛道，可以问图谱里任何节点的概念，也可以聊宏观行业问题。`
            : "👋 我是反淘 AI 导师。可以问我反淘行业的任何问题。",
        },
      ]);
    }
  };

  const ask = async (text: string) => {
    if (!text.trim() || sending) return;
    if (authRequired) {
      setOpen(true);
      return;
    }
    ensureOpenWithGreeting();
    const next: ChatMsg[] = [...messages, { role: "user", content: text.trim() }];
    // 如果是首次，确保先有 greeting，再加用户消息
    setMessages((prev) =>
      prev.length === 0
        ? [
            {
              role: "assistant",
              content: trackLabel
                ? `👋 我是反淘 AI 导师。你正在学「${trackLabel}」赛道。`
                : "👋 我是反淘 AI 导师。",
            },
            { role: "user", content: text.trim() },
          ]
        : next,
    );
    setInput("");
    setSending(true);
    try {
      const endpoint = apiPath || "/api/v1/knowledge-graph/ask";
      const body: Record<string, unknown> = {
        messages: next.map(({ role, content }) => ({ role, content })),
        ...(apiExtraBody || {}),
      };
      const r = await fetch(apiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as Record<string, unknown>;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: (data.reply as string) || `出错了：${data.detail || "未知错误"}`,
        },
      ]);
      if (onResponse) onResponse(data);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `网络出错：${String(e instanceof Error ? e.message : e)}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* 聊天弹层（居中底部，bar 之上）—— 让出右侧节点详情面板 */}
      {open && (
        <div
          className="pointer-events-none fixed left-0 bottom-20 z-40 flex justify-center px-3 transition-[right] duration-300 md:bottom-24 md:px-4"
          style={{ left: leftOffsetPx, right: rightOffsetPx }}
        >
          <div className="pointer-events-auto flex h-[min(68dvh,440px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[28px] border border-slate-300/55 bg-white/82 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-slate-700/55 dark:bg-slate-950/82 md:h-[440px]">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-white/42 px-4 py-3 text-slate-900 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/42 dark:text-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-100/80 text-amber-800 shadow-sm dark:border-amber-300/30 dark:bg-amber-300/15 dark:text-amber-200">
                <Bot className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold tracking-tight">
                  反淘 AI 导师
                </div>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  在线 · 有问必答
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200/70 bg-white/70 p-1.5 text-slate-500 shadow-sm transition-colors hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:text-slate-100"
                title="收起"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>

            <>
                {/* Messages */}
                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {messages.map((m, i) => (
                      <ChatRow key={i} role={m.role} content={m.content} />
                    ))}
                    {sending && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI 思考中…
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick questions（仅初次） */}
                {messages.length <= 1 && (
              <div className="border-t border-slate-200/70 bg-white/36 px-3 py-2 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/36">
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <Sparkles className="h-2.5 w-2.5" />
                  试试这些问题
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(quickQuestions || DEFAULT_QUICK_QUESTIONS).map((q) => (
                    <button
                      key={q}
                      onClick={() => void ask(q)}
                      className="rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition-colors hover:border-amber-300 hover:text-slate-950 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
                )}
            </>
          </div>
        </div>
      )}

      {/* 半透明 AI 长条：居中但不完全遮挡知识图谱。 */}
      <div
        className="pointer-events-none fixed bottom-3 z-30 flex justify-center px-3 transition-[right] duration-300 md:bottom-4 md:px-4"
        style={{ left: leftOffsetPx, right: rightOffsetPx }}
      >
        <div
          className={`flex items-center gap-2 rounded-full border px-2 py-1.5 backdrop-blur-2xl transition-all duration-300 ${
            panelDisabled
              ? "pointer-events-none w-[220px] translate-y-2 scale-95 border-slate-300/35 bg-white/20 opacity-35 shadow-none dark:border-slate-700/40 dark:bg-slate-950/20"
              : open
              ? "pointer-events-auto w-full max-w-[560px] border-slate-300/45 bg-white/45 shadow-[0_16px_44px_rgba(15,23,42,0.12)] dark:border-slate-700/50 dark:bg-slate-950/45"
              : "pointer-events-auto w-full max-w-[420px] border-slate-300/35 bg-white/24 opacity-70 shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:bg-white/40 hover:opacity-95 dark:border-slate-700/45 dark:bg-slate-950/24 dark:hover:bg-slate-950/40"
          }`}
          aria-disabled={panelDisabled}
          title={panelDisabled ? "关闭节点详情后可用" : undefined}
        >
          {/* 头像按钮——点击展开/收起 */}
          <button
            onClick={() => {
              if (panelDisabled) return;
              if (open) setOpen(false);
              else ensureOpenWithGreeting();
            }}
            disabled={panelDisabled}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-transform ${
              panelDisabled
                ? "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]"
                : open
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:scale-105"
                : "border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] hover:scale-105 hover:border-[var(--primary)]"
            }`}
            title={panelDisabled ? "关闭节点详情后可用" : open ? "收起" : "打开 AI 导师"}
          >
            {open ? (
              <X className="h-4 w-4" strokeWidth={2.6} />
            ) : (
              <Bot className="h-5 w-5" strokeWidth={2.6} />
            )}
          </button>

          {!open && (
            <button
              type="button"
              onClick={() => {
                if (panelDisabled) return;
                ensureOpenWithGreeting();
              }}
              disabled={panelDisabled}
              className="min-w-0 flex-1 truncate pr-2 text-left text-sm font-medium text-[var(--muted-foreground)]"
            >
              {authRequired ? "登录后问 AI 导师" : "问 AI 导师"}
            </button>
          )}

          {/* 输入框 */}
          {open && (
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => {
                if (!open && !panelDisabled) ensureOpenWithGreeting();
              }}
              onKeyDown={(e) => {
                if (panelDisabled || authRequired) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
                if (e.key === "Escape" && open) {
                  setOpen(false);
                }
              }}
              disabled={panelDisabled || authRequired}
              placeholder={
                panelDisabled
                  ? "关闭节点详情后即可提问"
                  : authRequired
                  ? "登录后可向 AI 导师提问"
                  : "问任何关于反淘的问题，按 Enter 发送"
              }
              className={`flex-1 bg-transparent px-2 text-sm font-medium outline-none placeholder:text-[var(--muted-foreground)] ${
                panelDisabled || authRequired ? "text-[var(--muted-foreground)] cursor-not-allowed" : "text-[var(--foreground)]"
              }`}
            />
          )}

          {/* 发送按钮 */}
          {open && (
            <button
              onClick={() => void ask(input)}
              disabled={panelDisabled || authRequired || sending || !input.trim()}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-transform ${
                panelDisabled || authRequired
                  ? "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]"
                  : "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
              }`}
              title={panelDisabled ? "关闭节点详情后可用" : authRequired ? "登录后可用" : "发送"}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} />
              ) : (
                <Send className="h-4 w-4" strokeWidth={2.6} />
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function ChatRow({ role, content }: { role: "assistant" | "user"; content: string }) {
  if (role === "assistant") {
    return (
      <div className="flex gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-100/80 text-amber-800 shadow-sm">
          <Bot className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-slate-200/70 bg-white/74 px-3 py-2 text-sm leading-6 text-slate-800 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/72 dark:text-slate-100">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--primary)] px-3 py-2 text-sm font-medium leading-6 text-[var(--primary-foreground)] shadow-sm">
        {content}
      </div>
    </div>
  );
}

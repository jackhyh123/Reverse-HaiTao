"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import type { GraphNode, KnowledgeGraph } from "@/lib/knowledge-graph";

// ─── Types ───────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface ParsedOption {
  letter: string; // "A" | "B" | "C" | "D"
  text: string;
}

interface DiagnosticResult {
  level: "beginner" | "intermediate" | "advanced";
  level_label: string;
  suggested_track: string;
  summary: string;
  personalized_nodes: GraphNode[];
}

interface DiagnosticOverlayProps {
  /** Called when the user completes the diagnostic and clicks "开始学习" */
  onComplete: (result: {
    level: string;
    level_label: string;
    suggested_track: string;
    summary: string;
    personalized_nodes: GraphNode[];
  }) => void;
  /** Called when the user clicks "跳过诊断" — signals to bypass the quiz */
  onSkip?: () => void;
}

// ─── Option parsing ──────────────────────────────────────────────────────

/** Parse labeled options (A/B/C/D) from AI reply text */
function parseOptions(text: string): ParsedOption[] {
  const lines = text.split("\n");
  const options: ParsedOption[] = [];
  // Match patterns like "A. xxx", "A) xxx", "A、xxx", "A: xxx"
  const optionRe = /^([A-D])[.、．)\s:：]+\s*(.+)$/;
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(optionRe);
    if (m) {
      options.push({ letter: m[1], text: m[2].trim() });
    }
  }
  return options;
}

/** Remove option lines from the reply, leaving just the question text */
function stripOptions(text: string): string {
  const optionRe = /^[A-D][.、．)\s:：]+.+$/m;
  return text
    .split("\n")
    .filter((line) => !optionRe.test(line.trim()))
    .join("\n")
    .trim();
}

// ─── Constants ────────────────────────────────────────────────────────────

const DIAGNOSTIC_STORAGE_KEY = "learn_diagnostic_completed";
const DIAGNOSTIC_RESULT_KEY = "learn_diagnostic_result";

export function getDiagnosticCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DIAGNOSTIC_STORAGE_KEY) === "true";
}

export function setDiagnosticCompleted(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, "true");
}

export function getDiagnosticResult() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DIAGNOSTIC_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDiagnostic() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DIAGNOSTIC_STORAGE_KEY);
  localStorage.removeItem(DIAGNOSTIC_RESULT_KEY);
}

// ─── Component ────────────────────────────────────────────────────────────

export default function DiagnosticOverlay({ onComplete, onSkip }: DiagnosticOverlayProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<"init" | "question" | "complete">("init");
  const [options, setOptions] = useState<ParsedOption[]>([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalEstimate, setTotalEstimate] = useState(4);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  /** Send a message (start quiz or answer a question) */
  const send = useCallback(
    async (userMessage?: string) => {
      if (sending) return;
      setError("");

      const nextMessages: ChatMessage[] = userMessage
        ? [...messages, { role: "user" as const, content: userMessage }]
        : messages;

      if (userMessage) {
        setMessages(nextMessages);
      }

      setSending(true);
      setOptions([]);

      try {
        const body: Record<string, unknown> = {
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        };

        const r = await fetch(apiUrl("/api/v1/knowledge-graph/diagnostic-quiz"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = (await r.json()) as Record<string, unknown>;

        if (!r.ok) {
          throw new Error(String(data.detail || "请求失败"));
        }

        const reply = String(data.reply || "");
        const respPhase = String(data.phase || "question");
        const qn = Number(data.question_number || 0);
        const total = Number(data.total_questions_estimate || 4);

        // Add AI reply to messages
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        setPhase(respPhase as "question" | "complete");
        setQuestionNumber(qn);
        setTotalEstimate(total);

        if (respPhase === "question") {
          // Parse options from the reply
          const parsedOpts = parseOptions(reply);
          setOptions(parsedOpts);
        }

        if (respPhase === "complete") {
          const result = data.diagnostic_result as DiagnosticResult | undefined;
          if (result) {
            setDiagnosticResult(result);
          }
        }
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
        // Remove the user message if it failed
        if (userMessage) {
          setMessages((prev) => prev.slice(0, -1));
        }
      } finally {
        setSending(false);
      }
    },
    [messages, sending],
  );

  /** Start the quiz (first message) */
  const startQuiz = useCallback(() => {
    void send();
  }, [send]);

  /** User clicks an option */
  const selectOption = useCallback(
    (option: ParsedOption) => {
      // Send the option letter as the answer
      void send(option.letter);
    },
    [send],
  );

  /** User clicks "开始学习" to dismiss */
  const handleStartLearning = useCallback(() => {
    if (diagnosticResult) {
      // Save to localStorage
      setDiagnosticCompleted();
      localStorage.setItem(
        DIAGNOSTIC_RESULT_KEY,
        JSON.stringify(diagnosticResult),
      );
      onComplete(diagnosticResult);
    }
  }, [diagnosticResult, onComplete]);

  // ── Render: init state (show start screen) ────────────────────────────
  if (phase === "init") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="w-full max-w-lg text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] border border-amber-400/30 bg-amber-400/10 shadow-[0_0_60px_rgba(251,191,36,0.15)]">
            <Bot className="h-10 w-10 text-amber-400" strokeWidth={1.8} />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            反淘 AI 导师
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
            在开始学习之前，先让我了解你的水平
            <br />
            我会问你 3-5 个选择题，然后为你生成个性化的学习路线
          </p>

          <button
            onClick={startQuiz}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-8 py-4 text-[15px] font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-400 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.98]"
          >
            <Sparkles className="h-5 w-5" />
            开始诊断
          </button>

          {onSkip && (
            <div className="mt-4">
              <button
                onClick={onSkip}
                className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-400 transition-colors"
              >
                跳过诊断，自由浏览
              </button>
            </div>
          )}

          <p className="mt-6 text-xs text-slate-600">
            大约需要 1-2 分钟 · 完成后即可进入学习
          </p>
        </div>
      </div>
    );
  }

  // ── Render: question or complete phase ──────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-800/60 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
            <Bot className="h-5 w-5 text-amber-400" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white">反淘 AI 导师 · 水平诊断</div>
            {phase === "question" && questionNumber > 0 && (
              <div className="text-[11px] text-slate-500">
                问题 {questionNumber}/{totalEstimate}
              </div>
            )}
          </div>
          {/* Progress dots */}
          {phase === "question" && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalEstimate }, (_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < questionNumber
                      ? "w-6 bg-amber-400"
                      : i === questionNumber
                      ? "w-4 bg-amber-400/40"
                      : "w-1.5 bg-slate-700"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              role={m.role}
              content={m.content}
              isLast={i === messages.length - 1}
            />
          ))}

          {/* Options buttons (shown after the last assistant message in question phase) */}
          {phase === "question" && options.length > 0 && !sending && (
            <div className="mt-3 space-y-2 pl-10">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                选择一个答案
              </div>
              {options.map((opt) => (
                <button
                  key={opt.letter}
                  onClick={() => selectOption(opt)}
                  disabled={sending}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 text-left transition-all hover:border-amber-400/40 hover:bg-slate-800/80 active:scale-[0.99]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-slate-300">
                    {opt.letter}
                  </span>
                  <span className="text-sm text-slate-300">{opt.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Complete state: show result card */}
          {phase === "complete" && diagnosticResult && (
            <div className="mt-4 pl-10">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">
                    诊断完成
                  </span>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                    {diagnosticResult.level_label}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-slate-300">
                  {diagnosticResult.summary}
                </p>

                {/* Personalized nodes preview */}
                {diagnosticResult.personalized_nodes.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      为你定制的学习路线（{diagnosticResult.personalized_nodes.length} 个节点）
                    </div>
                    {diagnosticResult.personalized_nodes.slice(0, 5).map((node, idx) => (
                      <div
                        key={node.id}
                        className="flex items-start gap-2.5 rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-[10px] font-bold text-amber-400">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-slate-200">
                            {node.title?.zh || node.id}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                            {node.summary?.zh || ""}
                          </div>
                        </div>
                      </div>
                    ))}
                    {diagnosticResult.personalized_nodes.length > 5 && (
                      <div className="text-[11px] text-slate-600 pl-7">
                        +{diagnosticResult.personalized_nodes.length - 5} 更多节点
                      </div>
                    )}
                  </div>
                )}

                {/* Start learning button */}
                <button
                  onClick={handleStartLearning}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.98]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  开始学习
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Sending indicator */}
          {sending && (
            <div className="flex items-center gap-2 pl-10 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              AI 思考中…
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs text-red-400">
              {error}
              <button
                onClick={() => send()}
                className="ml-2 underline hover:text-red-300"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────

function ChatBubble({
  role,
  content,
  isLast,
}: {
  role: "assistant" | "user";
  content: string;
  isLast: boolean;
}) {
  // Strip option lines from assistant's last message (we render buttons separately)
  const displayContent =
    role === "assistant" && isLast ? stripOptions(content) : content;

  if (!displayContent.trim()) return null;

  if (role === "assistant") {
    return (
      <div className="flex gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
          <Bot className="h-4 w-4 text-amber-400" strokeWidth={2} />
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-slate-700/40 bg-slate-800/50 px-4 py-2.5 text-sm leading-6 text-slate-200">
          <ChatContent text={displayContent} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-amber-500/15 border border-amber-400/20 px-4 py-2.5 text-sm leading-6 text-amber-100">
        {displayContent}
      </div>
    </div>
  );
}

/** Renders text with basic formatting (bold markers, newlines) */
function ChatContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}

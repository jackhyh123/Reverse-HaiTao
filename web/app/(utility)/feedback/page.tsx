"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareText, Send } from "lucide-react";
import { submitFeedback } from "@/lib/feedback-api";

const ROLE_OPTIONS = ["新手卖家", "平台运营", "只是看看", "其他"];
const RATING_OPTIONS = ["很有用", "有点懵", "不知道下一步", "发现问题"];

export default function FeedbackPage() {
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [rating, setRating] = useState(RATING_OPTIONS[0]);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setError("请先写一点反馈，比如哪里看不懂、哪里有帮助、哪里想改。");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitFeedback({
        role,
        rating,
        message,
        contact,
        page_url: typeof window !== "undefined" ? window.location.href : "",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
      setSubmitted(true);
      setMessage("");
      setContact("");
    } catch (e) {
      setError("提交失败了，可以稍后再试。");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_32%),var(--background)] px-5 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-12">
        <section className="rounded-[32px] border border-[var(--border)]/50 bg-[var(--card)]/86 p-7 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-300/15 dark:text-amber-200">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--primary)]">真实用户反馈</div>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">
                你刚刚哪里卡住了？
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                这里不是客服工单，更像测试反馈本。你可以直接写：哪里看不懂、哪一步想点但不知道点哪里、哪个资料有帮助、哪个回答不准确。
              </p>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-[var(--border)]/50 bg-[var(--card)] p-6 shadow-sm"
        >
          {submitted && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              已收到反馈，谢谢。这个阶段每一条反馈都很值钱。
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-bold">你的身份更像</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-bold">这次体验感觉</span>
              <select
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
              >
                {RATING_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-bold">具体反馈</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="例如：我不知道第一步为什么要学这个；或者我点了某个节点后不清楚下一步该做什么。"
              className="min-h-40 w-full resize-y rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-4 text-sm leading-6 outline-none focus:border-[var(--primary)]"
            />
          </label>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-bold">联系方式（可选）</span>
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="微信 / 邮箱 / 飞书都可以，不想留也没关系"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>

          {error && <div className="mt-4 text-sm font-semibold text-red-600">{error}</div>}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-black text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              提交反馈
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

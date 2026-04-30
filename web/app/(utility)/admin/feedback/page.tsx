"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Loader2, ExternalLink, Clock, User, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "@/lib/api";

interface FeedbackEntry {
  id: string;
  created_at: string;
  rating: string;
  role: string;
  message: string;
  contact: string;
  page_url: string;
  user_agent: string;
}

export default function AdminFeedbackPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/v1/feedback?limit=200"), {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems((data.items || []) as FeedbackEntry[]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const total = items.length;

  return (
    <div className="mx-auto max-w-[960px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {t("admin.feedback.eyebrow")}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
            {t("admin.feedback.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("admin.feedback.subtitle")}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-2 text-sm font-medium hover:bg-[var(--secondary)]/50 disabled:opacity-50"
        >
          <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("admin.feedback.refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-950/50 dark:text-red-100">
          {error}
        </div>
      )}

      {loading && !items.length ? (
        <div className="flex items-center justify-center py-20 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("admin.feedback.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--secondary)]/50">
            <MessageSquareText className="h-7 w-7 text-[var(--muted-foreground)]" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">
            {t("admin.feedback.emptyTitle")}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
            {t("admin.feedback.emptyHint")}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-[var(--muted-foreground)]">
            {t("admin.feedback.count", { count: total })}
          </div>
          <div className="space-y-4">
            {items.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary)]/50 px-2 py-0.5">
                    <Clock className="h-3 w-3" />
                    {entry.created_at}
                  </span>
                  {entry.role && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary)]/50 px-2 py-0.5">
                      <User className="h-3 w-3" />
                      {entry.role}
                    </span>
                  )}
                  {entry.rating && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-300/15 dark:text-amber-200">
                      <Tag className="h-3 w-3" />
                      {entry.rating}
                    </span>
                  )}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                  {entry.message}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
                  {entry.contact && (
                    <span>
                      {t("admin.feedback.contact")}: {entry.contact}
                    </span>
                  )}
                  {entry.page_url && (
                    <a
                      href={entry.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("admin.feedback.pageUrl")}
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

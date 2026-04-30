"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RELEASE_NOTES, type ReleaseNoteLocale } from "@/lib/release-notes";

const INITIAL_VISIBLE_COUNT = 3;
const LOAD_MORE_COUNT = 3;

export default function ReleaseNotesPage() {
  const { i18n } = useTranslation();
  const locale: ReleaseNoteLocale = i18n.language.startsWith("zh") ? "zh" : "en";
  const latest = RELEASE_NOTES[0];
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const visibleNotes = useMemo(
    () => RELEASE_NOTES.slice(0, visibleCount),
    [visibleCount],
  );
  const remainingCount = Math.max(RELEASE_NOTES.length - visibleCount, 0);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%),var(--background)]">
      <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
        <section className="rounded-[2rem] border border-[var(--border)]/60 bg-[var(--card)]/80 p-7 shadow-sm backdrop-blur md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)]/70 bg-[var(--secondary)]/40 px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
            {locale === "zh" ? "更新了啥" : "Product Release Notes"}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                {latest.version}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--foreground)] md:text-6xl">
                {locale === "zh" ? "每一次更新，都是为了让学习更顺手" : "Every update makes learning easier"}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted-foreground)] md:text-lg">
                {locale === "zh"
                  ? "这里记录反淘淘金通关系统的产品变化。我们会尽量用普通用户能感受到的语言说明：哪里更好用了、能解决什么问题、下一步可以期待什么。"
                  : "This page records product updates for the AntiTao learning system in plain user-facing language: what changed, why it matters, and what to expect next."}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--border)]/60 bg-[var(--background)]/70 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <CalendarDays className="h-4 w-4 text-[var(--primary)]" />
                {locale === "zh" ? "最新版本" : "Latest"}
              </div>
              <div className="mt-4 text-3xl font-black tracking-[-0.03em]">
                {latest.version}
              </div>
              <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                {formatDate(latest.date, locale)}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 space-y-6">
          {visibleNotes.map((note) => (
            <article
              key={note.version}
              className="overflow-hidden rounded-[2rem] border border-[var(--border)]/60 bg-[var(--card)] shadow-sm"
            >
              <div className="border-b border-[var(--border)]/50 p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-bold text-[var(--primary-foreground)]">
                    {note.label[locale]}
                  </span>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {formatDate(note.date, locale)}
                  </span>
                  <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                    {note.version}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] md:text-3xl">
                  {note.headline[locale]}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)] md:text-base">
                  {note.summary[locale]}
                </p>
              </div>

              <div className="grid gap-0 md:grid-cols-[1fr_1fr]">
                <div className="border-b border-[var(--border)]/50 p-6 md:border-b-0 md:border-r md:p-8">
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    {locale === "zh" ? "这次你能明显感受到" : "What you will notice"}
                  </h3>
                  <div className="mt-5 space-y-4">
                    {note.highlights.map((item) => (
                      <ReleaseNoteBlock key={item.title[locale]} item={item} locale={locale} />
                    ))}
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    {locale === "zh" ? "更多细节" : "More details"}
                  </h3>
                  <div className="mt-5 space-y-4">
                    {note.details.map((item) => (
                      <ReleaseNoteBlock key={item.title[locale]} item={item} locale={locale} quiet />
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}

          {remainingCount > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() =>
                  setVisibleCount((count) =>
                    Math.min(count + LOAD_MORE_COUNT, RELEASE_NOTES.length),
                  )
                }
                className="rounded-full border border-[var(--border)]/70 bg-[var(--card)] px-5 py-2.5 text-sm font-bold text-[var(--foreground)] shadow-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--secondary)]/50"
              >
                {locale === "zh"
                  ? `查看更多更新（还有 ${remainingCount} 条）`
                  : `Load more updates (${remainingCount} left)`}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ReleaseNoteBlock({
  item,
  locale,
  quiet = false,
}: {
  item: {
    title: Record<ReleaseNoteLocale, string>;
    description: Record<ReleaseNoteLocale, string>;
  };
  locale: ReleaseNoteLocale;
  quiet?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          quiet
            ? "bg-[var(--secondary)] text-[var(--muted-foreground)]"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200"
        }`}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="text-base font-bold tracking-[-0.02em] text-[var(--foreground)]">
          {item.title[locale]}
        </div>
        <p className="mt-1 text-sm leading-7 text-[var(--muted-foreground)]">
          {item.description[locale]}
        </p>
      </div>
    </div>
  );
}

function formatDate(date: string, locale: ReleaseNoteLocale): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

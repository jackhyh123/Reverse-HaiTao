"use client";

import { useTranslation } from "react-i18next";
import { Check, Sparkles, MessageCircle, Users, BarChart3 } from "lucide-react";

const FREE_FEATURES = [
  "membership.free.nodes",
  "membership.free.resources",
  "membership.free.community",
  "membership.free.basicTutor",
];

const PREMIUM_FEATURES = [
  "membership.premium.allNodes",
  "membership.premium.allResources",
  "membership.premium.advancedTutor",
  "membership.premium.practice",
  "membership.premium.stats",
  "membership.premium.priority",
];

export default function MembershipPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-[960px] px-6 py-8">
      {/* Header */}
      <div className="mb-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
          <Sparkles className="h-3.5 w-3.5" />
          {t("membership.eyebrow")}
        </div>
        <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.02em]">
          {t("membership.title")}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
          {t("membership.subtitle")}
        </p>
      </div>

      {/* Two-column pricing */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {/* Free */}
        <div className="rounded-3xl border border-[var(--border)]/60 bg-[var(--background)] p-8 shadow-sm">
          <div className="mb-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--secondary)]/50">
              <Users className="h-5 w-5 text-[var(--muted-foreground)]" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">{t("membership.free.name")}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {t("membership.free.desc")}
            </p>
            <div className="mt-4">
              <span className="text-4xl font-bold">¥0</span>
              <span className="ml-1 text-sm text-[var(--muted-foreground)]">/ {t("membership.forever")}</span>
            </div>
          </div>
          <ul className="space-y-3">
            {FREE_FEATURES.map((key) => (
              <li key={key} className="flex items-start gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Premium */}
        <div className="relative rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-amber-50/50 to-[var(--background)] p-8 shadow-md dark:border-amber-400/30 dark:from-amber-400/5">
          <div className="absolute -top-3 right-6 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-900">
            {t("membership.recommended")}
          </div>
          <div className="mb-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-400/15">
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">{t("membership.premium.name")}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {t("membership.premium.desc")}
            </p>
            <div className="mt-4">
              <span className="text-4xl font-bold text-amber-600 dark:text-amber-400">¥99</span>
              <span className="ml-1 text-sm text-[var(--muted-foreground)]">/ {t("membership.month")}</span>
            </div>
          </div>
          <ul className="space-y-3">
            {PREMIUM_FEATURES.map((key) => (
              <li key={key} className="flex items-start gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span className="font-medium">{t(key)}</span>
              </li>
            ))}
          </ul>

          <a
            href={`mailto:hyhlovehy@gmail.com?subject=${encodeURIComponent(t("membership.ctaEmailSubject"))}`}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            {t("membership.cta")}
          </a>
          <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
            {t("membership.ctaHint")}
          </p>
        </div>
      </div>

      {/* Bottom stats preview */}
      <div className="mt-12 rounded-2xl border border-[var(--border)]/40 bg-[var(--secondary)]/20 p-6 text-center">
        <BarChart3 className="mx-auto h-6 w-6 text-[var(--muted-foreground)]" />
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {t("membership.bottomHint")}
        </p>
      </div>
    </div>
  );
}

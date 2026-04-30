"use client";

import Link from "next/link";
import {
  BookOpenCheck,
  Bot,
  Compass,
  Network,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/branding/BrandMark";
import { ANTITAO_SYSTEM_BLOCKS, useAntitaoCurriculum } from "@/lib/antitao";

const TRACK_ICON_MAP: Record<"seller" | "operator", LucideIcon> = {
  seller: Store,
  operator: Network,
};

const BLOCK_ICON_MAP: Record<string, LucideIcon> = {
  knowledge: Compass,
  coaches: Bot,
  playbooks: BookOpenCheck,
};

export default function LaunchHub() {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith("zh") ? "zh" : "en";
  const { trackList } = useAntitaoCurriculum(language);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(15,118,110,0.16),_transparent_30%)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col gap-6 px-6 py-8 md:gap-8 md:px-8 md:py-10">
        <section className="surface-card overflow-hidden border-[var(--border)]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-7 md:p-9">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[720px]">
              <div className="mb-5 flex items-center gap-4">
                <BrandMark size="lg" />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--muted-foreground)]">
                    {t("hub.eyebrow")}
                  </div>
                  <div className="mt-1 text-[14px] text-[var(--muted-foreground)]">
                    {t("brand.name")}
                  </div>
                </div>
              </div>
              <h1 className="max-w-[14ch] font-serif text-[38px] font-medium leading-[1.02] tracking-[-0.04em] text-[var(--foreground)] md:text-[54px]">
                {t("hub.title")}
              </h1>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-[var(--muted-foreground)] md:text-[16px]">
                {t("hub.subtitle")}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px] lg:grid-cols-1">
              {["hub.focus.knowledge", "hub.focus.coaches", "hub.focus.playbooks"].map(
                (key) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-[var(--border)]/60 bg-[var(--secondary)]/55 px-4 py-3 text-sm text-[var(--foreground)]"
                  >
                    {t(key)}
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {trackList.map((track) => {
            const Icon = TRACK_ICON_MAP[track.id];
            return (
              <article
                key={track.id}
                className="surface-card flex h-full flex-col border-[var(--border)]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex rounded-full border border-[var(--border)]/70 bg-[var(--secondary)]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                      {track.badge}
                    </div>
                    <h2 className="mt-4 text-[27px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                      {track.title}
                    </h2>
                    <p className="mt-2 text-[15px] leading-7 text-[var(--muted-foreground)]">
                      {track.subtitle}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--secondary)]/65 p-3 text-[var(--foreground)]">
                    <Icon size={20} />
                  </div>
                </div>

                <p className="mt-5 text-[14px] leading-7 text-[var(--foreground)]/88">
                  {track.summary}
                </p>
                <p className="mt-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--secondary)]/45 px-4 py-3 text-[13px] leading-6 text-[var(--muted-foreground)]">
                  {track.outcome}
                </p>

                <div className="mt-6 grid gap-3">
                  {track.gates.map((gate, index) => (
                    <div
                      key={gate.id}
                      className="rounded-2xl border border-[var(--border)]/55 bg-[var(--background)]/45 px-4 py-3"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                        {t("hub.stepLabel", { step: index + 1 })}
                      </div>
                      <div className="mt-1 text-[15px] font-medium text-[var(--foreground)]">
                        {gate.title}
                      </div>
                      <div className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">
                        {gate.description}
                      </div>
                      <div className="mt-3 rounded-2xl border border-[var(--border)]/50 bg-[var(--secondary)]/35 px-3 py-2 text-[12px] leading-5 text-[var(--muted-foreground)]">
                        {gate.passStandard}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/chat?track=${track.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform hover:-translate-y-0.5"
                  >
                    {t("hub.openTrack")}
                  </Link>
                  <Link
                    href="/book"
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border)]/70 px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]/70"
                  >
                    {t("hub.openPlaybooks")}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {ANTITAO_SYSTEM_BLOCKS.map((block) => {
            const Icon = BLOCK_ICON_MAP[block.id] ?? Compass;
            return (
              <Link
                key={block.id}
                href={block.href}
                className="surface-card group border-[var(--border)]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0))] p-5 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                      {t("hub.systemLayer")}
                    </div>
                    <div className="mt-2 text-[19px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                      {t(block.titleKey)}
                    </div>
                    <p className="mt-2 text-[14px] leading-6 text-[var(--muted-foreground)]">
                      {t(block.descriptionKey)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--secondary)]/65 p-3 text-[var(--foreground)] transition-colors group-hover:bg-[var(--accent)]/85">
                    <Icon size={18} />
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}

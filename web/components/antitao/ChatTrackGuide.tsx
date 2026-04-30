"use client";

import {
  BookOpenCheck,
  FileSearch,
  MessageSquareText,
  Network,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/branding/BrandMark";
import {
  type AntitaoLocalizedTrackActionDefinition,
  type AntitaoTrackId,
  useAntitaoCurriculum,
} from "@/lib/antitao";

const TRACK_ICON_MAP: Record<AntitaoTrackId, LucideIcon> = {
  seller: Store,
  operator: Network,
};

export default function ChatTrackGuide({
  activeTrackId,
  knowledgeReady,
  onSelectTrack,
  onRunAction,
}: {
  activeTrackId: AntitaoTrackId;
  knowledgeReady: boolean;
  onSelectTrack: (trackId: AntitaoTrackId) => void;
  onRunAction: (action: AntitaoLocalizedTrackActionDefinition) => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith("zh") ? "zh" : "en";
  const { tracks } = useAntitaoCurriculum(language);
  const activeTrack = tracks[activeTrackId];
  const TrackIcon = TRACK_ICON_MAP[activeTrackId];

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col items-center py-10 text-center">
      <div className="mb-5 flex items-center gap-4">
        <BrandMark size="lg" />
        <div className="text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            {t("chatGuide.eyebrow")}
          </div>
          <div className="mt-1 text-[14px] text-[var(--muted-foreground)]">
            {t("brand.name")}
          </div>
        </div>
      </div>

      <h1 className="max-w-[13ch] font-serif text-[36px] font-medium leading-[1.02] tracking-[-0.04em] text-[var(--foreground)] md:text-[48px]">
        {t("chatGuide.title")}
      </h1>
      <p className="mt-4 max-w-[64ch] text-[15px] leading-7 text-[var(--muted-foreground)] md:text-[16px]">
        {t("chatGuide.subtitle")}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {(["seller", "operator"] as AntitaoTrackId[]).map((trackId) => {
          const track = tracks[trackId];
          const Icon = TRACK_ICON_MAP[trackId];
          const active = trackId === activeTrackId;
          return (
            <button
              key={trackId}
              onClick={() => onSelectTrack(trackId)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)]/70 bg-[var(--secondary)]/55 text-[var(--foreground)] hover:bg-[var(--secondary)]/75"
              }`}
            >
              <Icon size={16} />
              <span>{track.badge}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 w-full rounded-[28px] border border-[var(--border)]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-6 text-left md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-[var(--border)]/70 bg-[var(--secondary)]/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              {activeTrack.badge}
            </div>
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {activeTrack.title}
            </h2>
            <p className="mt-2 max-w-[58ch] text-[15px] leading-7 text-[var(--muted-foreground)]">
              {activeTrack.subtitle}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--secondary)]/55 p-3 text-[var(--foreground)]">
            <TrackIcon size={22} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {activeTrack.gates.map((gate, index) => (
            <div
              key={gate.id}
              className="rounded-2xl border border-[var(--border)]/60 bg-[var(--background)]/40 px-4 py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                {t("chatGuide.stepLabel", { step: index + 1 })}
              </div>
              <div className="mt-1 text-[15px] font-medium text-[var(--foreground)]">
                {gate.title}
              </div>
              <div className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">
                {gate.description}
              </div>
              <div className="mt-3 space-y-1 rounded-2xl border border-[var(--border)]/50 bg-[var(--secondary)]/35 px-3 py-3">
                {gate.commonQuestions.map((question, questionIndex) => (
                  <div
                    key={`${gate.id}-q-${questionIndex}`}
                    className="text-[12px] leading-5 text-[var(--muted-foreground)]"
                  >
                    {question}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[12px] leading-5 text-[var(--foreground)]/85">
                {gate.passStandard}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {activeTrack.actions.map((action) => {
            const isResearch = action.capability === "deep_research";
            const Icon = isResearch ? FileSearch : MessageSquareText;
            return (
              <button
                key={action.id}
                onClick={() => onRunAction(action)}
                className="min-w-[220px] flex-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--secondary)]/45 px-4 py-4 text-left transition-colors hover:bg-[var(--secondary)]/75"
              >
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Icon size={17} />
                  <span className="text-[14px] font-semibold">
                    {action.title}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[var(--muted-foreground)]">
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-[13px] text-[var(--muted-foreground)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--background)]/35 px-3 py-2">
            <BookOpenCheck size={15} />
            <span>{t("chatGuide.playbookNote")}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--background)]/35 px-3 py-2">
            <span>{knowledgeReady ? t("chatGuide.knowledgeReady") : t("chatGuide.knowledgeMissing")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

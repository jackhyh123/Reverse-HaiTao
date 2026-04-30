"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiUrl } from "@/lib/api";
import type {
  AntitaoCurriculum,
  AntitaoTrackDefinition,
  LocalizedText,
} from "@/lib/antitao";
import { DEFAULT_ANTITAO_CURRICULUM } from "@/lib/antitao";

type TrackTab = "seller" | "operator";

function cloneCurriculum(curriculum: AntitaoCurriculum): AntitaoCurriculum {
  return JSON.parse(JSON.stringify(curriculum)) as AntitaoCurriculum;
}

function ensureText(value?: LocalizedText): LocalizedText {
  return value || { zh: "", en: "" };
}

export default function CurriculumPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("zh") ? "zh" : "en";
  const [curriculum, setCurriculum] = useState<AntitaoCurriculum>(
    DEFAULT_ANTITAO_CURRICULUM,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<TrackTab>("seller");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/v1/antitao-curriculum"), { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { curriculum?: AntitaoCurriculum }) => {
        if (!cancelled && payload.curriculum) {
          setCurriculum(payload.curriculum);
        }
      })
      .catch(() => {
        if (!cancelled) setCurriculum(DEFAULT_ANTITAO_CURRICULUM);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tracks = useMemo(() => curriculum.tracks || [], [curriculum]);
  const activeTrack =
    tracks.find((track) => track.id === activeTrackId) || tracks[0] || null;

  const updateTrack = useCallback(
    (trackId: TrackTab, updater: (track: AntitaoTrackDefinition) => void) => {
      setCurriculum((prev) => {
        const next = cloneCurriculum(prev);
        const track = next.tracks.find((item) => item.id === trackId);
        if (!track) return prev;
        updater(track);
        return next;
      });
    },
    [],
  );

  const updateLocalizedField = useCallback(
    (
      trackId: TrackTab,
      field:
        | "badge"
        | "title"
        | "subtitle"
        | "summary"
        | "outcome",
      value: string,
    ) => {
      updateTrack(trackId, (track) => {
        track[field] = ensureText(track[field]);
        track[field][locale] = value;
      });
    },
    [locale, updateTrack],
  );

  const addGate = useCallback(() => {
    updateTrack(activeTrackId, (track) => {
      track.gates.push({
        id: `${track.id}-gate-${Date.now()}`,
        title: { zh: "", en: "" },
        description: { zh: "", en: "" },
        common_questions: [{ zh: "", en: "" }],
        pass_standard: { zh: "", en: "" },
      });
    });
  }, [activeTrackId, updateTrack]);

  const saveCurriculum = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(apiUrl("/api/v1/antitao-curriculum"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculum }),
      });
      const payload = (await response.json()) as { curriculum?: AntitaoCurriculum };
      if (response.ok && payload.curriculum) {
        setCurriculum(payload.curriculum);
        setMessage(t("curriculum.saved"));
      } else {
        setMessage(t("curriculum.saveFailed"));
      }
    } catch {
      setMessage(t("curriculum.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [curriculum, t]);

  if (loading || !activeTrack) {
    return (
      <div className="mx-auto flex max-w-[960px] items-center gap-3 px-6 py-10 text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t("curriculum.loading")}</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[960px] px-6 py-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-[var(--border)]/70 bg-[var(--background)] px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                {t("curriculum.eyebrow")}
              </div>
              <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {t("curriculum.title")}
              </h1>
              <p className="mt-2 max-w-[68ch] text-[14px] leading-7 text-[var(--muted-foreground)]">
                {t("curriculum.subtitle")}
              </p>
            </div>
            <button
              onClick={saveCurriculum}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{saving ? t("curriculum.saving") : t("curriculum.save")}</span>
            </button>
          </div>
          {message ? (
            <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--secondary)]/40 px-4 py-3 text-sm text-[var(--muted-foreground)]">
              {message}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => setActiveTrackId(track.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                track.id === activeTrackId
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)]/70 bg-[var(--secondary)]/45 text-[var(--foreground)] hover:bg-[var(--secondary)]/70"
              }`}
            >
              {ensureText(track.badge)[locale] || ensureText(track.title)[locale]}
            </button>
          ))}
        </div>

        <section className="mt-6 rounded-3xl border border-[var(--border)]/70 bg-[var(--background)] px-6 py-6 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[var(--foreground)]">
            {t("curriculum.trackBasics")}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {([
              ["badge", t("curriculum.fields.badge")],
              ["title", t("curriculum.fields.title")],
              ["subtitle", t("curriculum.fields.subtitle")],
              ["summary", t("curriculum.fields.summary")],
              ["outcome", t("curriculum.fields.outcome")],
            ] as const).map(([field, label]) => (
              <label key={field} className={field === "summary" || field === "outcome" ? "md:col-span-2" : ""}>
                <div className="mb-2 text-sm font-medium text-[var(--foreground)]">{label}</div>
                <textarea
                  value={ensureText(activeTrack[field])[locale]}
                  onChange={(event) =>
                    updateLocalizedField(activeTrack.id, field, event.target.value)
                  }
                  rows={field === "badge" || field === "title" ? 2 : 4}
                  className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[var(--border)]/70 bg-[var(--background)] px-6 py-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--foreground)]">
                {t("curriculum.gates")}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("curriculum.gatesHint")}
              </p>
            </div>
            <button
              onClick={addGate}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)]/70 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]/60"
            >
              <Plus className="h-4 w-4" />
              <span>{t("curriculum.addGate")}</span>
            </button>
          </div>

          <div className="mt-5 space-y-5">
            {activeTrack.gates.map((gate, gateIndex) => (
              <div
                key={gate.id}
                className="rounded-3xl border border-[var(--border)]/60 bg-[var(--secondary)]/20 px-5 py-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    {t("curriculum.gateLabel", { index: gateIndex + 1 })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateTrack(activeTrack.id, (track) => {
                          if (gateIndex === 0) return;
                          const [item] = track.gates.splice(gateIndex, 1);
                          track.gates.splice(gateIndex - 1, 0, item);
                        })
                      }
                      className="rounded-xl border border-[var(--border)]/60 px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--background)]"
                    >
                      {t("curriculum.moveUp")}
                    </button>
                    <button
                      onClick={() =>
                        updateTrack(activeTrack.id, (track) => {
                          if (gateIndex >= track.gates.length - 1) return;
                          const [item] = track.gates.splice(gateIndex, 1);
                          track.gates.splice(gateIndex + 1, 0, item);
                        })
                      }
                      className="rounded-xl border border-[var(--border)]/60 px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--background)]"
                    >
                      {t("curriculum.moveDown")}
                    </button>
                    <button
                      onClick={() =>
                        updateTrack(activeTrack.id, (track) => {
                          track.gates.splice(gateIndex, 1);
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-red-300/70 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t("curriculum.removeGate")}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4">
                  <label>
                    <div className="mb-2 text-sm font-medium text-[var(--foreground)]">
                      {t("curriculum.fields.gateTitle")}
                    </div>
                    <textarea
                      value={ensureText(gate.title)[locale]}
                      onChange={(event) =>
                        updateTrack(activeTrack.id, (track) => {
                          track.gates[gateIndex].title[locale] = event.target.value;
                        })
                      }
                      rows={2}
                      className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label>
                    <div className="mb-2 text-sm font-medium text-[var(--foreground)]">
                      {t("curriculum.fields.gateDescription")}
                    </div>
                    <textarea
                      value={ensureText(gate.description)[locale]}
                      onChange={(event) =>
                        updateTrack(activeTrack.id, (track) => {
                          track.gates[gateIndex].description[locale] = event.target.value;
                        })
                      }
                      rows={4}
                      className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label>
                    <div className="mb-2 text-sm font-medium text-[var(--foreground)]">
                      {t("curriculum.fields.passStandard")}
                    </div>
                    <textarea
                      value={ensureText(gate.pass_standard)[locale]}
                      onChange={(event) =>
                        updateTrack(activeTrack.id, (track) => {
                          track.gates[gateIndex].pass_standard[locale] = event.target.value;
                        })
                      }
                      rows={3}
                      className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-[var(--foreground)]">
                    {t("curriculum.fields.commonQuestions")}
                  </div>
                  <div className="space-y-3">
                    {gate.common_questions.map((question, questionIndex) => (
                      <div key={`${gate.id}-question-${questionIndex}`} className="flex gap-3">
                        <textarea
                          value={ensureText(question)[locale]}
                          onChange={(event) =>
                            updateTrack(activeTrack.id, (track) => {
                              track.gates[gateIndex].common_questions[questionIndex][locale] =
                                event.target.value;
                            })
                          }
                          rows={2}
                          className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                        />
                        <button
                          onClick={() =>
                            updateTrack(activeTrack.id, (track) => {
                              track.gates[gateIndex].common_questions.splice(
                                questionIndex,
                                1,
                              );
                            })
                          }
                          className="self-start rounded-xl border border-red-300/70 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                        >
                          {t("curriculum.removeQuestion")}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      updateTrack(activeTrack.id, (track) => {
                        track.gates[gateIndex].common_questions.push({ zh: "", en: "" });
                      })
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--border)]/70 px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t("curriculum.addQuestion")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

"use client";

import { BookOpen, ExternalLink, Sparkles } from "lucide-react";
import type { KnowledgeGraph } from "@/lib/knowledge-graph";

type LocaleKey = "zh" | "en";

export const TRACK_DESCRIPTIONS: Record<string, { tagline: { zh: string; en: string }; outcome: { zh: string; en: string } }> = {
  seller: {
    tagline: {
      zh: "面向反淘卖家——找到能卖货的渠道路径",
      en: "For sellers — find proven sales-channel paths",
    },
    outcome: {
      zh: "学完后你能：判断哪些平台/KOL/渠道值得入驻 + 复盘自己的数据",
      en: "Outcome: judge which platforms/KOLs/channels to invest in + review your own data",
    },
  },
  operator: {
    tagline: {
      zh: "面向反淘平台——监控竞品、拦截渠道、设计后台",
      en: "For operators — monitor competitors, capture channels, design back-office",
    },
    outcome: {
      zh: "学完后你能：搭出平台 MVP + 制定渠道策略 + 设计收入模型",
      en: "Outcome: scaffold platform MVP + plan channel strategy + design revenue model",
    },
  },
};

const RECOMMENDED_RESOURCES = [
  {
    title: { zh: "反淘从 0 到 1：行业概览", en: "AntiTao 0→1 industry overview" },
    href: "https://xcn8pgdlg8x0.feishu.cn/wiki/RmmJwBcJjiM4mzks2z2cjyQvnFc",
    desc: { zh: "起源 / 市场规模 / 关键玩家", en: "Origins / size / key players" },
  },
  {
    title: { zh: "反向海淘淘金榜（实时数据）", en: "AntiTao Leaderboard" },
    href: "https://xcn8pgdlg8x0.feishu.cn/base/HBq8bRILLaGwNPssyxdcjFdkn4c",
    desc: { zh: "平台 / 工具 / 渠道实时排名", en: "Live ranking of platforms / tools / channels" },
  },
];

function t_progress(done: number, total: number, pct: number): string {
  return `${done}/${total} · ${pct}%`;
}

export function WelcomeStrip({
  graph,
  trackId,
  trackNodes,
  masteredIds,
  masteredCount,
  totalCount,
  locale,
  onPickTrack,
}: {
  graph: KnowledgeGraph;
  trackId: string;
  trackNodes: import("@/lib/knowledge-graph").GraphNode[];
  masteredIds: Set<string>;
  masteredCount: number;
  totalCount: number;
  locale: LocaleKey;
  onPickTrack: (id: string) => void;
}) {
  const pct = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100);
  const trackColor = graph.tracks.find((t) => t.id === trackId)?.color || "#1a73e8";
  const desc = TRACK_DESCRIPTIONS[trackId];

  const currentStepIndex = trackNodes.findIndex(
    (n) => !masteredIds.has(n.id) && n.prerequisites.every((p) => masteredIds.has(p)),
  );
  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : totalCount;
  const nextNode = currentStepIndex >= 0 ? trackNodes[currentStepIndex] : null;
  const allMastered = masteredCount >= totalCount && totalCount > 0;

  return (
    <div className="hidden border-b border-[var(--border)]/40 bg-[var(--secondary)]/15 px-5 py-2 md:block">
      <div className="flex items-center gap-3">
        {/* 双轨道选择卡 */}
        <div className="flex flex-1 gap-2 min-w-0">
          {graph.tracks.map((tr) => {
            const td = TRACK_DESCRIPTIONS[tr.id];
            const active = tr.id === trackId;
            return (
              <button
                key={tr.id}
                onClick={() => onPickTrack(tr.id)}
                className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-all min-w-0 ${
                  active
                    ? "border-[var(--primary)] bg-[var(--background)] shadow-sm"
                    : "border-[var(--border)]/40 bg-[var(--background)]/40 hover:border-[var(--border)]/80"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tr.color }}
                />
                <span className="text-xs font-semibold whitespace-nowrap">{tr.label[locale]}</span>
                {td && (
                  <span className="truncate text-[11px] text-[var(--muted-foreground)]">
                    {td.tagline[locale]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 路线图导引 */}
        <div className="hidden md:flex items-center gap-2 shrink-0 rounded-xl border border-[var(--border)]/40 bg-[var(--background)] px-3 py-1.5 min-w-0 max-w-xs">
          <Sparkles className="h-3 w-3 shrink-0 text-[var(--primary)]" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1.5 text-[11px]">
              {allMastered ? (
                <span className="font-semibold text-emerald-600">
                  {locale === "zh" ? "🎉 全部通关！" : "🎉 All mastered!"}
                </span>
              ) : (
                <>
                  <span className="font-semibold whitespace-nowrap">
                    {locale === "zh"
                      ? `第 ${currentStep}/${totalCount} 步`
                      : `Step ${currentStep}/${totalCount}`}
                  </span>
                  <span className="text-[var(--muted-foreground)]">
                    {t_progress(masteredCount, totalCount, pct)}
                  </span>
                </>
              )}
            </div>
            <div className="mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-[var(--secondary)]/50">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: trackColor }}
              />
            </div>
            {nextNode && (
              <div className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)] leading-4">
                {locale === "zh" ? "下一步：" : "Next: "}
                <span className="font-medium text-[var(--foreground)]">
                  {nextNode.title[locale]}
                </span>
              </div>
            )}
            {allMastered && desc && (
              <div className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)] leading-4">
                {desc.outcome[locale]}
              </div>
            )}
          </div>
        </div>

        {/* 资源下拉 */}
        <details className="hidden lg:block group relative shrink-0">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-[var(--border)]/40 bg-[var(--background)] px-3 py-2 text-xs hover:border-[var(--border)]/80">
            <BookOpen className="h-3 w-3 text-[var(--primary)]" />
            <span>{locale === "zh" ? "延伸阅读" : "Reading"}</span>
            <span className="text-[10px] text-[var(--muted-foreground)]">▾</span>
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1 w-[260px] rounded-xl border border-[var(--border)]/60 bg-[var(--background)] p-2 shadow-2xl">
            {RECOMMENDED_RESOURCES.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-lg p-2 text-xs hover:bg-[var(--secondary)]/40"
              >
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
                <div className="min-w-0">
                  <div className="font-semibold">{r.title[locale]}</div>
                  <div className="truncate text-[10px] text-[var(--muted-foreground)]">
                    {r.desc[locale]}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

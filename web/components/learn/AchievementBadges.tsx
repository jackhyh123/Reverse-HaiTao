"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, Loader2, Sparkles, X } from "lucide-react";
import { loadFromStorage, saveToStorage } from "@/lib/persistence";
import { getStreak } from "@/lib/learning-streak";

type LocaleKey = "zh" | "en";

interface BadgeDef {
  id: string;
  name: { zh: string; en: string };
  emoji: string;
  desc: { zh: string; en: string };
}

const ALL_BADGES: BadgeDef[] = [
  {
    id: "first-node",
    name: { zh: "入门学徒", en: "Apprentice" },
    emoji: "🌱",
    desc: { zh: "掌握第 1 个节点", en: "Master your first node" },
  },
  {
    id: "foundation-master",
    name: { zh: "基础达人", en: "Foundation Master" },
    emoji: "🏗️",
    desc: { zh: "6 个基础节点全部掌握", en: "Master all 6 foundation nodes" },
  },
  {
    id: "seller-pro",
    name: { zh: "卖家专家", en: "Seller Pro" },
    emoji: "💼",
    desc: { zh: "卖家赛道全部掌握", en: "Master the seller track" },
  },
  {
    id: "operator-pro",
    name: { zh: "运营专家", en: "Operator Pro" },
    emoji: "⚙️",
    desc: { zh: "运营赛道全部掌握", en: "Master the operator track" },
  },
  {
    id: "streak-3",
    name: { zh: "三日坚持", en: "3-Day Streak" },
    emoji: "🔥",
    desc: { zh: "连续学习 3 天", en: "Study 3 consecutive days" },
  },
  {
    id: "streak-7",
    name: { zh: "周冠军", en: "Weekly Champion" },
    emoji: "⭐",
    desc: { zh: "连续学习 7 天", en: "Study 7 consecutive days" },
  },
  {
    id: "note-taker",
    name: { zh: "笔记达人", en: "Note Taker" },
    emoji: "📝",
    desc: { zh: "3 个以上节点有笔记", en: "Notes on 3+ nodes" },
  },
  {
    id: "completionist",
    name: { zh: "全部通关", en: "Completionist" },
    emoji: "🏆",
    desc: { zh: "14 个节点全部掌握", en: "Master all 14 nodes" },
  },
];

const EARNED_KEY = "learn_badges_earned";

function getEarnedBadgeIds(): Set<string> {
  return new Set(loadFromStorage<string[]>(EARNED_KEY, []));
}

function markBadgeEarned(badgeId: string): void {
  const earned = getEarnedBadgeIds();
  earned.add(badgeId);
  saveToStorage(EARNED_KEY, Array.from(earned));
}

export function checkBadges(
  masteredCount: number,
  foundationMastered: boolean,
  sellerTrackMastered: boolean,
  operatorTrackMastered: boolean,
  allMastered: boolean,
  notesNodeCount: number,
): BadgeDef[] {
  const earned = getEarnedBadgeIds();
  const streak = getStreak();

  const newlyEarned: BadgeDef[] = [];

  const check = (badgeId: string, condition: boolean) => {
    if (condition && !earned.has(badgeId)) {
      const badge = ALL_BADGES.find((b) => b.id === badgeId);
      if (badge) {
        markBadgeEarned(badgeId);
        newlyEarned.push(badge);
      }
    }
  };

  check("first-node", masteredCount >= 1);
  check("foundation-master", foundationMastered);
  check("seller-pro", sellerTrackMastered);
  check("operator-pro", operatorTrackMastered);
  check("streak-3", streak.currentStreak >= 3);
  check("streak-7", streak.currentStreak >= 7);
  check("note-taker", notesNodeCount >= 3);
  check("completionist", allMastered);

  return newlyEarned;
}

function getBadgeById(id: string): BadgeDef | undefined {
  return ALL_BADGES.find((b) => b.id === id);
}

interface AchievementBadgesProps {
  locale: LocaleKey;
  masteredCount: number;
  foundationMastered: boolean;
  sellerTrackMastered: boolean;
  operatorTrackMastered: boolean;
  allMastered: boolean;
  notesNodeCount: number;
}

export default function AchievementBadges({
  locale,
  masteredCount,
  foundationMastered,
  sellerTrackMastered,
  operatorTrackMastered,
  allMastered,
  notesNodeCount,
}: AchievementBadgesProps) {
  const [open, setOpen] = useState(false);
  const [freshBadges, setFreshBadges] = useState<BadgeDef[]>([]);
  const earnedIds = useMemo(() => getEarnedBadgeIds(), [
    masteredCount, foundationMastered, sellerTrackMastered,
    operatorTrackMastered, allMastered, notesNodeCount,
  ]);

  useEffect(() => {
    const newly = checkBadges(
      masteredCount, foundationMastered, sellerTrackMastered,
      operatorTrackMastered, allMastered, notesNodeCount,
    );
    if (newly.length > 0) {
      setFreshBadges((prev) => [...prev, ...newly]);
      // Auto-dismiss each fresh badge after 5s
      const timers = newly.map((b) =>
        setTimeout(() => {
          setFreshBadges((prev) => prev.filter((fb) => fb.id !== b.id));
        }, 5000),
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [masteredCount, foundationMastered, sellerTrackMastered,
      operatorTrackMastered, allMastered, notesNodeCount]);

  const earned = ALL_BADGES.filter((b) => earnedIds.has(b.id));
  const notEarned = ALL_BADGES.filter((b) => !earnedIds.has(b.id));

  return (
    <>
      {/* Fresh badge toasts */}
      {freshBadges.map((badge) => (
        <div
          key={badge.id}
          className="fixed bottom-20 right-4 z-[70] animate-bounce-in flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 shadow-lg dark:bg-amber-950/30"
        >
          <span className="text-lg">{badge.emoji}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                {locale === "zh" ? "新徽章解锁！" : "New badge!"}
              </span>
            </div>
            <div className="text-sm font-semibold">{badge.name[locale]}</div>
          </div>
          <button
            onClick={() => setFreshBadges((prev) => prev.filter((fb) => fb.id !== badge.id))}
            className="ml-1 rounded p-0.5 text-amber-600 hover:text-amber-800"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Badge wall button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)]/60 px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40 hover:text-[var(--foreground)]"
        title={locale === "zh" ? "成就徽章" : "Badges"}
      >
        <Award className="h-3.5 w-3.5" />
        {earned.length}
      </button>

      {/* Badge wall modal */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {locale === "zh" ? "成就徽章" : "Achievement Badges"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Earned badges */}
            {earned.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">
                  {locale === "zh"
                    ? `已获得 ${earned.length} 个徽章`
                    : `${earned.length} badges earned`}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {earned.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 dark:bg-emerald-950/10"
                    >
                      <span className="text-xl">{badge.emoji}</span>
                      <div>
                        <div className="text-xs font-semibold">{badge.name[locale]}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)] leading-tight">
                          {badge.desc[locale]}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Not yet earned */}
            {notEarned.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">
                  {locale === "zh" ? "待解锁" : "To Unlock"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {notEarned.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center gap-2 rounded-xl border border-[var(--border)]/40 bg-[var(--secondary)]/10 p-2.5 opacity-50"
                    >
                      <span className="text-xl grayscale">{badge.emoji}</span>
                      <div>
                        <div className="text-xs font-semibold">{badge.name[locale]}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)] leading-tight">
                          {badge.desc[locale]}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {earned.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                {locale === "zh"
                  ? "开始学习以解锁徽章"
                  : "Start learning to unlock badges"}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

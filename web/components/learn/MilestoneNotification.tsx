"use client";

import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { loadFromStorage, saveToStorage } from "@/lib/persistence";

type LocaleKey = "zh" | "en";

export type MilestoneId =
  | "foundation-complete"
  | "seller-complete"
  | "operator-complete"
  | "all-complete";

export interface MilestoneDef {
  id: MilestoneId;
  title: { zh: string; en: string };
  message: { zh: string; en: string };
  emoji: string;
}

const MILESTONES: MilestoneDef[] = [
  {
    id: "foundation-complete",
    title: { zh: "基础通关！", en: "Foundation Complete!" },
    message: {
      zh: "你已掌握反淘核心概念体系，继续向卖家赛道进发吧！",
      en: "You've mastered the core anti-Tao concept system. On to the seller track!",
    },
    emoji: "🎉",
  },
  {
    id: "seller-complete",
    title: { zh: "卖家赛道通关！", en: "Seller Track Complete!" },
    message: {
      zh: "你已具备选品和出单的基础能力，可以尝试实操了！",
      en: "You can now select products and make sales. Time to practice!",
    },
    emoji: "🚀",
  },
  {
    id: "operator-complete",
    title: { zh: "运营赛道通关！", en: "Operator Track Complete!" },
    message: {
      zh: "你已能搭建和运营反向海淘平台的核心模块。",
      en: "You can now build and run core modules of an anti-Tao platform.",
    },
    emoji: "⚙️",
  },
  {
    id: "all-complete",
    title: { zh: "全栈反淘达人！", en: "Full-Stack Anti-Tao Expert!" },
    message: {
      zh: "恭喜！你已掌握从选品到平台运营的完整知识体系。",
      en: "Congratulations! You've mastered the complete system from sourcing to platform operations.",
    },
    emoji: "🏆",
  },
];

const DISMISSED_KEY = "learn_milestones_dismissed";

function getDismissedMilestones(): Set<string> {
  return new Set(loadFromStorage<string[]>(DISMISSED_KEY, []));
}

function dismissMilestone(id: string): void {
  const dismissed = getDismissedMilestones();
  dismissed.add(id);
  saveToStorage(DISMISSED_KEY, Array.from(dismissed));
}

export function detectMilestones(
  foundationIds: string[],
  sellerIds: string[],
  operatorIds: string[],
  allNodeIds: string[],
  masteredIds: Set<string>,
): MilestoneDef[] {
  const dismissed = getDismissedMilestones();

  const foundationMastered = foundationIds.every((id) => masteredIds.has(id));
  const sellerMastered = sellerIds.every((id) => masteredIds.has(id));
  const operatorMastered = operatorIds.every((id) => masteredIds.has(id));
  const allMastered = allNodeIds.every((id) => masteredIds.has(id));

  const results: MilestoneDef[] = [];

  if (allMastered && !dismissed.has("all-complete")) {
    results.push(MILESTONES.find((m) => m.id === "all-complete")!);
  }
  if (operatorMastered && !dismissed.has("operator-complete")) {
    results.push(MILESTONES.find((m) => m.id === "operator-complete")!);
  }
  if (sellerMastered && !dismissed.has("seller-complete")) {
    results.push(MILESTONES.find((m) => m.id === "seller-complete")!);
  }
  if (foundationMastered && !dismissed.has("foundation-complete")) {
    results.push(MILESTONES.find((m) => m.id === "foundation-complete")!);
  }

  return results;
}

interface MilestoneNotificationProps {
  milestone: MilestoneDef;
  locale: LocaleKey;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function MilestoneToast({
  milestone,
  locale,
  onDismiss,
  autoDismissMs = 8000,
}: MilestoneNotificationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        dismissMilestone(milestone.id);
        onDismiss();
      }, 400);
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [milestone.id, autoDismissMs, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    dismissMilestone(milestone.id);
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      className={`fixed right-4 z-[70] transition-all duration-400 ${
        visible
          ? "top-4 translate-y-0 opacity-100"
          : "-top-20 -translate-y-full opacity-0"
      }`}
    >
      <div className="flex w-80 items-start gap-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] p-4 shadow-2xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-xl shadow-sm">
          {milestone.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{milestone.title[locale]}</div>
          <div className="mt-0.5 text-xs leading-5 text-[var(--muted-foreground)]">
            {milestone.message[locale]}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

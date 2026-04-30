"use client";

import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppShell } from "@/context/AppShellContext";

export default function GlobalLanguageToggle() {
  const { t } = useTranslation();
  const { language, setLanguage } = useAppShell();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)]/70 bg-[var(--secondary)]/75 p-1 shadow-lg shadow-black/10 backdrop-blur">
      <div className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)]">
        <Languages size={15} />
      </div>
      {(["zh", "en"] as const).map((code) => {
        const active = language === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/70 hover:text-[var(--foreground)]"
            }`}
            aria-pressed={active}
          >
            {code === "zh" ? t("language.chinese") : t("language.english")}
          </button>
        );
      })}
    </div>
  );
}

import { Suspense } from "react";
import LearnPageClient from "./LearnPageClient";

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)]" />
          加载中…
        </div>
      }
    >
      <LearnPageClient />
    </Suspense>
  );
}

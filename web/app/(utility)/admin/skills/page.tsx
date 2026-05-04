"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Admin Skills page.
 * Redirects to /knowledge?tab=skills for the full Skills management UI.
 */
export default function AdminSkillsPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/knowledge?tab=skills");
  }, [router]);
  
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
    </div>
  );
}

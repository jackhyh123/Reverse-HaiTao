"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Admin Knowledge Bases page.
 * Redirects to /knowledge?tab=knowledge for the full KB management UI.
 * The /knowledge page is only accessible to logged-in users; 
 * non-admin users are redirected to /learn by the page itself.
 */
export default function AdminKnowledgeBasesPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/knowledge?tab=knowledge");
  }, [router]);
  
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
    </div>
  );
}

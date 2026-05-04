import WorkspaceSidebar from "@/components/sidebar/WorkspaceSidebar";
import { UnifiedChatProvider } from "@/context/UnifiedChatContext";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <UnifiedChatProvider>
      <div className="flex h-[100dvh] overflow-hidden md:h-screen">
        <div className="hidden md:block">
          <WorkspaceSidebar />
        </div>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </UnifiedChatProvider>
  );
}

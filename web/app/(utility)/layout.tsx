import UtilitySidebar from "@/components/sidebar/UtilitySidebar";

export default function UtilityLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-[100dvh] md:h-screen">
      <div className="hidden md:block">
        <UtilitySidebar />
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--background)]" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="min-h-0 flex-1">{children}</div>
      </main>
    </div>
  );
}

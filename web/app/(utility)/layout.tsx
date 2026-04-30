import UtilitySidebar from "@/components/sidebar/UtilitySidebar";
import MobileUtilityNav from "@/components/sidebar/MobileUtilityNav";

export default function UtilityLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-[100dvh] overflow-hidden md:h-screen">
      <div className="hidden md:block">
        <UtilitySidebar />
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
        <MobileUtilityNav />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}

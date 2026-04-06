import { MobileNav } from "@/components/layout/mobile-nav";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto pb-16">{children}</main>
      <MobileNav variant="coach" />
    </div>
  );
}

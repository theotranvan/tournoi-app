import { MobileNav } from "@/components/layout/mobile-nav";
import { PushPrompt } from "@/components/pwa/push-prompt";

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16">{children}</main>
      <MobileNav variant="coach" />
      <PushPrompt />
    </div>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PendingScoresBadge } from "@/components/pwa/pending-scores-badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useAuthStore } from "@/stores/auth-store";

const emptySubscribe = () => () => {};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const isLoginPage = pathname === "/admin/login";
  const isRegisterPage = pathname === "/admin/register";
  const isAuthPage = isLoginPage || isRegisterPage;

  useEffect(() => {
    if (mounted && !isAuthenticated && !isAuthPage) {
      router.replace("/admin/login");
    }
  }, [mounted, isAuthenticated, isAuthPage, router]);

  // Auth pages render without the sidebar/nav chrome
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Block rendering until mounted and auth is confirmed
  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex h-full">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PendingScoresBadge />
        <Breadcrumb />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">{children}</main>
      </div>
      <MobileNav variant="admin" />
    </div>
  );
}

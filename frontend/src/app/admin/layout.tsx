"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
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

  useEffect(() => {
    if (mounted && !isAuthenticated && !isLoginPage) {
      router.replace("/admin/login");
    }
  }, [mounted, isAuthenticated, isLoginPage, router]);

  // Login page renders without the sidebar/nav chrome
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Block rendering until mounted and auth is confirmed
  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex h-full">
      <DesktopSidebar />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      <MobileNav variant="admin" />
    </div>
  );
}

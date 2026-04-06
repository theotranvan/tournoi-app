"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Home,
  Calendar,
  Trophy,
  Settings,
  Users,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { NotificationBell } from "@/components/ui/notification-bell";

interface SidebarLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const sidebarSections: { title: string; links: SidebarLink[] }[] = [
  {
    title: "Général",
    links: [
      { href: "/admin", label: "Tableau de bord", icon: Home },
    ],
  },
  {
    title: "Gestion",
    links: [
      { href: "/admin/tournois", label: "Tournois", icon: Trophy },
      { href: "/admin/equipes", label: "Équipes", icon: Users },
      { href: "/admin/planning", label: "Planning", icon: Calendar },
      { href: "/admin/terrains", label: "Terrains", icon: LayoutGrid },
    ],
  },
  {
    title: "Système",
    links: [
      { href: "/admin/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

interface DesktopSidebarProps {
  className?: string;
}

export function DesktopSidebar({ className }: DesktopSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
        className
      )}
      aria-label="Navigation principale"
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">⚽</span>
            <span className="text-base font-semibold">Kickoff</span>
          </Link>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && <NotificationBell />}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(collapsed && "mx-auto")}
            aria-label={collapsed ? "Développer la barre latérale" : "Réduire la barre latérale"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? link.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <link.icon className="size-4 shrink-0" />
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Calendar,
  Trophy,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const coachNavItems: NavItem[] = [
  { href: "/coach", label: "Accueil", icon: Home },
  { href: "/coach/matches", label: "Matchs", icon: Calendar },
  { href: "/coach/classements", label: "Classements", icon: Trophy },
  { href: "/coach/parametres", label: "Réglages", icon: Settings },
];

const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: Home },
  { href: "/admin/planning", label: "Planning", icon: Calendar },
  { href: "/admin/tournois", label: "Tournois", icon: Trophy },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

interface MobileNavProps {
  variant?: "coach" | "admin";
  className?: string;
}

export function MobileNav({ variant = "coach", className }: MobileNavProps) {
  const pathname = usePathname();
  const items = variant === "admin" ? adminNavItems : coachNavItems;

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-safe md:hidden",
        className
      )}
      aria-label="Navigation principale"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-14 rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="size-5" aria-hidden="true" />
              <span className="text-[0.6rem] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

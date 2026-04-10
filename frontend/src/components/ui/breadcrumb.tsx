"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  admin: "Tableau de bord",
  tournois: "Tournois",
  new: "Nouveau",
  equipes: "Équipes",
  planning: "Planning",
  terrains: "Terrains",
  parametres: "Paramètres",
  abonnement: "Abonnement",
  insights: "Statistiques",
  simulator: "Simulateur",
  print: "Impression",
  match: "Match",
  score: "Score",
  settings: "Paramètres",
  speaker: "Mode speaker",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs: { label: string; href: string }[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;

    // Skip UUID-like or numeric IDs in display but keep in path
    const isId = /^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg);
    if (isId) continue;

    const label = ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({ label, href: currentPath });
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-muted-foreground px-4 md:px-6 pt-3 pb-1"
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {idx > 0 && <ChevronRight className="size-3 shrink-0" />}
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {idx === 0 ? (
                  <Home className="size-3.5" />
                ) : (
                  crumb.label
                )}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

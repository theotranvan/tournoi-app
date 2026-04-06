"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";

type MatchStatus = "live" | "scheduled" | "finished" | "cancelled" | "postponed";

const statusConfig: Record<
  MatchStatus,
  { label: string; className: string; dot?: boolean; pulse?: boolean }
> = {
  live: {
    label: "EN DIRECT",
    className: "bg-live/20 text-red-400 border-live/40",
    dot: true,
    pulse: true,
  },
  scheduled: {
    label: "Programmé",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  },
  finished: {
    label: "Terminé",
    className: "bg-muted text-muted-foreground border-border",
  },
  cancelled: {
    label: "Annulé",
    className: "bg-destructive/20 text-destructive border-destructive/40",
  },
  postponed: {
    label: "Reporté",
    className: "bg-warning/20 text-yellow-400 border-warning/40",
  },
};

interface StatusBadgeProps {
  status: MatchStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-[0.65rem] uppercase tracking-wider font-semibold",
        config.className,
        className
      )}
    >
      {config.dot && (
        <Circle
          className={cn(
            "size-1.5 fill-current",
            config.pulse && "animate-pulse-live"
          )}
        />
      )}
      {config.label}
    </Badge>
  );
}

export type { MatchStatus };

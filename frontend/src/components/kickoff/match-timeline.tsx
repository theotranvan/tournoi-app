"use client";

import { cn } from "@/lib/utils";
import type { Goal } from "@/types/api";

interface MatchTimelineProps {
  goals: Goal[];
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeamName: string;
  awayTeamName: string;
  className?: string;
}

export function MatchTimeline({
  goals,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  className,
}: MatchTimelineProps) {
  if (goals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Aucun but enregistré
      </p>
    );
  }

  const sorted = [...goals].sort((a, b) => (a.minute ?? 99) - (b.minute ?? 99));

  return (
    <div className={cn("space-y-2", className)}>
      {sorted.map((goal) => {
        const isHome = goal.team === homeTeamId;
        const teamName = isHome ? homeTeamName : awayTeamName;

        return (
          <div
            key={goal.id}
            className={cn(
              "flex items-center gap-3 text-sm",
              isHome ? "flex-row" : "flex-row-reverse"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2 flex-1",
                isHome ? "text-left" : "text-right justify-end"
              )}
            >
              <span className="font-medium">{goal.player_name || teamName}</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-lg">⚽</span>
              {goal.minute != null && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {goal.minute}&apos;
                </span>
              )}
            </div>

            <div className="flex-1" />
          </div>
        );
      })}
    </div>
  );
}

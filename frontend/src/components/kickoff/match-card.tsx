"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type MatchStatus } from "./status-badge";
import { CategoryBadge, type CategoryAge } from "./category-badge";
import { ScoreDisplay } from "./score-display";
import { CountdownTimer } from "./countdown-timer";
import { MapPin } from "lucide-react";

interface TeamInfo {
  name: string;
  logo?: string;
}

interface MatchCardProps {
  status: MatchStatus;
  homeTeam: TeamInfo | null;
  awayTeam: TeamInfo | null;
  homeScore?: number;
  awayScore?: number;
  category?: CategoryAge | string;
  field?: string;
  kickoffTime?: string | Date;
  phase?: string;
  group?: string;
  matchNumber?: number;
  className?: string;
  onClick?: () => void;
}

function TeamName({
  team,
  placeholder,
}: {
  team: TeamInfo | null;
  placeholder?: string;
}) {
  if (!team) {
    return (
      <span className="text-sm text-muted-foreground italic truncate">
        {placeholder ?? "À déterminer"}
      </span>
    );
  }
  return <span className="text-sm font-medium truncate">{team.name}</span>;
}

export function MatchCard({
  status,
  homeTeam,
  awayTeam,
  homeScore = 0,
  awayScore = 0,
  category,
  field,
  kickoffTime,
  phase,
  group,
  matchNumber,
  className,
  onClick,
}: MatchCardProps) {
  const isLive = status === "live";
  const isFinished = status === "finished";
  const showScore = isLive || isFinished;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:ring-primary/30 card-hover",
        isLive && "ring-live/50 bg-live/5",
        className
      )}
      size="sm"
      onClick={onClick}
    >
      <CardContent className="space-y-2">
        {/* Header row: status + category + meta */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {category && <CategoryBadge category={category} />}
          </div>
          <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
            {matchNumber != null && <span>#{matchNumber}</span>}
            {group && <span>{group}</span>}
            {phase && <span className="uppercase">{phase}</span>}
          </div>
        </div>

        {/* Match body: teams + score */}
        <div className="flex items-center gap-3">
          {/* Home team */}
          <div className="flex-1 text-right">
            <TeamName team={homeTeam} placeholder="Équipe A" />
          </div>

          {/* Score / VS */}
          <div className="flex items-center gap-1 shrink-0">
            {showScore ? (
              <>
                <ScoreDisplay
                  score={homeScore}
                  size="sm"
                  className={cn(
                    isLive && "text-foreground",
                    isFinished && "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-lg font-light mx-1",
                    isLive ? "text-live" : "text-muted-foreground"
                  )}
                >
                  –
                </span>
                <ScoreDisplay
                  score={awayScore}
                  size="sm"
                  className={cn(
                    isLive && "text-foreground",
                    isFinished && "text-muted-foreground"
                  )}
                />
              </>
            ) : (
              <span className="text-lg font-light text-muted-foreground px-2">
                VS
              </span>
            )}
          </div>

          {/* Away team */}
          <div className="flex-1 text-left">
            <TeamName team={awayTeam} placeholder="Équipe B" />
          </div>
        </div>

        {/* Footer: field + time */}
        <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
          {field && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {field}
            </span>
          )}
          {kickoffTime && !isFinished && (
            <CountdownTimer kickoffTime={kickoffTime} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

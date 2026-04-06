"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar } from "lucide-react";
import { useCoachStore } from "@/stores/coach-store";
import { useMatches } from "@/hooks/use-matches";
import type { MatchList } from "@/types/api";

const PHASE_LABEL: Record<string, string> = {
  group: "Poule",
  r16: "8e",
  quarter: "Quart",
  semi: "Demi",
  third: "3e place",
  final: "Finale",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MatchRow({ match, teamId }: { match: MatchList; teamId: number }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasScore = match.score_home !== null && match.score_away !== null;

  const isHome = match.team_home === teamId;
  const won =
    isFinished &&
    hasScore &&
    ((isHome && match.score_home! > match.score_away!) ||
      (!isHome && match.score_away! > match.score_home!));
  const lost =
    isFinished &&
    hasScore &&
    ((isHome && match.score_home! < match.score_away!) ||
      (!isHome && match.score_away! < match.score_home!));

  return (
    <Card
      className={
        isLive
          ? "ring-red-500/30 bg-red-500/5"
          : isFinished
            ? "opacity-75"
            : ""
      }
    >
      <CardContent className="py-3 space-y-2">
        {/* Top row: time + badges */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatTime(match.start_time)}
          </span>
          <div className="flex items-center gap-1.5">
            {match.phase !== "group" && (
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {PHASE_LABEL[match.phase] ?? match.phase}
              </Badge>
            )}
            {isLive && <LiveIndicator size="sm" />}
            {isFinished && (
              <Badge
                variant={won ? "default" : lost ? "destructive" : "secondary"}
                className="text-[9px] h-4 px-1.5"
              >
                {won ? "V" : lost ? "D" : "N"}
              </Badge>
            )}
          </div>
        </div>

        {/* Teams + score */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <TeamAvatar name={match.display_home || "?"} size="sm" />
            <span
              className={`flex-1 text-sm truncate ${
                match.team_home === teamId ? "font-bold" : "font-medium"
              }`}
            >
              {match.display_home}
            </span>
            {hasScore && (
              <span className="text-lg font-bold tabular-nums">{match.score_home}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TeamAvatar name={match.display_away || "?"} size="sm" />
            <span
              className={`flex-1 text-sm truncate ${
                match.team_away === teamId ? "font-bold" : "font-medium"
              }`}
            >
              {match.display_away}
            </span>
            {hasScore && (
              <span className="text-lg font-bold tabular-nums">{match.score_away}</span>
            )}
          </div>
        </div>

        {/* Footer: field */}
        {match.field_name && (
          <p className="text-[10px] text-muted-foreground">{match.field_name}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function CoachMatches() {
  const router = useRouter();
  const team = useCoachStore((s) => s.team);

  useEffect(() => {
    if (!team) router.replace("/coach/acces");
  }, [team, router]);

  const tournamentId = team?.tournament.id ?? "";
  const { data, isLoading } = useMatches(tournamentId);

  const groupedByDay = useMemo(() => {
    const all = data?.results ?? [];
    const teamMatches = all
      .filter((m) => m.team_home === team?.id || m.team_away === team?.id)
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

    const byDay: Record<string, MatchList[]> = {};
    for (const m of teamMatches) {
      const day = new Date(m.start_time).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      (byDay[day] ??= []).push(m);
    }
    return byDay;
  }, [data, team?.id]);

  if (!team) return null;

  const days = Object.keys(groupedByDay);

  return (
    <div className="p-4 space-y-4 pb-safe">
      <h1 className="text-xl font-bold">Matchs</h1>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : days.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Aucun match"
          description="Le planning n'est pas encore disponible pour votre équipe."
        />
      ) : (
        days.map((day) => (
          <section key={day}>
            <p className="text-sm font-semibold mb-2 capitalize sticky top-0 bg-background py-1 z-10">
              {day}
            </p>
            <div className="space-y-2">
              {groupedByDay[day].map((m) => (
                <MatchRow key={m.id} match={m} teamId={team.id} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

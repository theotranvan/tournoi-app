"use client";

import { use, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchedule } from "@/hooks/use-schedule";
import { useTournamentSocket } from "@/hooks/use-tournament-socket";
import type { MatchList, MatchStatus } from "@/types/api";

const STATUS_COLOR: Record<MatchStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  live: "bg-green-500/10 text-green-400 border-green-500/30",
  finished: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
  postponed: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FieldDisplayPage({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}) {
  const { fieldId } = use(params);
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("t") ?? "";
  const slug = searchParams.get("slug") ?? "";

  // Subscribe to WebSocket for live updates
  useTournamentSocket(slug);

  const { data: schedule, isLoading } = useSchedule(tournamentId);

  // Extract matches for this field
  const { fieldName, matches } = useMemo(() => {
    if (!schedule) return { fieldName: "", matches: [] as MatchList[] };
    const fId = Number(fieldId);
    let name = "";
    const all: MatchList[] = [];
    for (const day of schedule) {
      for (const fs of day.fields) {
        if (fs.field.id === fId) {
          name = fs.field.name;
          all.push(...fs.matches);
        }
      }
    }
    all.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    return { fieldName: name, matches: all };
  }, [schedule, fieldId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-3xl rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {fieldName || `Terrain ${fieldId}`}
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          {matches.length} match{matches.length > 1 ? "s" : ""} programmé
          {matches.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Match list — big format */}
      <div className="max-w-3xl mx-auto space-y-3">
        {matches.map((match) => {
          const isLive = match.status === "live";
          const hasScore =
            match.score_home !== null && match.score_away !== null;

          return (
            <div
              key={match.id}
              className={`rounded-2xl border-2 p-5 md:p-6 transition-all ${STATUS_COLOR[match.status]} ${
                isLive ? "animate-pulse border-green-500/50" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isLive && <LiveIndicator size="sm" />}
                  <span className="text-lg font-medium tabular-nums">
                    {formatTime(match.start_time)}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-sm px-2 py-0.5"
                >
                  {match.category_name}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xl md:text-2xl font-bold">
                <span className="flex-1 text-right truncate pr-4">
                  {match.display_home}
                </span>
                {hasScore ? (
                  <span className="text-3xl md:text-4xl tabular-nums font-black px-4">
                    {match.score_home} — {match.score_away}
                  </span>
                ) : (
                  <span className="text-2xl text-muted-foreground px-4">
                    vs
                  </span>
                )}
                <span className="flex-1 truncate pl-4">
                  {match.display_away}
                </span>
              </div>

              <div className="text-sm text-muted-foreground mt-2 text-center">
                {match.duration_minutes} min
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

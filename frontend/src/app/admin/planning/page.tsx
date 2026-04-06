"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Calendar,
  Loader2,
  AlertTriangle,
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import { useSchedule, useScheduleConflicts } from "@/hooks/use-schedule";
import { useGenerateSchedule } from "@/hooks/use-mutations";
import { FeasibilityPanel } from "@/components/planning/feasibility-panel";
import { DiagnosticsPanel } from "@/components/planning/diagnostics-panel";
import type { MatchList, MatchStatus, MatchPhase, ScheduleDay } from "@/types/api";

const STATUS_COLOR: Record<MatchStatus, string> = {
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  live: "bg-green-500/20 text-green-400 border-green-500/30",
  finished: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  postponed: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const PHASE_LABEL: Record<MatchPhase, string> = {
  group: "Poule",
  r16: "1/8",
  quarter: "1/4",
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

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Match Cell ─────────────────────────────────────────────────────────────

function MatchCell({
  match,
  tournamentId,
}: {
  match: MatchList;
  tournamentId: string;
}) {
  const hasScore = match.score_home !== null && match.score_away !== null;
  const isLive = match.status === "live";

  return (
    <Link
      href={`/admin/match/${match.id}/score?t=${tournamentId}`}
      className={`block rounded-lg border p-2.5 text-xs transition-colors hover:ring-1 hover:ring-primary/40 ${STATUS_COLOR[match.status]}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {isLive && <LiveIndicator size="sm" />}
          <span className="font-medium truncate">
            {formatTime(match.start_time)}
          </span>
        </div>
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 h-4 shrink-0"
        >
          {PHASE_LABEL[match.phase]}
        </Badge>
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="truncate">{match.display_home}</span>
          {hasScore && (
            <span className="font-bold ml-1">{match.score_home}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate">{match.display_away}</span>
          {hasScore && (
            <span className="font-bold ml-1">{match.score_away}</span>
          )}
        </div>
      </div>
      <div className="text-[9px] opacity-70 mt-1">
        {match.category_name} • {match.duration_minutes}min
      </div>
    </Link>
  );
}

// ─── Day Grid ───────────────────────────────────────────────────────────────

function DayGrid({
  day,
  tournamentId,
}: {
  day: ScheduleDay;
  tournamentId: string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold capitalize">
        {formatDateLabel(day.date)}
      </h3>

      {day.fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun match programmé ce jour.
        </p>
      ) : (
        <div className="grid gap-4" style={{
          gridTemplateColumns: `repeat(${Math.min(day.fields.length, 6)}, minmax(180px, 1fr))`,
        }}>
          {day.fields.map((fieldSlot) => (
            <div key={fieldSlot.field.id} className="space-y-2">
              <div className="text-sm font-medium text-center py-1.5 bg-muted rounded-lg">
                {fieldSlot.field.name}
              </div>
              <div className="space-y-1.5">
                {fieldSlot.matches.map((match) => (
                  <MatchCell
                    key={match.id}
                    match={match}
                    tournamentId={tournamentId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminPlanning() {
  const { data: tournamentsData, isLoading: tournamentsLoading } =
    useTournaments();
  const tournaments = tournamentsData?.results ?? [];
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [dayIndex, setDayIndex] = useState(0);

  // Auto-select first active tournament
  const activeTournaments = tournaments.filter(
    (t) => t.status !== "archived" && t.status !== "finished"
  );
  if (!selectedTournament && activeTournaments.length > 0) {
    setSelectedTournament(activeTournaments[0].id);
  }

  const { data: schedule, isLoading: scheduleLoading } =
    useSchedule(selectedTournament);
  const { data: conflicts } = useScheduleConflicts(selectedTournament);
  const generateMut = useGenerateSchedule(selectedTournament);

  const days = schedule ?? [];
  const currentDay = days[dayIndex];

  const totalMatches = days.reduce(
    (sum, d) =>
      sum + d.fields.reduce((s, f) => s + f.matches.length, 0),
    0
  );
  const liveMatches = days.reduce(
    (sum, d) =>
      sum +
      d.fields.reduce(
        (s, f) => s + f.matches.filter((m) => m.status === "live").length,
        0
      ),
    0
  );

  return (
    <div className="p-4 md:p-6 space-y-6 pb-safe">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="size-6" />
            Planning
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualisez et gérez le planning des matchs
          </p>
        </div>
        {!!selectedTournament && (
          <div className="flex gap-2">
            <DiagnosticsPanel tournamentId={selectedTournament} />
            <Button
              onClick={() => generateMut.mutate({ async: true })}
              disabled={generateMut.isPending}
            >
              {generateMut.isPending ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Zap className="size-4 mr-1" />
              )}
              Générer le planning
            </Button>
          </div>
        )}
      </div>

      {/* Tournament picker */}
      {tournamentsLoading ? (
        <Skeleton className="h-9 w-64" />
      ) : (
        <Select
          value={String(selectedTournament)}
          onChange={(e) => {
            setSelectedTournament(e.target.value);
            setDayIndex(0);
          }}
          options={tournaments.map((t) => ({
            value: String(t.id),
            label: `${t.name} (${t.status})`,
          }))}
          placeholder="Sélectionner un tournoi"
          className="max-w-sm"
        />
      )}

      {!!selectedTournament && (
        <>
          {/* Feasibility analysis */}
          <FeasibilityPanel tournamentId={selectedTournament} />

          {/* Stats bar */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-blue-400" />
              {totalMatches} match{totalMatches !== 1 ? "s" : ""} programmé
              {totalMatches !== 1 ? "s" : ""}
            </span>
            {liveMatches > 0 && (
              <span className="flex items-center gap-1.5 text-green-400">
                <span className="size-2 rounded-full bg-green-400 animate-pulse" />
                {liveMatches} en cours
              </span>
            )}
            {conflicts && conflicts.length > 0 && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="size-3.5" />
                {conflicts.length} conflit{conflicts.length !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-muted-foreground">
              {days.length} jour{days.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Conflicts detail */}
          {conflicts && conflicts.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="size-4" />
                  Conflits détectés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {conflicts.slice(0, 8).map((c) => (
                    <li key={`${c.match_id}-${c.type}`}>
                      <span className="font-medium text-foreground">
                        Match #{c.match_id}
                      </span>{" "}
                      — {c.detail}
                    </li>
                  ))}
                  {conflicts.length > 8 && (
                    <li className="text-muted-foreground">
                      … et {conflicts.length - 8} autre(s)
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Schedule grid */}
          {scheduleLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : days.length > 0 ? (
            <div className="space-y-4">
              {/* Day navigation */}
              {days.length > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setDayIndex(Math.max(0, dayIndex - 1))}
                    disabled={dayIndex === 0}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <div className="flex gap-1">
                    {days.map((d, i) => (
                      <Button
                        key={d.date}
                        variant={i === dayIndex ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDayIndex(i)}
                        className="text-xs"
                      >
                        J{i + 1}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() =>
                      setDayIndex(Math.min(days.length - 1, dayIndex + 1))
                    }
                    disabled={dayIndex === days.length - 1}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}

              {/* Day content */}
              {currentDay && (
                <div className="overflow-x-auto">
                  <DayGrid
                    day={currentDay}
                    tournamentId={selectedTournament}
                  />
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="Aucun planning généré"
              description="Générez le planning pour ce tournoi pour commencer."
              action={
                <Button
                  onClick={() => generateMut.mutate({ async: true })}
                  disabled={generateMut.isPending}
                >
                  {generateMut.isPending ? (
                    <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : (
                    <Zap className="size-4 mr-1" />
                  )}
                  Générer le planning
                </Button>
              }
            />
          )}

          {/* Generate success/error feedback */}
          {generateMut.isSuccess && (
            <p className="text-sm text-green-500">
              Génération lancée. Le planning sera mis à jour automatiquement.
            </p>
          )}
          {generateMut.isError && (
            <p className="text-sm text-destructive">
              Erreur lors de la génération du planning.
            </p>
          )}
        </>
      )}
    </div>
  );
}

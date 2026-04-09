"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Calendar,
  Loader2,
  AlertTriangle,
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { useTournaments } from "@/hooks/use-tournaments";
import { useSchedule, useScheduleConflicts } from "@/hooks/use-schedule";
import { useGenerateSchedule } from "@/hooks/use-mutations";
import { useCategories } from "@/hooks/use-categories";
import { useFields } from "@/hooks/use-fields";
import { useTeams } from "@/hooks/use-teams";
import { FeasibilityPanel } from "@/components/planning/feasibility-panel";
import { DiagnosticsPanel } from "@/components/planning/diagnostics-panel";
import { PlanningGrid } from "@/components/planning/planning-grid";
import {
  PlanningFiltersBar,
  EMPTY_FILTERS,
  type PlanningFilters,
} from "@/components/planning/planning-filters";
import { TeamJourney } from "@/components/planning/team-journey";
import { BriefingMode } from "@/components/planning/briefing-mode";
import { PlanningExport } from "@/components/planning/planning-export";
import { detectConflicts } from "@/lib/conflict-detection";
import { api, getApiErrorMessage } from "@/lib/api";
import { matchKeys } from "@/hooks/use-matches";
import { scheduleKeys } from "@/hooks/use-schedule";
import type { MatchList, ScheduleDay } from "@/types/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminPlanning() {
  const qc = useQueryClient();
  const { data: tournamentsData, isLoading: tournamentsLoading } =
    useTournaments();
  const tournaments = tournamentsData?.results ?? [];
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [dayIndex, setDayIndex] = useState(0);
  const [filters, setFilters] = useState<PlanningFilters>(EMPTY_FILTERS);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [conflictDialog, setConflictDialog] = useState<{
    matchId: string;
    fieldId: number;
    startTime: string;
    conflictTeam: string;
  } | null>(null);

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
  const { data: categories } = useCategories(selectedTournament);
  const { data: fieldsData } = useFields(selectedTournament);
  const { data: teamsData } = useTeams(selectedTournament);
  const generateMut = useGenerateSchedule(selectedTournament);
  const generateErrorMessage = generateMut.isError
    ? getApiErrorMessage(
        generateMut.error,
        "Erreur lors de la génération du planning."
      )
    : null;

  const days = schedule ?? [];
  const currentDay = days[dayIndex];
  const serverConflicts = conflicts ?? [];

  // ─── Flat matches ───────────────────────────────────────────────────────
  const allMatches = useMemo(() => {
    const matches: MatchList[] = [];
    for (const day of days) {
      for (const fs of day.fields) {
        matches.push(...fs.matches);
      }
    }
    return matches;
  }, [days]);

  // ─── Client-side conflict detection ─────────────────────────────────────
  const clientConflicts = useMemo(
    () => detectConflicts(days),
    [days]
  );
  const conflictMatchIds = useMemo(
    () => new Set(clientConflicts.map((c) => c.matchId)),
    [clientConflicts]
  );

  // ─── Team names for filter ─────────────────────────────────────────────
  const teamNames = useMemo(() => {
    const names = new Set<string>();
    for (const m of allMatches) {
      if (m.display_home) names.add(m.display_home);
      if (m.display_away) names.add(m.display_away);
    }
    return Array.from(names).sort();
  }, [allMatches]);

  // ─── Filter logic: grayed out match IDs ────────────────────────────────
  const grayedOutMatchIds = useMemo(() => {
    const hasFilter = Object.values(filters).some((v) => v !== "");
    if (!hasFilter) return new Set<string>();

    const grayedOut = new Set<string>();
    for (const m of allMatches) {
      let matches = true;

      if (filters.category && String(m.category) !== filters.category)
        matches = false;
      if (filters.field && String(m.field) !== filters.field) matches = false;
      if (filters.phase && m.phase !== filters.phase) matches = false;
      if (filters.status && m.status !== filters.status) matches = false;
      if (
        filters.team &&
        m.display_home !== filters.team &&
        m.display_away !== filters.team
      )
        matches = false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const text =
          `${m.display_home} ${m.display_away} ${m.category_name}`.toLowerCase();
        if (!text.includes(q)) matches = false;
      }

      if (!matches) grayedOut.add(m.id);
    }
    return grayedOut;
  }, [filters, allMatches]);

  // ─── Stats ─────────────────────────────────────────────────────────────
  const totalMatches = allMatches.length;
  const liveMatches = allMatches.filter((m) => m.status === "live").length;

  // ─── Invalidation helper ──────────────────────────────────────────────
  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: scheduleKeys.list(selectedTournament) });
    qc.invalidateQueries({ queryKey: matchKeys.list(selectedTournament) });
    qc.invalidateQueries({ queryKey: scheduleKeys.conflicts(selectedTournament) });
  }, [qc, selectedTournament]);

  // ─── Drag & drop handlers ─────────────────────────────────────────────
  const handleMoveMatch = useCallback(
    async (matchId: string, fieldId: number, startTime: string) => {
      try {
        await api.patch(`/tournaments/${selectedTournament}/matches/${matchId}/`, {
          field: fieldId,
          start_time: startTime,
        });
        toast.success("Match déplacé !");
        invalidateAll();
      } catch {
        toast.error("Erreur lors du déplacement.");
      }
    },
    [selectedTournament, invalidateAll]
  );

  const handleSwapMatches = useCallback(
    async (matchIdA: string, matchIdB: string) => {
      const matchA = allMatches.find((m) => m.id === matchIdA);
      const matchB = allMatches.find((m) => m.id === matchIdB);
      if (!matchA || !matchB) return;

      try {
        await Promise.all([
          api.patch(`/tournaments/${selectedTournament}/matches/${matchIdA}/`, {
            field: matchB.field,
            start_time: matchB.start_time,
          }),
          api.patch(`/tournaments/${selectedTournament}/matches/${matchIdB}/`, {
            field: matchA.field,
            start_time: matchA.start_time,
          }),
        ]);
        toast.success("Matchs échangés !");
        invalidateAll();
      } catch {
        toast.error("Erreur lors de l'échange.");
      }
    },
    [selectedTournament, allMatches, invalidateAll]
  );

  const handleConflictDrop = useCallback(
    (matchId: string, fieldId: number, startTime: string, conflictTeam: string) => {
      setConflictDialog({ matchId, fieldId, startTime, conflictTeam });
    },
    []
  );

  const handleForceMove = useCallback(async () => {
    if (!conflictDialog) return;
    try {
      await api.patch(
        `/tournaments/${selectedTournament}/matches/${conflictDialog.matchId}/`,
        {
          field: conflictDialog.fieldId,
          start_time: conflictDialog.startTime,
        }
      );
      toast.success("Match déplacé (conflit ignoré).");
      invalidateAll();
    } catch {
      toast.error("Erreur lors du déplacement.");
    }
    setConflictDialog(null);
  }, [conflictDialog, selectedTournament, invalidateAll]);

  // ─── Context menu actions ─────────────────────────────────────────────
  const handleLockToggle = useCallback(
    async (match: MatchList) => {
      try {
        const endpoint = match.is_locked ? "unlock" : "lock";
        await api.post(
          `/tournaments/${selectedTournament}/matches/${match.id}/${endpoint}/`
        );
        toast.success(match.is_locked ? "Match déverrouillé" : "Match verrouillé");
        invalidateAll();
      } catch {
        toast.error("Erreur.");
      }
    },
    [selectedTournament, invalidateAll]
  );

  const handlePostpone = useCallback(
    async (match: MatchList) => {
      try {
        await api.patch(
          `/tournaments/${selectedTournament}/matches/${match.id}/`,
          { status: "postponed" }
        );
        toast.success("Match reporté");
        invalidateAll();
      } catch {
        toast.error("Erreur.");
      }
    },
    [selectedTournament, invalidateAll]
  );

  const handleDelete = useCallback(
    async (match: MatchList) => {
      if (!confirm(`Supprimer ${match.display_home} vs ${match.display_away} ?`))
        return;
      try {
        await api.delete(
          `/tournaments/${selectedTournament}/matches/${match.id}/`
        );
        toast.success("Match supprimé");
        invalidateAll();
      } catch {
        toast.error("Erreur.");
      }
    },
    [selectedTournament, invalidateAll]
  );

  // ─── Filter team selection → journey ──────────────────────────────────
  const handleFilterChange = useCallback(
    (f: PlanningFilters) => {
      setFilters(f);
      if (f.team && f.team !== filters.team) {
        setSelectedTeam(f.team);
      } else if (!f.team) {
        setSelectedTeam(null);
      }
    },
    [filters.team]
  );

  // ─── Briefing mode ────────────────────────────────────────────────────
  if (briefingOpen) {
    return (
      <BriefingMode
        schedule={days}
        conflicts={serverConflicts}
        onClose={() => setBriefingOpen(false)}
      />
    );
  }

  // ─── Tournament name for export ───────────────────────────────────────
  const tournamentName =
    tournaments.find((t) => t.id === selectedTournament)?.name ?? "tournoi";

  return (
    <div className="p-4 md:p-6 space-y-6 pb-safe">
      {/* Header */}
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBriefingOpen(true)}
            >
              <Maximize2 className="size-4 mr-1" />
              Mode briefing
            </Button>
            <PlanningExport
              schedule={days}
              tournamentName={tournamentName}
            />
            <DiagnosticsPanel tournamentId={selectedTournament} />
            <Button
              onClick={() => generateMut.mutate({ async: true })}
              disabled={generateMut.isPending}
              size="sm"
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
            setFilters(EMPTY_FILTERS);
            setSelectedTeam(null);
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
          {/* Feasibility */}
          <FeasibilityPanel tournamentId={selectedTournament} />

          {/* Filters bar */}
          <PlanningFiltersBar
            filters={filters}
            onChange={handleFilterChange}
            categories={categories ?? []}
            fields={fieldsData ?? []}
            teamNames={teamNames}
          />

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
            {(serverConflicts.length > 0 || clientConflicts.length > 0) && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="size-3.5" />
                {Math.max(serverConflicts.length, clientConflicts.length)} conflit
                {Math.max(serverConflicts.length, clientConflicts.length) !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-muted-foreground">
              {days.length} jour{days.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Team journey (when a team is selected) */}
          {selectedTeam && (
            <TeamJourney
              teamName={selectedTeam}
              schedule={days}
              onClose={() => {
                setSelectedTeam(null);
                setFilters((f) => ({ ...f, team: "" }));
              }}
            />
          )}

          {/* Conflicts detail */}
          {serverConflicts.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="size-4" />
                  Conflits détectés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {serverConflicts.slice(0, 8).map((c) => (
                    <li key={`${c.match_id}-${c.type}`}>
                      <span className="font-medium text-foreground">
                        Match #{c.match_id}
                      </span>{" "}
                      — {c.detail}
                    </li>
                  ))}
                  {serverConflicts.length > 8 && (
                    <li className="text-muted-foreground">
                      … et {serverConflicts.length - 8} autre(s)
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

              {/* Day header with field display links */}
              {currentDay && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold capitalize">
                      {formatDateLabel(currentDay.date)}
                    </h3>
                    <div className="flex gap-1">
                      {currentDay.fields.map((fs) => (
                        <Link
                          key={fs.field.id}
                          href={`/admin/planning/display/${fs.field.id}?t=${selectedTournament}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          title={`Afficher ${fs.field.name} sur grand écran`}
                        >
                          <Monitor className="size-3" />
                          {fs.field.name}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <PlanningGrid
                      day={currentDay}
                      tournamentId={selectedTournament}
                      allMatches={allMatches}
                      conflictMatchIds={conflictMatchIds}
                      grayedOutMatchIds={grayedOutMatchIds}
                      onMoveMatch={handleMoveMatch}
                      onSwapMatches={handleSwapMatches}
                      onConflictDrop={handleConflictDrop}
                      onLockToggle={handleLockToggle}
                      onPostpone={handlePostpone}
                      onDelete={handleDelete}
                    />
                  </div>
                </>
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
              {generateErrorMessage}
            </p>
          )}
        </>
      )}

      {/* Conflict dialog for drag & drop */}
      <Dialog
        open={!!conflictDialog}
        onOpenChange={(open) => !open && setConflictDialog(null)}
      >
        <DialogContent onClose={() => setConflictDialog(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="size-5" />
              <h3 className="font-semibold">Conflit détecté</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {conflictDialog?.conflictTeam}
              </strong>{" "}
              joue déjà à cette heure sur un autre terrain.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceMove}
              >
                Verrouiller et ignorer le conflit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConflictDialog(null)}
              >
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

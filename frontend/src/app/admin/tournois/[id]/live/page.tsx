"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  MapPin,
  Clock,
  Trophy,
  Loader2,
  Radio,
  Eye,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useTournament } from "@/hooks/use-tournaments";
import { useCategories } from "@/hooks/use-categories";
import { useFields } from "@/hooks/use-fields";
import { useMatches } from "@/hooks/use-matches";
import { useCategoryStandings } from "@/hooks/use-standings";
import {
  useSubmitScore,
  useStartMatch,
} from "@/hooks/use-match-mutations";
import type {
  MatchList,
  MatchStatus,
  Category,
  TournamentField,
  TeamStanding,
} from "@/types/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "Programmé",
  live: "En cours",
  finished: "Terminé",
  cancelled: "Annulé",
  postponed: "Reporté",
};

// ─── Score Entry Dialog ─────────────────────────────────────────────────────

function ScoreDialog({
  open,
  onOpenChange,
  match,
  tournamentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchList | null;
  tournamentId: string;
}) {
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const submitMut = useSubmitScore(tournamentId, match?.id ?? "");

  // Reset scores when dialog opens with a new match
  const handleOpenChange = (o: boolean) => {
    if (o && match) {
      setScoreHome(match.score_home ?? 0);
      setScoreAway(match.score_away ?? 0);
    }
    onOpenChange(o);
  };

  function handleSubmit() {
    if (!match) return;
    submitMut.mutate(
      { score_home: scoreHome, score_away: scoreAway },
      {
        onSuccess: () => {
          toast.success("Score enregistré !");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Erreur lors de l'enregistrement du score.");
        },
      }
    );
  }

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-base">
            Saisir le score
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {/* Teams + score buttons */}
          <div className="flex items-center justify-center gap-6">
            {/* Home */}
            <div className="text-center space-y-3 flex-1">
              <p className="text-sm font-semibold truncate">
                {match.display_home}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 text-xl"
                  onClick={() => setScoreHome(Math.max(0, scoreHome - 1))}
                >
                  <ChevronDown className="size-5" />
                </Button>
                <span className="text-4xl font-bold tabular-nums w-12 text-center">
                  {scoreHome}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 text-xl"
                  onClick={() => setScoreHome(scoreHome + 1)}
                >
                  <ChevronUp className="size-5" />
                </Button>
              </div>
            </div>

            <span className="text-2xl font-light text-muted-foreground">–</span>

            {/* Away */}
            <div className="text-center space-y-3 flex-1">
              <p className="text-sm font-semibold truncate">
                {match.display_away}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 text-xl"
                  onClick={() => setScoreAway(Math.max(0, scoreAway - 1))}
                >
                  <ChevronDown className="size-5" />
                </Button>
                <span className="text-4xl font-bold tabular-nums w-12 text-center">
                  {scoreAway}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-12 text-xl"
                  onClick={() => setScoreAway(scoreAway + 1)}
                >
                  <ChevronUp className="size-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Match info */}
          <div className="flex justify-center gap-3 text-xs text-muted-foreground">
            {match.field_name && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {match.field_name}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatTime(match.start_time)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitMut.isPending}>
            {submitMut.isPending && (
              <Loader2 className="size-4 mr-1 animate-spin" />
            )}
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Start Match Button ─────────────────────────────────────────────────────

function StartMatchButton({
  match,
  tournamentId,
}: {
  match: MatchList;
  tournamentId: string;
}) {
  const startMut = useStartMatch(tournamentId, match.id);

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={(e) => {
        e.stopPropagation();
        startMut.mutate(undefined, {
          onSuccess: () => toast.success("Match démarré !"),
          onError: () => toast.error("Impossible de démarrer le match."),
        });
      }}
      disabled={startMut.isPending}
      className="shrink-0"
    >
      {startMut.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Play className="size-3.5" />
      )}
    </Button>
  );
}

// ─── Live Match Card ────────────────────────────────────────────────────────

function LiveMatchRow({
  match,
  onScoreClick,
}: {
  match: MatchList;
  onScoreClick: () => void;
}) {
  const hasScore = match.score_home !== null && match.score_away !== null;
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  return (
    <button
      type="button"
      onClick={onScoreClick}
      className="w-full text-left"
    >
      <Card
        className={`transition-colors hover:border-primary/40 ${
          isLive ? "ring-1 ring-green-500/30 bg-green-50/50 dark:bg-green-950/20" : ""
        }`}
      >
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isLive && (
                <span className="relative flex size-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2.5 bg-green-500" />
                </span>
              )}
              <span className="text-sm font-medium truncate">
                {match.display_home}
              </span>
              {hasScore ? (
                <span className="font-bold text-sm tabular-nums shrink-0">
                  {match.score_home} - {match.score_away}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground shrink-0">vs</span>
              )}
              <span className="text-sm font-medium truncate">
                {match.display_away}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
              <Badge
                variant={isLive ? "default" : isFinished ? "secondary" : "outline"}
                className="text-[10px]"
              >
                {STATUS_LABEL[match.status]}
              </Badge>
              {match.field_name && (
                <span className="hidden sm:inline">{match.field_name}</span>
              )}
              <span>{formatTime(match.start_time)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

// ─── Standings Mini Table ───────────────────────────────────────────────────

function StandingsMiniTable({
  categoryId,
}: {
  categoryId: number;
}) {
  const { data, isLoading } = useCategoryStandings(categoryId);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!data || data.groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        Pas de classement disponible.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.groups.map((g) => (
        <div key={g.group.id}>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            {g.group.name}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1">Équipe</th>
                  <th className="text-center py-1 px-1">J</th>
                  <th className="text-center py-1 px-1">G</th>
                  <th className="text-center py-1 px-1">N</th>
                  <th className="text-center py-1 px-1">P</th>
                  <th className="text-center py-1 px-1">Diff</th>
                  <th className="text-center py-1 px-1 font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {g.standings.map((s: TeamStanding) => (
                  <tr key={s.team_id} className="border-b border-border/50">
                    <td className="py-1 pr-2 text-muted-foreground">
                      {s.rank}
                    </td>
                    <td className="py-1 font-medium truncate max-w-[120px]">
                      {s.team_name}
                    </td>
                    <td className="text-center py-1 tabular-nums">{s.played}</td>
                    <td className="text-center py-1 tabular-nums">{s.won}</td>
                    <td className="text-center py-1 tabular-nums">{s.drawn}</td>
                    <td className="text-center py-1 tabular-nums">{s.lost}</td>
                    <td className="text-center py-1 tabular-nums">
                      {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                    </td>
                    <td className="text-center py-1 font-bold tabular-nums">
                      {s.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: tournament, isLoading } = useTournament(id);
  const { data: categories } = useCategories(id);
  const { data: fields } = useFields(id);
  const { data: matchesData } = useMatches(id);
  const matches = matchesData?.results ?? [];
  const catList = categories ?? [];
  const fieldList = fields ?? [];

  // State
  const [view, setView] = useState<"matches" | "fields" | "standings">("matches");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scoreMatch, setScoreMatch] = useState<MatchList | null>(null);

  // Derived data
  const liveMatches = useMemo(
    () => matches.filter((m) => m.status === "live"),
    [matches]
  );

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((m) => m.status === "scheduled")
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        .slice(0, 10),
    [matches]
  );

  const recentResults = useMemo(
    () =>
      matches
        .filter((m) => m.status === "finished")
        .sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        )
        .slice(0, 10),
    [matches]
  );

  // Category-filtered matches
  const filteredMatches = useMemo(() => {
    if (categoryFilter === "all") return matches;
    return matches.filter((m) => m.category === Number(categoryFilter));
  }, [matches, categoryFilter]);

  // Group matches by field
  const matchesByField = useMemo(() => {
    const map = new Map<string, MatchList[]>();
    for (const f of fieldList) {
      map.set(
        f.name,
        filteredMatches
          .filter((m) => m.field_name === f.name)
          .sort(
            (a, b) =>
              new Date(a.start_time).getTime() -
              new Date(b.start_time).getTime()
          )
      );
    }
    return map;
  }, [filteredMatches, fieldList]);

  // Today's matches (for the planning view)
  const todayMatches = useMemo(() => {
    const today = new Date().toDateString();
    return filteredMatches
      .filter((m) => new Date(m.start_time).toDateString() === today)
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
  }, [filteredMatches]);

  // Loading
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          icon={Trophy}
          title="Tournoi introuvable"
          description="Ce tournoi n'existe pas ou vous n'y avez pas accès."
          action={
            <Link href="/admin/tournois">
              <Button variant="outline">
                <ArrowLeft className="size-4 mr-1" />
                Retour
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const liveCount = liveMatches.length;
  const finishedCount = matches.filter((m) => m.status === "finished").length;
  const scheduledCount = matches.filter((m) => m.status === "scheduled").length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/admin/tournois/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-4" />
          {tournament.name}
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Mode Live</h1>
            {liveCount > 0 && (
              <Badge variant="default" className="animate-pulse">
                <Radio className="size-3 mr-1" />
                {liveCount} en cours
              </Badge>
            )}
          </div>
          {tournament.slug && (
            <Link href={`/tournoi/${tournament.slug}`} target="_blank">
              <Button variant="outline" size="sm">
                <Eye className="size-3.5 mr-1" />
                Vue publique
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-green-500" />
              </span>
              <span className="text-xs text-muted-foreground">En cours</span>
            </div>
            <p className="text-2xl font-bold mt-1">{liveCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-blue-500" />
              <span className="text-xs text-muted-foreground">Terminés</span>
            </div>
            <p className="text-2xl font-bold mt-1">{finishedCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-amber-500" />
              <span className="text-xs text-muted-foreground">À venir</span>
            </div>
            <p className="text-2xl font-bold mt-1">{scheduledCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={view === "matches" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("matches")}
          >
            Matchs
          </Button>
          <Button
            variant={view === "fields" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("fields")}
          >
            Par terrain
          </Button>
          <Button
            variant={view === "standings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("standings")}
          >
            Classements
          </Button>
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={[
            { value: "all", label: "Toutes les catégories" },
            ...catList.map((c) => ({
              value: String(c.id),
              label: c.name,
            })),
          ]}
          className="w-48"
        />
      </div>

      {/* ── Matches View ─────────────────────────────────────── */}
      {view === "matches" && (
        <div className="space-y-6">
          {/* Live matches */}
          {liveMatches.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-green-600 mb-2 flex items-center gap-2">
                <Radio className="size-4" />
                En cours ({liveMatches.length})
              </h2>
              <div className="space-y-2">
                {liveMatches
                  .filter(
                    (m) =>
                      categoryFilter === "all" ||
                      m.category === Number(categoryFilter)
                  )
                  .map((m) => (
                    <LiveMatchRow
                      key={m.id}
                      match={m}
                      onScoreClick={() => setScoreMatch(m)}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcomingMatches.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                <Clock className="size-4" />
                Prochains matchs
              </h2>
              <div className="space-y-2">
                {upcomingMatches
                  .filter(
                    (m) =>
                      categoryFilter === "all" ||
                      m.category === Number(categoryFilter)
                  )
                  .map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <LiveMatchRow
                          match={m}
                          onScoreClick={() => setScoreMatch(m)}
                        />
                      </div>
                      <StartMatchButton match={m} tournamentId={id} />
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Recent results */}
          {recentResults.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                Derniers résultats
              </h2>
              <div className="space-y-2">
                {recentResults
                  .filter(
                    (m) =>
                      categoryFilter === "all" ||
                      m.category === Number(categoryFilter)
                  )
                  .map((m) => (
                    <LiveMatchRow
                      key={m.id}
                      match={m}
                      onScoreClick={() => setScoreMatch(m)}
                    />
                  ))}
              </div>
            </section>
          )}

          {matches.length === 0 && (
            <EmptyState
              icon={Radio}
              title="Aucun match"
              description="Générez le planning depuis la page tournoi pour voir les matchs ici."
            />
          )}
        </div>
      )}

      {/* ── Fields View ──────────────────────────────────────── */}
      {view === "fields" && (
        <div className="space-y-4">
          {fieldList.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Aucun terrain configuré"
              description="Ajoutez des terrains depuis la page du tournoi."
            />
          ) : (
            fieldList.map((field) => {
              const fieldMatches = matchesByField.get(field.name) ?? [];
              const currentMatch = fieldMatches.find(
                (m) => m.status === "live"
              );
              const nextMatch = fieldMatches.find(
                (m) => m.status === "scheduled"
              );

              return (
                <Card key={field.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="size-4" />
                      {field.name}
                      {currentMatch && (
                        <Badge variant="default" className="text-[10px] ml-2">
                          En cours
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {currentMatch && (
                      <button
                        type="button"
                        onClick={() => setScoreMatch(currentMatch)}
                        className="w-full text-left"
                      >
                        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="relative flex size-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full size-2 bg-green-500" />
                              </span>
                              <span className="text-sm font-medium">
                                {currentMatch.display_home}
                              </span>
                              <span className="font-bold text-sm tabular-nums">
                                {currentMatch.score_home ?? 0} -{" "}
                                {currentMatch.score_away ?? 0}
                              </span>
                              <span className="text-sm font-medium">
                                {currentMatch.display_away}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {currentMatch.category_name}
                            </span>
                          </div>
                        </div>
                      </button>
                    )}
                    {nextMatch && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Suivant : {nextMatch.display_home} vs{" "}
                          {nextMatch.display_away} ({nextMatch.category_name})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTime(nextMatch.start_time)}
                          </span>
                          <StartMatchButton
                            match={nextMatch}
                            tournamentId={id}
                          />
                        </div>
                      </div>
                    )}
                    {!currentMatch && !nextMatch && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Aucun match prévu
                      </p>
                    )}
                    {/* Show upcoming field schedule (collapsed) */}
                    {fieldMatches.filter((m) => m.status === "scheduled").length >
                      1 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Voir le planning complet ({fieldMatches.length} matchs)
                        </summary>
                        <div className="mt-2 space-y-1">
                          {fieldMatches.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between py-0.5"
                            >
                              <span>
                                {formatTime(m.start_time)} · {m.display_home} vs{" "}
                                {m.display_away}
                              </span>
                              <Badge
                                variant={
                                  m.status === "live"
                                    ? "default"
                                    : m.status === "finished"
                                      ? "secondary"
                                      : "outline"
                                }
                                className="text-[9px]"
                              >
                                {STATUS_LABEL[m.status]}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Standings View ───────────────────────────────────── */}
      {view === "standings" && (
        <div className="space-y-4">
          {catList.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Aucune catégorie"
              description="Ajoutez des catégories depuis la page du tournoi."
            />
          ) : (
            catList
              .filter(
                (c) =>
                  categoryFilter === "all" ||
                  c.id === Number(categoryFilter)
              )
              .map((cat) => (
                <Card key={cat.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: cat.color || "#16a34a" }}
                      />
                      {cat.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StandingsMiniTable categoryId={cat.id} />
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      )}

      {/* Score dialog */}
      <ScoreDialog
        open={!!scoreMatch}
        onOpenChange={(o) => !o && setScoreMatch(null)}
        match={scoreMatch}
        tournamentId={id}
      />
    </div>
  );
}

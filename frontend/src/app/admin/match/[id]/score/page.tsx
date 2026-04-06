"use client";

import { use, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { ScoreDisplay } from "@/components/kickoff/score-display";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Minus, Plus, Check, ArrowLeft, Loader2, Play, Flag, Target, Users, X } from "lucide-react";
import Link from "next/link";
import { useMatch } from "@/hooks/use-matches";
import { useSubmitScore, useStartMatch } from "@/hooks/use-match-mutations";
import { triggerHaptic } from "@/lib/haptics";
import type { GoalInput } from "@/types/api";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programmé",
  live: "En cours",
  finished: "Terminé",
  cancelled: "Annulé",
  postponed: "Reporté",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScoreEntry({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: matchIdStr } = use(params);
  const matchId = matchIdStr;
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("t") ?? "";
  const router = useRouter();

  const { data: match, isLoading } = useMatch(tournamentId, matchId);
  const submitScore = useSubmitScore(tournamentId, matchId);
  const startMatch = useStartMatch(tournamentId, matchId);

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [penaltyHome, setPenaltyHome] = useState<number | null>(null);
  const [penaltyAway, setPenaltyAway] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showGoalSheet, setShowGoalSheet] = useState(false);
  const [goals, setGoals] = useState<GoalInput[]>([]);

  const addGoal = useCallback((team: "home" | "away") => {
    triggerHaptic("light");
    setGoals((prev) => [...prev, { team, player_name: "", minute: null }]);
  }, []);

  const removeGoal = useCallback((index: number) => {
    triggerHaptic("light");
    setGoals((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateGoal = useCallback(
    (index: number, field: "player_name" | "minute", value: string) => {
      setGoals((prev) =>
        prev.map((g, i) =>
          i === index
            ? {
                ...g,
                [field]: field === "minute" ? (value ? Number(value) : null) : value,
              }
            : g
        )
      );
    },
    []
  );

  // Prefill from existing scores
  if (match && !submitted && homeScore === 0 && awayScore === 0) {
    if (match.score_home !== null) setHomeScore(match.score_home);
    if (match.score_away !== null) setAwayScore(match.score_away);
    if (match.penalty_score_home !== null) setPenaltyHome(match.penalty_score_home);
    if (match.penalty_score_away !== null) setPenaltyAway(match.penalty_score_away);
  }

  function handleSubmit() {
    triggerHaptic("medium");
    submitScore.mutate(
      {
        score_home: homeScore,
        score_away: awayScore,
        ...(penaltyHome !== null && penaltyAway !== null
          ? { penalty_score_home: penaltyHome, penalty_score_away: penaltyAway }
          : {}),
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          setShowGoalSheet(true);
        },
      }
    );
  }

  function handleSaveGoals() {
    const validGoals = goals.filter((g) => g.player_name?.trim());
    if (validGoals.length > 0) {
      triggerHaptic("medium");
      submitScore.mutate(
        {
          score_home: homeScore,
          score_away: awayScore,
          ...(penaltyHome !== null && penaltyAway !== null
            ? { penalty_score_home: penaltyHome, penalty_score_away: penaltyAway }
            : {}),
          goals: validGoals,
        },
        {
          onSuccess: () => {
            setShowGoalSheet(false);
            router.back();
          },
        }
      );
    } else {
      setShowGoalSheet(false);
      router.back();
    }
  }

  function handleSkipGoals() {
    setShowGoalSheet(false);
    router.back();
  }

  function handleStart() {
    triggerHaptic("medium");
    startMatch.mutate();
  }

  if (!tournamentId) {
    return (
      <div className="p-4 md:p-6 text-center">
        <p className="text-muted-foreground">
          Paramètre tournoi manquant.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-lg mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="p-4 md:p-6 text-center">
        <p className="text-muted-foreground">Match introuvable.</p>
      </div>
    );
  }

  const homeName = match.team_home_detail?.name ?? match.display_home;
  const awayName = match.team_away_detail?.name ?? match.display_away;
  const homeLogo = match.team_home_detail?.logo ?? null;
  const awayLogo = match.team_away_detail?.logo ?? null;
  const isLive = match.status === "live";
  const isScheduled = match.status === "scheduled";
  const isKnockout = match.phase !== "group";
  const isDraw = homeScore === awayScore;
  const showPenalties = isKnockout && isDraw;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto pb-safe">
      {/* Back button */}
      <Link
        href={`/admin/tournois/${tournamentId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Retour
      </Link>

      {/* Match info header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          {isLive && <LiveIndicator size="sm" />}
          <Badge
            variant={isLive ? "default" : "secondary"}
          >
            {STATUS_LABEL[match.status] ?? match.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {match.category_name}
          {match.field_name && ` • ${match.field_name}`}
          {match.start_time && ` • ${formatTime(match.start_time)}`}
        </p>
      </div>

      {/* Score card */}
      <Card>
        <CardContent className="py-6 space-y-6">
          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Check className="size-8 text-green-500" />
              </div>
              <p className="text-lg font-semibold">Score enregistré !</p>
              <p className="text-2xl font-bold tabular-nums">
                {homeScore} — {awayScore}
              </p>
            </div>
          ) : (
            <>
              {/* Home team */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <TeamAvatar name={homeName} logo={homeLogo} size="sm" />
                  <p className="font-semibold">{homeName}</p>
                </div>
                <div className="flex items-center justify-center gap-5">
                  <Button
                    variant="outline"
                    className="size-16 rounded-2xl text-2xl active:scale-95 transition-transform"
                    onClick={() => {
                      triggerHaptic("light");
                      setHomeScore(Math.max(0, homeScore - 1));
                      if (Math.max(0, homeScore - 1) !== awayScore) { setPenaltyHome(null); setPenaltyAway(null); }
                    }}
                  >
                    <Minus className="size-7" />
                  </Button>
                  <ScoreDisplay score={homeScore} size="lg" />
                  <Button
                    variant="outline"
                    className="size-16 rounded-2xl text-2xl active:scale-95 transition-transform"
                    onClick={() => {
                      triggerHaptic("light");
                      setHomeScore(homeScore + 1);
                      if (homeScore + 1 !== awayScore) { setPenaltyHome(null); setPenaltyAway(null); }
                    }}
                  >
                    <Plus className="size-7" />
                  </Button>
                </div>
              </div>

              {/* Separator */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium uppercase">
                  vs
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Away team */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <TeamAvatar name={awayName} logo={awayLogo} size="sm" />
                  <p className="font-semibold">{awayName}</p>
                </div>
                <div className="flex items-center justify-center gap-5">
                  <Button
                    variant="outline"
                    className="size-16 rounded-2xl text-2xl active:scale-95 transition-transform"
                    onClick={() => {
                      triggerHaptic("light");
                      setAwayScore(Math.max(0, awayScore - 1));
                      if (homeScore !== Math.max(0, awayScore - 1)) { setPenaltyHome(null); setPenaltyAway(null); }
                    }}
                  >
                    <Minus className="size-7" />
                  </Button>
                  <ScoreDisplay score={awayScore} size="lg" />
                  <Button
                    variant="outline"
                    className="size-16 rounded-2xl text-2xl active:scale-95 transition-transform"
                    onClick={() => {
                      triggerHaptic("light");
                      setAwayScore(awayScore + 1);
                      if (homeScore !== awayScore + 1) { setPenaltyHome(null); setPenaltyAway(null); }
                    }}
                  >
                    <Plus className="size-7" />
                  </Button>
                </div>
              </div>

              {/* Penalty shootout (knockout draws only) */}
              {showPenalties && (
                <div className="rounded-xl border-2 border-orange-500/30 bg-orange-500/5 p-4 space-y-4">
                  <div className="flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400">
                    <Target className="size-5" />
                    <p className="font-semibold text-sm">Tirs au but (phase finale)</p>
                  </div>

                  {/* Penalty home */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate max-w-[120px]">{homeName}</p>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10 rounded-xl"
                        onClick={() => { triggerHaptic("light"); setPenaltyHome(Math.max(0, (penaltyHome ?? 0) - 1)); }}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="text-xl font-bold tabular-nums w-8 text-center">
                        {penaltyHome ?? 0}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10 rounded-xl"
                        onClick={() => { triggerHaptic("light"); setPenaltyHome((penaltyHome ?? 0) + 1); }}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Penalty away */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate max-w-[120px]">{awayName}</p>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10 rounded-xl"
                        onClick={() => { triggerHaptic("light"); setPenaltyAway(Math.max(0, (penaltyAway ?? 0) - 1)); }}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="text-xl font-bold tabular-nums w-8 text-center">
                        {penaltyAway ?? 0}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10 rounded-xl"
                        onClick={() => { triggerHaptic("light"); setPenaltyAway((penaltyAway ?? 0) + 1); }}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {penaltyHome !== null && penaltyAway !== null && penaltyHome === penaltyAway && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 text-center">
                      Les tirs au but ne peuvent pas être à égalité.
                    </p>
                  )}
                </div>
              )}

              {/* Submit error */}
              {submitScore.isError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive text-center">
                    Erreur lors de la validation du score.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {/* Start match button (only when scheduled) */}
                {isScheduled && (
                  <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={handleStart}
                    disabled={startMatch.isPending}
                  >
                    {startMatch.isPending ? (
                      <Loader2 className="size-5 mr-2 animate-spin" />
                    ) : (
                      <Play className="size-5 mr-2" />
                    )}
                    Démarrer le match
                  </Button>
                )}

                {/* Submit score */}
                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleSubmit}
                  disabled={submitScore.isPending}
                >
                  {submitScore.isPending ? (
                    <Loader2 className="size-5 mr-2 animate-spin" />
                  ) : (
                    <Flag className="size-5 mr-2" />
                  )}
                  Valider le score
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Goal scorers bottom-sheet */}
      <Sheet open={showGoalSheet} onOpenChange={setShowGoalSheet}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Buteurs (optionnel)
            </SheetTitle>
            <SheetDescription>
              Ajoutez les buteurs si vous le souhaitez, ou passez cette étape.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 space-y-4">
            {/* Home team goals */}
            {homeScore > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{homeName}</p>
                {goals
                  .map((g, i) => ({ ...g, _i: i }))
                  .filter((g) => g.team === "home")
                  .map((g) => (
                    <div key={g._i} className="flex items-center gap-2">
                      <Input
                        placeholder="Nom du joueur"
                        className="flex-1"
                        value={g.player_name ?? ""}
                        onChange={(e) => updateGoal(g._i, "player_name", e.target.value)}
                      />
                      <Input
                        placeholder="Min"
                        type="number"
                        className="w-16"
                        value={g.minute ?? ""}
                        onChange={(e) => updateGoal(g._i, "minute", e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => removeGoal(g._i)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => addGoal("home")}
                >
                  <Plus className="size-4 mr-1" />
                  Ajouter un buteur
                </Button>
              </div>
            )}

            {/* Away team goals */}
            {awayScore > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{awayName}</p>
                {goals
                  .map((g, i) => ({ ...g, _i: i }))
                  .filter((g) => g.team === "away")
                  .map((g) => (
                    <div key={g._i} className="flex items-center gap-2">
                      <Input
                        placeholder="Nom du joueur"
                        className="flex-1"
                        value={g.player_name ?? ""}
                        onChange={(e) => updateGoal(g._i, "player_name", e.target.value)}
                      />
                      <Input
                        placeholder="Min"
                        type="number"
                        className="w-16"
                        value={g.minute ?? ""}
                        onChange={(e) => updateGoal(g._i, "minute", e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => removeGoal(g._i)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => addGoal("away")}
                >
                  <Plus className="size-4 mr-1" />
                  Ajouter un buteur
                </Button>
              </div>
            )}

            {homeScore === 0 && awayScore === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Match nul 0-0 — aucun buteur à ajouter.
              </p>
            )}
          </div>

          <SheetFooter>
            <Button onClick={handleSaveGoals} disabled={submitScore.isPending}>
              {submitScore.isPending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Check className="size-4 mr-2" />
              )}
              Enregistrer les buteurs
            </Button>
            <Button variant="ghost" onClick={handleSkipGoals}>
              Passer cette étape
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { use, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { ScoreDisplay } from "@/components/kickoff/score-display";
import { Minus, Plus, Check, ArrowLeft, Loader2, Play, Flag } from "lucide-react";
import Link from "next/link";
import { useMatch } from "@/hooks/use-matches";
import { useSubmitScore, useStartMatch } from "@/hooks/use-match-mutations";

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
  const [submitted, setSubmitted] = useState(false);

  // Prefill from existing scores
  if (match && !submitted && homeScore === 0 && awayScore === 0) {
    if (match.score_home !== null) setHomeScore(match.score_home);
    if (match.score_away !== null) setAwayScore(match.score_away);
  }

  function handleSubmit() {
    submitScore.mutate(
      { score_home: homeScore, score_away: awayScore },
      {
        onSuccess: () => {
          setSubmitted(true);
          setTimeout(() => {
            router.back();
          }, 1200);
        },
      }
    );
  }

  function handleStart() {
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
                    onClick={() =>
                      setHomeScore(Math.max(0, homeScore - 1))
                    }
                  >
                    <Minus className="size-7" />
                  </Button>
                  <ScoreDisplay score={homeScore} size="lg" />
                  <Button
                    variant="outline"
                    className="size-16 rounded-2xl text-2xl active:scale-95 transition-transform"
                    onClick={() => setHomeScore(homeScore + 1)}
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
                    onClick={() =>
                      setAwayScore(Math.max(0, awayScore - 1))
                    }
                  >
                    <Minus className="size-7" />
                  </Button>
                  <ScoreDisplay score={awayScore} size="lg" />
                  <Button
                    variant="outline"
                    className="size-16 rounded-2xl text-2xl active:scale-95 transition-transform"
                    onClick={() => setAwayScore(awayScore + 1)}
                  >
                    <Plus className="size-7" />
                  </Button>
                </div>
              </div>

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
    </div>
  );
}

"use client";

import { use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { ShareButton } from "@/components/kickoff/share-button";
import { MatchTimeline } from "@/components/kickoff/match-timeline";
import { StatusBadge } from "@/components/kickoff/status-badge";
import { CategoryBadge } from "@/components/kickoff/category-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { usePublicMatch } from "@/hooks/use-public";
import { useTournamentSocket } from "@/hooks/use-tournament-socket";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Calendar,
  AlertCircle,
} from "lucide-react";

const PHASE_LABEL: Record<string, string> = {
  group: "Phase de poules",
  r16: "Huitièmes de finale",
  quarter: "Quarts de finale",
  semi: "Demi-finales",
  third: "Match pour la 3e place",
  final: "Finale",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);
  const { data: match, isLoading } = usePublicMatch(slug, id);

  useTournamentSocket(slug);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="p-4">
        <EmptyState
          icon={AlertCircle}
          title="Match introuvable"
          description="Ce match n'existe pas ou n'est pas accessible."
          action={
            <Link
              href={`/tournoi/${slug}`}
              className="text-sm text-primary hover:underline"
            >
              Retour au tournoi
            </Link>
          }
        />
      </div>
    );
  }

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;

  const homeName = match.display_home || "À déterminer";
  const awayName = match.display_away || "À déterminer";

  return (
    <div className="p-4 space-y-4 pb-safe">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/tournoi/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Retour
        </Link>
        <ShareButton
          title={`${homeName} vs ${awayName}`}
          text={
            showScore
              ? `${homeName} ${match.score_home ?? 0} - ${match.score_away ?? 0} ${awayName}`
              : `${homeName} vs ${awayName}`
          }
        />
      </div>

      {/* Match phase & category */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={match.status} />
        {match.category_name && <CategoryBadge category={match.category_name} />}
        {match.phase && (
          <Badge variant="outline" className="text-[10px]">
            {PHASE_LABEL[match.phase] ?? match.phase}
          </Badge>
        )}
      </div>

      {/* Score card XXL */}
      <Card className={isLive ? "ring-red-500/30 bg-red-500/5" : ""}>
        <CardContent className="py-6">
          {isLive && (
            <div className="flex justify-center mb-4">
              <LiveIndicator size="lg" />
            </div>
          )}

          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Home team */}
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <TeamAvatar name={homeName} size="xl" />
              <span className="text-sm font-medium text-center truncate max-w-[120px]">
                {homeName}
              </span>
            </div>

            {/* Score */}
            <div className="flex items-center gap-2 shrink-0">
              {showScore ? (
                <>
                  <span className="text-5xl font-bold tabular-nums">
                    {match.score_home ?? 0}
                  </span>
                  <span className="text-2xl font-light text-muted-foreground mx-1">
                    –
                  </span>
                  <span className="text-5xl font-bold tabular-nums">
                    {match.score_away ?? 0}
                  </span>
                </>
              ) : (
                <span className="text-2xl font-light text-muted-foreground">
                  VS
                </span>
              )}
            </div>

            {/* Away team */}
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <TeamAvatar name={awayName} size="xl" />
              <span className="text-sm font-medium text-center truncate max-w-[120px]">
                {awayName}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal timeline */}
      {match.goals && match.goals.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Buts</CardTitle>
          </CardHeader>
          <CardContent>
            <MatchTimeline
              goals={match.goals}
              homeTeamId={match.team_home}
              awayTeamId={match.team_away}
              homeTeamName={homeName}
              awayTeamName={awayName}
            />
          </CardContent>
        </Card>
      )}

      {/* Match info */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <span>{formatDateTime(match.start_time)}</span>
          </div>
          {match.duration_minutes && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <span>{match.duration_minutes} minutes</span>
            </div>
          )}
          {match.field_name && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <span>{match.field_name}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {match.notes && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {match.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

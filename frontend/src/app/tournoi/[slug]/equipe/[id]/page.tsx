"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { MatchCard } from "@/components/kickoff/match-card";
import { ShareButton } from "@/components/kickoff/share-button";
import { CountdownTimer } from "@/components/kickoff/countdown-timer";
import { FollowButton } from "@/components/public/follow-button";
import { EmptyState } from "@/components/ui/empty-state";
import { usePublicTeam } from "@/hooks/use-public";
import { useTournamentSocket } from "@/hooks/use-tournament-socket";
import { ArrowLeft, Users, AlertCircle, Clock, Target, Shield } from "lucide-react";
import type { MatchList } from "@/types/api";

const PHASE_LABEL: Record<string, string> = {
  group: "Poule",
  r16: "8e",
  quarter: "Quart",
  semi: "Demi",
  third: "3e place",
  final: "Finale",
};

function matchToCard(m: MatchList) {
  return {
    id: m.id,
    status: m.status,
    homeTeam: m.display_home ? { name: m.display_home } : null,
    awayTeam: m.display_away ? { name: m.display_away } : null,
    homeScore: m.score_home ?? undefined,
    awayScore: m.score_away ?? undefined,
    category: m.category_name,
    field: m.field_name ?? undefined,
    kickoffTime: m.start_time,
    phase: PHASE_LABEL[m.phase] ?? m.phase,
  };
}

function computeStats(matches: MatchList[], teamName: string) {
  let played = 0,
    won = 0,
    drawn = 0,
    lost = 0,
    goalsFor = 0,
    goalsAgainst = 0;

  for (const m of matches) {
    if (m.status !== "finished") continue;
    played++;
    const isHome = m.display_home === teamName;
    const gf = isHome ? (m.score_home ?? 0) : (m.score_away ?? 0);
    const ga = isHome ? (m.score_away ?? 0) : (m.score_home ?? 0);
    goalsFor += gf;
    goalsAgainst += ga;
    if (gf > ga) won++;
    else if (gf === ga) drawn++;
    else lost++;
  }

  return { played, won, drawn, lost, goalsFor, goalsAgainst, diff: goalsFor - goalsAgainst, points: won * 3 + drawn };
}

/* ── Timeline node ───────────────────────────────── */

function TimelineNode({
  m,
  teamName,
  slug,
  isLast,
}: {
  m: MatchList;
  teamName: string;
  slug: string;
  isLast: boolean;
}) {
  const isHome = m.display_home === teamName;
  const opponent = isHome ? m.display_away : m.display_home;
  const gf = isHome ? (m.score_home ?? 0) : (m.score_away ?? 0);
  const ga = isHome ? (m.score_away ?? 0) : (m.score_home ?? 0);

  let result: "V" | "N" | "D" | null = null;
  let dotColor = "bg-muted-foreground";
  if (m.status === "finished") {
    if (gf > ga) { result = "V"; dotColor = "bg-green-500"; }
    else if (gf === ga) { result = "N"; dotColor = "bg-amber-500"; }
    else { result = "D"; dotColor = "bg-red-500"; }
  } else if (m.status === "live") {
    dotColor = "bg-red-500";
  }

  const time = new Date(m.start_time).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/tournoi/${slug}/match/${m.id}`} className="group">
      <div className="flex gap-3">
        {/* Line + dot */}
        <div className="flex flex-col items-center">
          <div className={`size-3 rounded-full ${dotColor} shrink-0 mt-1.5`} />
          {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
        </div>
        {/* Content */}
        <div className="pb-4 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{time}</span>
            {m.field_name && <span>• {m.field_name}</span>}
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              {PHASE_LABEL[m.phase] ?? m.phase}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-medium truncate group-hover:underline">
              vs {opponent}
            </span>
            {m.status === "finished" && (
              <Badge
                variant={result === "V" ? "default" : "secondary"}
                className={`text-[10px] px-1.5 ${
                  result === "V"
                    ? "bg-green-500/15 text-green-600"
                    : result === "D"
                    ? "bg-red-500/15 text-red-600"
                    : "bg-amber-500/15 text-amber-600"
                }`}
              >
                {result} {gf}-{ga}
              </Badge>
            )}
            {m.status === "live" && (
              <Badge className="bg-red-500/90 text-white text-[10px] px-1.5">
                🔴 {gf}-{ga}
              </Badge>
            )}
            {m.status === "scheduled" && (
              <CountdownTimer kickoffTime={m.start_time} />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TeamPublicPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);
  const teamId = Number(id);
  const { data, isLoading } = usePublicTeam(slug, teamId);

  // Real-time
  useTournamentSocket(slug);

  const sortedMatches = useMemo(() => {
    if (!data) return [];
    return [...data.matches].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <EmptyState
          icon={AlertCircle}
          title="Équipe introuvable"
          description="Cette équipe n'existe pas ou n'est pas accessible."
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

  const { team, matches } = data;
  const stats = computeStats(matches, team.name);
  const nextMatch = sortedMatches.find((m) => m.status === "scheduled");
  const live = matches.filter((m) => m.status === "live");

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
        <div className="flex items-center gap-1">
          <FollowButton teamId={teamId} />
          <ShareButton title={team.name} text={`Suivez ${team.name} !`} />
        </div>
      </div>

      {/* Hero banner */}
      <div className="relative -mx-4 px-4 py-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-center gap-4">
          <TeamAvatar name={team.name} logo={team.logo} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold truncate">{team.name}</h1>
            {team.category && (
              <Badge variant="outline" className="mt-1">
                {team.category.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Full stats table */}
      {stats.played > 0 && (
        <Card>
          <CardContent className="py-3 px-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="py-1 px-1.5 text-center">MJ</th>
                    <th className="py-1 px-1.5 text-center text-green-600">V</th>
                    <th className="py-1 px-1.5 text-center text-amber-600">N</th>
                    <th className="py-1 px-1.5 text-center text-red-600">D</th>
                    <th className="py-1 px-1.5 text-center">BP</th>
                    <th className="py-1 px-1.5 text-center">BC</th>
                    <th className="py-1 px-1.5 text-center">Diff</th>
                    <th className="py-1 px-1.5 text-center font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="tabular-nums">
                    <td className="py-2 px-1.5 text-center font-medium">{stats.played}</td>
                    <td className="py-2 px-1.5 text-center text-green-600 font-bold">{stats.won}</td>
                    <td className="py-2 px-1.5 text-center text-amber-600 font-bold">{stats.drawn}</td>
                    <td className="py-2 px-1.5 text-center text-red-600 font-bold">{stats.lost}</td>
                    <td className="py-2 px-1.5 text-center">{stats.goalsFor}</td>
                    <td className="py-2 px-1.5 text-center">{stats.goalsAgainst}</td>
                    <td className="py-2 px-1.5 text-center font-medium">
                      <span className={stats.diff > 0 ? "text-green-600" : stats.diff < 0 ? "text-red-600" : ""}>
                        {stats.diff > 0 ? "+" : ""}{stats.diff}
                      </span>
                    </td>
                    <td className="py-2 px-1.5 text-center font-bold text-lg">{stats.points}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next match — big countdown */}
      {nextMatch && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Clock className="size-4 text-primary" />
              Prochain match
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-semibold truncate">
                  {nextMatch.display_home === team.name
                    ? nextMatch.display_away
                    : nextMatch.display_home}
                </span>
              </div>
              <CountdownTimer kickoffTime={nextMatch.start_time} className="text-sm font-semibold text-primary" />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {nextMatch.field_name && (
                <span className="flex items-center gap-0.5">
                  <Target className="size-3" />
                  {nextMatch.field_name}
                </span>
              )}
              <Badge variant="outline" className="text-[9px] px-1">
                {PHASE_LABEL[nextMatch.phase] ?? nextMatch.phase}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match timeline */}
      {sortedMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <Shield className="size-4 text-primary" />
            Parcours
          </h2>
          <div className="ml-1">
            {sortedMatches.map((m, i) => (
              <TimelineNode
                key={m.id}
                m={m}
                teamName={team.name}
                slug={slug}
                isLast={i === sortedMatches.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      {matches.length === 0 && (
        <EmptyState
          icon={Users}
          title="Aucun match"
          description="Aucun match programmé pour cette équipe."
        />
      )}
    </div>
  );
}

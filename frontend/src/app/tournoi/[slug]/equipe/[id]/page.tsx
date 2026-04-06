"use client";

import { use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { MatchCard } from "@/components/kickoff/match-card";
import { ShareButton } from "@/components/kickoff/share-button";
import { EmptyState } from "@/components/ui/empty-state";
import { usePublicTeam } from "@/hooks/use-public";
import { ArrowLeft, Users, AlertCircle } from "lucide-react";
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

  return { played, won, drawn, lost, goalsFor, goalsAgainst };
}

export default function TeamPublicPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);
  const teamId = Number(id);
  const { data, isLoading } = usePublicTeam(slug, teamId);

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
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const finished = matches.filter((m) => m.status === "finished");
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
        <ShareButton title={team.name} text={`Suivez ${team.name} !`} />
      </div>

      {/* Team header */}
      <div className="flex items-center gap-4">
        <TeamAvatar name={team.name} logo={team.logo} size="xl" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{team.name}</h1>
          {team.category && (
            <Badge variant="outline" className="mt-1">
              {team.category.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {stats.played > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-green-500">{stats.won}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Victoires</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-amber-500">{stats.drawn}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Nuls</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-red-500">{stats.lost}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Défaites</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats.played > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-lg font-bold">{stats.played}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Joués</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-lg font-bold">{stats.goalsFor}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Buts marqués</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-lg font-bold">{stats.goalsAgainst}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Buts encaissés</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live matches */}
      {live.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">En cours</h2>
          <div className="space-y-2">
            {live.map((m) => {
              const d = matchToCard(m);
              return (
                <Link key={d.id} href={`/tournoi/${slug}/match/${d.id}`}>
                  <MatchCard {...d} />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">À venir</h2>
          <div className="space-y-2">
            {upcoming.map((m) => {
              const d = matchToCard(m);
              return (
                <Link key={d.id} href={`/tournoi/${slug}/match/${d.id}`}>
                  <MatchCard {...d} />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Past results */}
      {finished.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Résultats</h2>
          <div className="space-y-2">
            {finished.map((m) => {
              const d = matchToCard(m);
              return (
                <Link key={d.id} href={`/tournoi/${slug}/match/${d.id}`}>
                  <MatchCard {...d} />
                </Link>
              );
            })}
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

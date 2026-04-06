"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { CountdownTimer } from "@/components/kickoff/countdown-timer";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CalendarClock,
  Trophy,
  Radio,
  Clock,
  ArrowRight,
  MapPin,
  CheckCircle2,
  XCircle,
  Minus,
} from "lucide-react";
import { useCoachStore } from "@/stores/coach-store";
import { useMatches } from "@/hooks/use-matches";
import { useGroups } from "@/hooks/use-groups";
import { useCategoryStandings } from "@/hooks/use-standings";
import type { MatchList, TeamStanding } from "@/types/api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/* ── Next match card (prominent) ─────────────────────────── */

function NextMatchCard({ match }: { match: MatchList }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase font-semibold tracking-wider text-primary">
            Prochain match
          </p>
          <CountdownTimer kickoffTime={match.start_time} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <TeamAvatar name={match.display_home || "?"} size="md" />
            <span className="text-sm font-medium truncate">{match.display_home}</span>
          </div>
          <span className="text-lg font-light text-muted-foreground px-2">VS</span>
          <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
            <span className="text-sm font-medium truncate text-right">{match.display_away}</span>
            <TeamAvatar name={match.display_away || "?"} size="md" />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" />
            {formatDay(match.start_time)} • {formatTime(match.start_time)}
          </span>
          {match.field_name && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {match.field_name}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Live match card ─────────────────────────────────────── */

function LiveMatchCard({ match }: { match: MatchList }) {
  return (
    <Card className="ring-red-500/30 bg-red-500/5">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <LiveIndicator />
          <span className="text-[10px] text-muted-foreground">
            {match.field_name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <TeamAvatar name={match.display_home || "?"} size="md" />
            <span className="text-sm font-medium truncate">{match.display_home}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-2xl font-bold tabular-nums">{match.score_home ?? 0}</span>
            <span className="text-lg font-light text-muted-foreground">–</span>
            <span className="text-2xl font-bold tabular-nums">{match.score_away ?? 0}</span>
          </div>
          <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
            <span className="text-sm font-medium truncate text-right">{match.display_away}</span>
            <TeamAvatar name={match.display_away || "?"} size="md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Result icon ─────────────────────────────────────────── */

function ResultIcon({ result }: { result: "W" | "D" | "L" }) {
  if (result === "W")
    return <CheckCircle2 className="size-4 text-green-500 shrink-0" />;
  if (result === "L")
    return <XCircle className="size-4 text-red-500 shrink-0" />;
  return <Minus className="size-4 text-amber-500 shrink-0" />;
}

/* ── Mini standings ──────────────────────────────────────── */

function MiniStandings({
  standings,
  teamId,
}: {
  standings: TeamStanding[];
  teamId: number;
}) {
  return (
    <div className="space-y-1">
      {standings.map((s) => {
        const isMe = s.team_id === teamId;
        return (
          <div
            key={s.team_id}
            className={`flex items-center gap-2 text-sm py-1 px-2 rounded ${
              isMe ? "bg-primary/10 font-semibold" : ""
            }`}
          >
            <span className="w-5 text-center tabular-nums text-muted-foreground">
              {s.rank}
            </span>
            <span className="flex-1 truncate">{s.team_name}</span>
            <span className="tabular-nums font-bold">{s.points}</span>
            <span className="text-muted-foreground text-xs">pts</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */

export default function CoachHome() {
  const router = useRouter();
  const team = useCoachStore((s) => s.team);

  useEffect(() => {
    if (!team) router.replace("/coach/acces");
  }, [team, router]);

  const tournamentId = team?.tournament.id ?? "";
  const { data: matchesData, isLoading } = useMatches(tournamentId);
  const { data: groups } = useGroups(tournamentId, team?.category.id ?? 0);
  const { data: standingsData } = useCategoryStandings(team?.category.id ?? 0);

  const {
    liveMatch,
    nextMatch,
    recentResults,
    stats,
  } = useMemo(() => {
    const all = matchesData?.results ?? [];
    const teamMatches = all.filter(
      (m) => m.team_home === team?.id || m.team_away === team?.id
    );

    const finished = teamMatches
      .filter((m) => m.status === "finished")
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;
    for (const m of finished) {
      const isHome = m.team_home === team?.id;
      const gf = isHome ? (m.score_home ?? 0) : (m.score_away ?? 0);
      const ga = isHome ? (m.score_away ?? 0) : (m.score_home ?? 0);
      goalsFor += gf;
      goalsAgainst += ga;
      if (gf > ga) won++;
      else if (gf === ga) drawn++;
      else lost++;
    }

    return {
      liveMatch: teamMatches.find((m) => m.status === "live"),
      nextMatch: teamMatches
        .filter((m) => m.status === "scheduled")
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0],
      recentResults: finished.slice(0, 5),
      stats: { played: finished.length, won, drawn, lost, goalsFor, goalsAgainst },
    };
  }, [matchesData, team?.id]);

  // Find our group's standings
  const myGroupStandings = useMemo(() => {
    if (!standingsData?.groups || !team) return null;
    const teamGroup = groups?.find((g) => g.teams.some((t) => t.id === team.id));
    if (!teamGroup) return null;
    const gs = standingsData.groups.find((g) => g.group.id === teamGroup.id);
    return gs ?? null;
  }, [standingsData, groups, team]);

  if (!team) return null;

  return (
    <div className="p-4 space-y-5 pb-safe">
      {/* Header with TeamAvatar */}
      <div className="flex items-center gap-3 animate-fade-in-up">
        <TeamAvatar name={team.name} logo={team.logo} size="lg" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {team.category.name} • {team.tournament.name}
          </p>
        </div>
      </div>

      {/* Live match */}
      {liveMatch && <div className="animate-scale-in"><LiveMatchCard match={liveMatch} /></div>}

      {/* Next match */}
      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : nextMatch ? (
        <div className="animate-fade-in-up stagger-2"><NextMatchCard match={nextMatch} /></div>
      ) : !liveMatch ? (
        <EmptyState
          icon={Clock}
          title="Aucun match programmé"
          description="Le planning n'est pas encore disponible."
          className="py-6"
        />
      ) : null}

      {/* Stats grid: W / D / L */}
      {stats.played > 0 && (
        <div className="grid grid-cols-3 gap-2 animate-fade-in-up stagger-3">
          <Card className="card-hover">
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-green-500 animate-count-up">{stats.won}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Victoires</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-amber-500 animate-count-up">{stats.drawn}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Nuls</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-red-500 animate-count-up">{stats.lost}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Défaites</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats.played > 0 && (
        <div className="grid grid-cols-2 gap-2 animate-fade-in-up stagger-4">
          <Card className="card-hover">
            <CardContent className="py-3 text-center">
              <p className="text-lg font-bold animate-count-up">{stats.goalsFor}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Buts marqués</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="py-3 text-center">
              <p className="text-lg font-bold animate-count-up">{stats.goalsAgainst}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Buts encaissés</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent results feed */}
      {recentResults.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Trophy className="size-4 text-primary" />
              Derniers résultats
            </p>
            <Link
              href="/coach/matches"
              className="text-xs text-primary hover:underline"
            >
              Tout voir
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentResults.map((m) => {
              const isHome = m.team_home === team.id;
              const gf = isHome ? (m.score_home ?? 0) : (m.score_away ?? 0);
              const ga = isHome ? (m.score_away ?? 0) : (m.score_home ?? 0);
              const opponent = isHome ? m.display_away : m.display_home;
              const result = gf > ga ? "W" : gf < ga ? "L" : "D";

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-sm py-1.5"
                >
                  <ResultIcon result={result as "W" | "D" | "L"} />
                  <span className="flex-1 truncate">vs {opponent}</span>
                  <span className="font-bold tabular-nums">
                    {gf} – {ga}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Mini standings */}
      {myGroupStandings && myGroupStandings.standings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Trophy className="size-4 text-primary" />
              {myGroupStandings.group.name}
            </p>
            <Link
              href="/coach/classements"
              className="text-xs text-primary hover:underline"
            >
              Détails
            </Link>
          </div>
          <Card>
            <CardContent className="py-3">
              <MiniStandings
                standings={myGroupStandings.standings}
                teamId={team.id}
              />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

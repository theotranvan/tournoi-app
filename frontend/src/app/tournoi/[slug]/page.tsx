"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchCard } from "@/components/kickoff/match-card";
import { StandingsTable, type Standing } from "@/components/kickoff/standings-table";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { ShareButton } from "@/components/kickoff/share-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import {
  usePublicTournament,
  usePublicLive,
  usePublicMatches,
  usePublicStandings,
} from "@/hooks/use-public";
import { useTournamentSocket } from "@/hooks/use-tournament-socket";
import { useLiveStore } from "@/stores/live-store";
import {
  Radio,
  CalendarDays,
  Trophy,
  MapPin,
  Calendar,
  Info,
  Users,
  ChevronRight,
} from "lucide-react";
import type { MatchList, CategoryStandings, TeamStanding } from "@/types/api";
import { useQueryClient } from "@tanstack/react-query";
import { publicKeys } from "@/hooks/use-public";

/* ── Helpers ─────────────────────────────────────────────── */

const PHASE_LABEL: Record<string, string> = {
  group: "Poule",
  r16: "8e",
  quarter: "Quart",
  semi: "Demi",
  third: "3e place",
  final: "Finale",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function standingToRow(s: TeamStanding): Standing {
  return {
    rank: s.rank,
    teamName: s.team_name,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    goalsFor: s.goals_for,
    goalsAgainst: s.goals_against,
    goalDifference: s.goal_difference,
    points: s.points,
    form: s.form,
  };
}

/* ── Skeleton helpers ────────────────────────────────────── */

function MatchSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

/* ── Hero section ────────────────────────────────────────── */

function HeroSection({
  tournament,
  liveCount,
}: {
  tournament: {
    name: string;
    location: string;
    start_date: string;
    end_date: string;
    cover_image: string | null;
    categories: { id: number; name: string; color: string }[];
  };
  liveCount: number;
}) {
  return (
    <div className="relative -mx-4 -mt-4 animate-fade-in">
      {/* Cover image or gradient */}
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-primary/30 via-primary/10 to-background">
        {tournament.cover_image && (
          <img
            src={tournament.cover_image}
            alt={tournament.name}
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="relative -mt-24 px-4 pb-2">
        <div className="flex items-start justify-between gap-2 animate-fade-in-up stagger-1">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{tournament.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
              {tournament.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" />
                  {tournament.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5 shrink-0" />
                {formatShortDate(tournament.start_date)}
                {tournament.end_date !== tournament.start_date &&
                  ` – ${formatShortDate(tournament.end_date)}`}
              </span>
            </div>
          </div>
          <ShareButton
            title={tournament.name}
            text={`Suivez le tournoi ${tournament.name} en direct !`}
          />
        </div>

        {/* Live badge */}
        {liveCount > 0 && (
          <div className="mt-3 animate-scale-in stagger-2">
            <Badge variant="default" className="bg-red-500/90 hover:bg-red-500 text-white gap-1.5 px-2.5 py-1 shadow-lg shadow-red-500/20">
              <LiveIndicator size="sm" label="" />
              <span className="font-semibold">
                {liveCount} match{liveCount > 1 ? "s" : ""} en direct
              </span>
            </Badge>
          </div>
        )}

        {/* Category badges */}
        {tournament.categories.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap animate-fade-in-up stagger-3">
            {tournament.categories.map((c) => (
              <Badge
                key={c.id}
                variant="outline"
                className="text-[10px]"
                style={{
                  borderColor: c.color || undefined,
                  color: c.color || undefined,
                }}
              >
                {c.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Live carrousel card ─────────────────────────────────── */

function LiveMatchCarousel({ matches, slug }: { matches: MatchList[]; slug: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (matches.length === 0) return null;

  return (
    <div className="-mx-4 px-4">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
      >
        {matches.map((m, i) => (
          <Link
            key={m.id}
            href={`/tournoi/${slug}/match/${m.id}`}
            className={`snap-start shrink-0 w-[280px] animate-fade-in-up stagger-${i + 1}`}
          >
            <Card className="ring-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all card-hover">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <LiveIndicator size="sm" />
                  <span className="text-[10px] text-muted-foreground">
                    {m.category_name} • {m.field_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <TeamAvatar name={m.display_home || "?"} size="sm" />
                    <span className="text-sm font-medium truncate">{m.display_home}</span>
                  </div>
                  <span className="text-xl font-bold tabular-nums">{m.score_home ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <TeamAvatar name={m.display_away || "?"} size="sm" />
                    <span className="text-sm font-medium truncate">{m.display_away}</span>
                  </div>
                  <span className="text-xl font-bold tabular-nums">{m.score_away ?? 0}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Live Tab ────────────────────────────────────────────── */

function LiveTab({ slug }: { slug: string }) {
  const { data, isLoading } = usePublicLive(slug);
  const wsConnected = useLiveStore((s) => s.wsConnected);

  if (isLoading) return <MatchSkeleton />;

  const live = data?.live_matches ?? [];
  const upcoming = data?.upcoming_matches ?? [];
  const recent = data?.recent_results ?? [];

  const hasContent = live.length > 0 || upcoming.length > 0 || recent.length > 0;

  if (!hasContent) {
    return (
      <EmptyState
        icon={Radio}
        title="Aucun match en direct"
        description="Le tournoi n'a pas encore démarré ou aucun match n'est en cours."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Connection indicator */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span
          className={`size-1.5 rounded-full ${wsConnected ? "bg-green-500" : "bg-muted-foreground"}`}
        />
        <span>{wsConnected ? "Temps réel" : "Actualisation auto 30s"}</span>
      </div>

      {/* Live carrousel */}
      {live.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <LiveIndicator />
            <span className="text-sm font-medium">
              {live.length} match{live.length > 1 ? "s" : ""}
            </span>
          </div>
          <LiveMatchCarousel matches={live} slug={slug} />
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <CalendarDays className="size-4 text-primary" />
            À venir
          </p>
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

      {/* Recent results */}
      {recent.length > 0 && (
        <section>
          <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Trophy className="size-4 text-primary" />
            Derniers résultats
          </p>
          <div className="space-y-2">
            {recent.map((m) => {
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
    </div>
  );
}

/* ── Programme Tab ───────────────────────────────────────── */

function ProgrammeTab({ slug }: { slug: string }) {
  const { data: matches, isLoading } = usePublicMatches(slug);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const grouped = useMemo(() => {
    if (!matches) return {};
    let filtered = matches;
    if (categoryFilter !== "all") {
      filtered = matches.filter((m) => m.category_name === categoryFilter);
    }
    const byDate: Record<string, MatchList[]> = {};
    for (const m of filtered) {
      const day = new Date(m.start_time).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      (byDate[day] ??= []).push(m);
    }
    for (const day of Object.keys(byDate)) {
      byDate[day].sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    }
    return byDate;
  }, [matches, categoryFilter]);

  const categories = useMemo(() => {
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.category_name))].sort();
  }, [matches]);

  if (isLoading) return <MatchSkeleton />;

  if (!matches || matches.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Programme non disponible"
        description="Le programme sera disponible une fois le tournoi publié."
      />
    );
  }

  const days = Object.keys(grouped);

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      {categories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          <Badge
            variant={categoryFilter === "all" ? "default" : "outline"}
            className="cursor-pointer shrink-0"
            onClick={() => setCategoryFilter("all")}
          >
            Toutes
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              className="cursor-pointer shrink-0"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>
      )}

      {days.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Aucun match"
          description="Aucun match pour cette catégorie."
        />
      ) : (
        days.map((day) => (
          <section key={day}>
            <p className="text-sm font-semibold mb-2 capitalize">{day}</p>
            <div className="space-y-2">
              {grouped[day].map((m) => {
                const d = matchToCard(m);
                return (
                  <Link key={d.id} href={`/tournoi/${slug}/match/${d.id}`}>
                    <MatchCard {...d} />
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/* ── Classements Tab ─────────────────────────────────────── */

function PodiumBadge({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  if (!medals[rank]) return <span className="tabular-nums">{rank}</span>;
  return <span className="text-base">{medals[rank]}</span>;
}

function FormBadges({ form }: { form: ("W" | "D" | "L")[] }) {
  if (!form || form.length === 0) return null;
  const colorMap = {
    W: "bg-green-500",
    D: "bg-amber-500",
    L: "bg-red-500",
  };
  return (
    <div className="flex gap-0.5">
      {form.slice(-5).map((r, i) => (
        <span
          key={i}
          className={`size-2 rounded-full ${colorMap[r]}`}
          title={r === "W" ? "Victoire" : r === "D" ? "Nul" : "Défaite"}
        />
      ))}
    </div>
  );
}

function ClassementsTab({ slug }: { slug: string }) {
  const { data, isLoading } = usePublicStandings(slug);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Classements non disponibles"
        description="Les classements seront disponibles après les premiers matchs."
      />
    );
  }

  const filteredData =
    selectedCategory === "all"
      ? data
      : data.filter((cat) => String(cat.category.id) === selectedCategory);

  return (
    <div className="space-y-4">
      {/* Category selector */}
      {data.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          <Badge
            variant={selectedCategory === "all" ? "default" : "outline"}
            className="cursor-pointer shrink-0"
            onClick={() => setSelectedCategory("all")}
          >
            Toutes
          </Badge>
          {data.map((cat) => (
            <Badge
              key={cat.category.id}
              variant={selectedCategory === String(cat.category.id) ? "default" : "outline"}
              className="cursor-pointer shrink-0"
              onClick={() => setSelectedCategory(String(cat.category.id))}
            >
              {cat.category.name}
            </Badge>
          ))}
        </div>
      )}

      {filteredData.map((cat: CategoryStandings) => (
        <section key={cat.category.id}>
          <h2 className="text-base font-bold mb-3">{cat.category.name}</h2>
          {(cat.groups ?? []).length === 0 ? (
            <Card className="mb-3">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun groupe créé pour cette catégorie.
                </p>
              </CardContent>
            </Card>
          ) : (
            (cat.groups ?? []).map((g) => (
              <Card key={g.group.id} className="mb-3">
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm">{g.group.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  {g.standings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3 text-center">
                      Aucun classement disponible.
                    </p>
                  ) : (
                    <StandingsTable
                      standings={g.standings.map(standingToRow)}
                    />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      ))}
    </div>
  );
}

/* ── Infos Tab ───────────────────────────────────────────── */

function InfosTab({
  tournament,
}: {
  tournament: {
    name: string;
    location: string;
    start_date: string;
    end_date: string;
    description: string;
    categories: { id: number; name: string; color: string }[];
  };
}) {
  return (
    <div className="space-y-4">
      {tournament.description && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {tournament.description}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tournament.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <span>{tournament.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-muted-foreground shrink-0" />
            <span>
              {formatDate(tournament.start_date)}
              {tournament.end_date !== tournament.start_date &&
                ` – ${formatDate(tournament.end_date)}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground shrink-0" />
            <span>{tournament.categories.length} catégorie{tournament.categories.length > 1 ? "s" : ""}</span>
          </div>
        </CardContent>
      </Card>

      {tournament.categories.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Catégories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tournament.categories.map((c) => (
                <Badge
                  key={c.id}
                  variant="outline"
                  style={{
                    borderColor: c.color || undefined,
                    color: c.color || undefined,
                  }}
                >
                  {c.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */

export default function PublicTournament({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { data: tournament, isLoading: loadingTournament } =
    usePublicTournament(slug);
  const { data: liveData } = usePublicLive(slug);

  // WebSocket for real-time updates
  useTournamentSocket(slug);

  const liveCount = liveData?.live_matches?.length ?? 0;

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: publicKeys.all });
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="p-4 space-y-4 pb-safe">
        {/* Hero */}
        {loadingTournament ? (
          <div className="space-y-2 -mx-4 -mt-4 px-4 pt-4">
            <Skeleton className="h-32 w-full rounded-none" />
            <Skeleton className="h-7 w-56 rounded-lg" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
        ) : tournament ? (
          <HeroSection tournament={tournament} liveCount={liveCount} />
        ) : (
          <EmptyState
            icon={Info}
            title="Tournoi introuvable"
            description="Ce tournoi n'existe pas ou n'est pas encore publié."
          />
        )}

        {/* Sticky Tabs */}
        {tournament && (
          <Tabs defaultValue="live">
            <div className="sticky top-14 z-30 -mx-4 px-4 glass border-b border-border/50 pb-0">
              <TabsList className="w-full">
                <TabsTrigger value="live" className="flex-1 gap-1 transition-all">
                  <Radio className="size-3.5" />
                  Live
                </TabsTrigger>
                <TabsTrigger value="programme" className="flex-1 gap-1 transition-all">
                  <CalendarDays className="size-3.5" />
                  Matchs
                </TabsTrigger>
                <TabsTrigger value="classements" className="flex-1 gap-1">
                  <Trophy className="size-3.5" />
                  Classements
                </TabsTrigger>
                <TabsTrigger value="infos" className="flex-1 gap-1">
                  <Info className="size-3.5" />
                  Infos
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="live" className="mt-4">
              <LiveTab slug={slug} />
            </TabsContent>

            <TabsContent value="programme" className="mt-4">
              <ProgrammeTab slug={slug} />
            </TabsContent>

            <TabsContent value="classements" className="mt-4">
              <ClassementsTab slug={slug} />
            </TabsContent>

            <TabsContent value="infos" className="mt-4">
              <InfosTab tournament={tournament} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </PullToRefresh>
  );
}

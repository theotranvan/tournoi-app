"use client";

import { useMemo } from "react";
import {
  Trophy,
  Calendar,
  Users,
  Zap,
  Plus,
  ClipboardList,
  MapPin,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationBell } from "@/components/ui/notification-bell";
import { useTournaments } from "@/hooks/use-tournaments";
import Link from "next/link";
import type { TournamentList } from "@/types/api";

/* ── Stat Card ─────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className={`size-8 rounded-lg bg-accent flex items-center justify-center`}>
            <Icon className={`size-4 ${color}`} />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Live Tournament Card ──────────────────────────────────────── */

function LiveTournamentCard({ t }: { t: TournamentList }) {
  return (
    <Link href={`/admin/tournois/${t.id}`}>
      <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <LiveIndicator size="sm" />
                <span className="font-semibold truncate">{t.name}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {t.location}
                </span>
                <span>{t.nb_teams} équipes</span>
                <span>{t.nb_matches} matchs</span>
              </div>
            </div>
            <span className="text-xs font-medium text-primary flex items-center gap-1 shrink-0">
              Gérer
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ── Tournament Row ────────────────────────────────────────────── */

const statusLabel: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  live: "En cours",
  finished: "Terminé",
  archived: "Archivé",
};
const statusDot: Record<string, string> = {
  draft: "bg-muted-foreground",
  published: "bg-blue-400",
  live: "bg-green-500",
  finished: "bg-emerald-400",
  archived: "bg-muted-foreground",
};

function TournamentQuickCard({ t }: { t: TournamentList }) {
  return (
    <Link href={`/admin/tournois/${t.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`size-2.5 rounded-full shrink-0 ${statusDot[t.status]}`} />
              <div className="min-w-0">
                <p className="font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.location} •{" "}
                  {new Date(t.start_date).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
              <span className="text-[10px] text-muted-foreground">
                {statusLabel[t.status]}
              </span>
              <span className="text-xs font-medium tabular-nums">
                {t.nb_teams} éq. • {t.nb_matches} matchs
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────── */

export default function AdminDashboard() {
  const { data, isLoading } = useTournaments();

  const tournaments = data?.results ?? [];

  const { active, totalTeams, totalMatches, liveTournaments, recentNonLive } =
    useMemo(() => {
      const active = tournaments.filter(
        (t) => t.status === "live" || t.status === "published"
      );
      const totalTeams = tournaments.reduce((s, t) => s + t.nb_teams, 0);
      const totalMatches = tournaments.reduce((s, t) => s + t.nb_matches, 0);
      const liveTournaments = tournaments.filter((t) => t.status === "live");
      const recentNonLive = tournaments.filter((t) => t.status !== "live").slice(0, 5);
      return { active, totalTeams, totalMatches, liveTournaments, recentNonLive };
    }, [tournaments]);

  return (
    <div className="p-4 md:p-6 space-y-6 pb-safe">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble de vos tournois
          </p>
        </div>
        <NotificationBell className="md:hidden" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Tournois actifs"
          value={active.length}
          icon={Trophy}
          color="text-primary"
          loading={isLoading}
        />
        <StatCard
          label="Matchs total"
          value={totalMatches}
          icon={Calendar}
          color="text-blue-400"
          loading={isLoading}
        />
        <StatCard
          label="Équipes inscrites"
          value={totalTeams}
          icon={Users}
          color="text-violet-400"
          loading={isLoading}
        />
        <StatCard
          label="En direct"
          value={liveTournaments.length}
          icon={Zap}
          color="text-live"
          loading={isLoading}
        />
      </div>

      {/* Live tournaments highlight */}
      {liveTournaments.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Tournois en direct
          </h2>
          {liveTournaments.map((t) => (
            <LiveTournamentCard key={t.id} t={t} />
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Actions rapides
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Link href="/admin/tournois/new">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="py-4 flex flex-col items-center gap-2 text-center">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="size-5 text-primary" />
                </div>
                <span className="text-sm font-medium">Nouveau tournoi</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/planning">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="py-4 flex flex-col items-center gap-2 text-center">
                <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CalendarDays className="size-5 text-blue-400" />
                </div>
                <span className="text-sm font-medium">Planning</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/equipes">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="py-4 flex flex-col items-center gap-2 text-center">
                <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <ClipboardList className="size-5 text-violet-400" />
                </div>
                <span className="text-sm font-medium">Équipes</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Recent tournaments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tournois récents</CardTitle>
            <Link
              href="/admin/tournois"
              className="text-xs text-primary hover:underline"
            >
              Voir tout
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tournaments.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Aucun tournoi"
              description="Créez votre premier tournoi pour commencer."
              action={
                <Link href="/admin/tournois/new">
                  <Button size="sm">
                    <Plus className="size-4 mr-1" />
                    Créer un tournoi
                  </Button>
                </Link>
              }
            />
          ) : (
            recentNonLive.map((t) => (
              <TournamentQuickCard key={t.id} t={t} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { use } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Loader2,
  Calendar,
  Users,
  Trophy,
  TrendingUp,
  Repeat,
} from "lucide-react";
import { useClub } from "@/hooks/use-clubs";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface TimelineEntry {
  tournament_id: string;
  tournament_name: string;
  date: string;
  team_count: number;
}

interface RecurringTeam {
  team_name: string;
  appearances: number;
  last_seen: string;
}

interface YearlyTeams {
  year: number;
  teams: { id: number; name: string; category: string }[];
}

interface ClubHistoryData {
  timeline: TimelineEntry[];
  recurring_teams: RecurringTeam[];
  yearly_teams: YearlyTeams[];
  stats: {
    total_tournaments: number;
    total_teams_entered: number;
    first_tournament_date: string | null;
    years_active: number;
  };
}

function useClubHistory(clubId: number) {
  return useQuery({
    queryKey: ["clubs", clubId, "history"],
    queryFn: () => api.get<ClubHistoryData>(`/clubs/${clubId}/history/`),
    enabled: clubId > 0,
  });
}

export default function ClubHistoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const clubId = parseInt(id, 10);
  const { data: club } = useClub(clubId);
  const { data: history, isLoading } = useClubHistory(clubId);

  if (isLoading || !club) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = history?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="size-6" />
          Historique — {club.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          Rétrospective de toutes les participations du club.
        </p>
      </div>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Tournois",
              value: stats.total_tournaments,
              icon: Trophy,
            },
            {
              label: "Équipes inscrites",
              value: stats.total_teams_entered,
              icon: Users,
            },
            {
              label: "Années actives",
              value: stats.years_active,
              icon: TrendingUp,
            },
            {
              label: "Depuis",
              value: stats.first_tournament_date
                ? new Date(stats.first_tournament_date).getFullYear()
                : "—",
              icon: Calendar,
            },
          ].map((s) => (
            <Card key={s.label} className="p-4 text-center">
              <s.icon className="size-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Timeline */}
      {history && history.timeline.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Calendar className="size-4" />
            Chronologie
          </h2>
          <div className="relative pl-6 border-l-2 border-primary/20 space-y-4">
            {history.timeline.map((entry) => (
              <div key={entry.tournament_id} className="relative">
                <div className="absolute -left-[calc(1.5rem+5px)] w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <div>
                  <p className="font-medium">{entry.tournament_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {new Date(entry.date).toLocaleDateString("fr-FR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {entry.team_count} équipe{entry.team_count > 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recurring teams */}
      {history && history.recurring_teams.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Repeat className="size-4" />
            Équipes récurrentes
          </h2>
          <div className="space-y-2">
            {history.recurring_teams.map((t) => (
              <div
                key={t.team_name}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
              >
                <span className="font-medium">{t.team_name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {t.appearances} participation{t.appearances > 1 ? "s" : ""}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    vu en {new Date(t.last_seen).getFullYear()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Yearly breakdown */}
      {history && history.yearly_teams.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Users className="size-4" />
            Équipes par année
          </h2>
          <div className="space-y-4">
            {history.yearly_teams.map((yt) => (
              <div key={yt.year}>
                <p className="font-medium mb-2">{yt.year}</p>
                <div className="flex flex-wrap gap-2">
                  {yt.teams.map((team) => (
                    <Badge key={team.id} variant="secondary">
                      {team.name}
                      <span className="text-muted-foreground ml-1">({team.category})</span>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!history?.timeline.length && (
        <Card className="p-8 text-center text-muted-foreground">
          <History className="size-12 mx-auto mb-3 opacity-50" />
          <p>Aucun historique de participation pour ce club.</p>
        </Card>
      )}
    </div>
  );
}

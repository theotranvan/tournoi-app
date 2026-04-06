"use client";

import { use } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Loader2,
  Swords,
  Shield,
  Target,
  Zap,
  Timer,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { useTournament } from "@/hooks";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Insight {
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: string;
}

interface TopScorer {
  player_name: string;
  team_name: string;
  goals: number;
}

interface FieldUtil {
  field_name: string;
  match_count: number;
  utilization_pct: number;
}

interface InsightsData {
  insights: Insight[];
  top_scorers: TopScorer[];
  field_utilization: FieldUtil[];
}

const iconMap: Record<string, React.ElementType> = {
  best_attack: Swords,
  best_defense: Shield,
  tightest_match: Zap,
  most_goals_match: Target,
  avg_goals: TrendingUp,
  avg_duration: Timer,
};

function useInsights(tournamentId: string) {
  return useQuery({
    queryKey: ["insights", tournamentId],
    queryFn: () => api.get<InsightsData>(`/tournaments/${tournamentId}/insights/`),
    enabled: !!tournamentId,
  });
}

export default function InsightsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: tournament } = useTournament(id);
  const { data: insights, isLoading } = useInsights(id);

  if (isLoading || !tournament) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!insights) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <BarChart3 className="size-12 mx-auto mb-3 opacity-50" />
        <p>Pas encore de données à analyser.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="size-6" />
          Insights du tournoi
        </h1>
        <p className="text-muted-foreground mt-1">
          Statistiques automatiques et tendances de {tournament.name}.
        </p>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.insights.map((ins) => {
          const Icon = iconMap[ins.key] ?? TrendingUp;
          return (
            <Card key={ins.key} className="p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">{ins.label}</p>
                  <p className="text-xl font-bold mt-1">{ins.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{ins.detail}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Top scorers */}
      {insights.top_scorers.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Target className="size-4" />
            Meilleurs buteurs
          </h2>
          <div className="space-y-2">
            {insights.top_scorers.map((s, i) => (
              <div
                key={`${s.player_name}-${s.team_name}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
              >
                <span className="text-lg font-bold w-8 text-center text-muted-foreground">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{s.player_name}</p>
                  <p className="text-xs text-muted-foreground">{s.team_name}</p>
                </div>
                <Badge variant="secondary" className="text-sm font-bold">
                  {s.goals} but{s.goals > 1 ? "s" : ""}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Field utilization */}
      {insights.field_utilization.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <MapPin className="size-4" />
            Utilisation des terrains
          </h2>
          <div className="space-y-3">
            {insights.field_utilization.map((f) => (
              <div key={f.field_name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{f.field_name}</span>
                  <span className="text-muted-foreground">
                    {f.match_count} matchs · {Math.round(f.utilization_pct)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, f.utilization_pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

"use client";

import { use, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FlaskConical,
  RotateCcw,
  Trophy,
  ArrowUpDown,
  Loader2,
  Info,
} from "lucide-react";
import { useCategories, useMatches, useTeams } from "@/hooks";
import { useCategoryStandings } from "@/hooks/use-standings";
import type {
  MatchList,
  TeamStanding,
  GroupStandings,
  CategoryStandings,
  Category,
} from "@/types/api";

interface SimScore {
  home: number | null;
  away: number | null;
}

function computeStandings(
  matches: MatchList[],
  overrides: Map<string, SimScore>,
  category: Category,
  originalStandings: GroupStandings[],
): GroupStandings[] {
  return originalStandings.map((group) => {
    // Build fresh standings from scratch
    const teamMap = new Map<number, TeamStanding>();
    for (const ts of group.standings) {
      teamMap.set(ts.team_id, {
        ...ts,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
        rank: 0,
        form: [],
      });
    }

    // Get group match IDs
    const groupMatches = matches.filter(
      (m) =>
        m.group === group.group.id &&
        m.category === category.id &&
        m.phase === "group",
    );

    for (const m of groupMatches) {
      const override = overrides.get(m.id);
      const sh = override?.home ?? m.score_home;
      const sa = override?.away ?? m.score_away;

      if (sh === null || sa === null || m.team_home === null || m.team_away === null)
        continue;

      const home = teamMap.get(m.team_home);
      const away = teamMap.get(m.team_away);
      if (!home || !away) continue;

      home.played++;
      away.played++;
      home.goals_for += sh;
      home.goals_against += sa;
      away.goals_for += sa;
      away.goals_against += sh;

      if (sh > sa) {
        home.won++;
        away.lost++;
        home.points += category.points_win;
        away.points += category.points_loss;
        home.form.push("W");
        away.form.push("L");
      } else if (sh < sa) {
        away.won++;
        home.lost++;
        away.points += category.points_win;
        home.points += category.points_loss;
        home.form.push("L");
        away.form.push("W");
      } else {
        home.drawn++;
        away.drawn++;
        home.points += category.points_draw;
        away.points += category.points_draw;
        home.form.push("D");
        away.form.push("D");
      }

      home.goal_difference = home.goals_for - home.goals_against;
      away.goal_difference = away.goals_for - away.goals_against;
    }

    // Sort
    const sorted = Array.from(teamMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.team_name.localeCompare(b.team_name);
    });

    sorted.forEach((ts, i) => (ts.rank = i + 1));

    return { group: group.group, standings: sorted };
  });
}

function StandingsTable({
  standings,
  original,
}: {
  standings: TeamStanding[];
  original: TeamStanding[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="text-left p-2">#</th>
            <th className="text-left p-2">Équipe</th>
            <th className="text-center p-2">Pts</th>
            <th className="text-center p-2">J</th>
            <th className="text-center p-2">V</th>
            <th className="text-center p-2">N</th>
            <th className="text-center p-2">D</th>
            <th className="text-center p-2">BP</th>
            <th className="text-center p-2">BC</th>
            <th className="text-center p-2">Diff</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((ts) => {
            const orig = original.find((o) => o.team_id === ts.team_id);
            const rankDiff = orig ? orig.rank - ts.rank : 0;
            return (
              <tr key={ts.team_id} className="border-b hover:bg-muted/50">
                <td className="p-2 font-medium">
                  {ts.rank}
                  {rankDiff > 0 && (
                    <span className="text-green-600 text-xs ml-1">▲{rankDiff}</span>
                  )}
                  {rankDiff < 0 && (
                    <span className="text-red-600 text-xs ml-1">▼{Math.abs(rankDiff)}</span>
                  )}
                </td>
                <td className="p-2">{ts.team_name}</td>
                <td className="text-center p-2 font-bold">{ts.points}</td>
                <td className="text-center p-2">{ts.played}</td>
                <td className="text-center p-2">{ts.won}</td>
                <td className="text-center p-2">{ts.drawn}</td>
                <td className="text-center p-2">{ts.lost}</td>
                <td className="text-center p-2">{ts.goals_for}</td>
                <td className="text-center p-2">{ts.goals_against}</td>
                <td className="text-center p-2">{ts.goal_difference}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SimulatorPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const { data: categories } = useCategories(id);
  const { data: matchesData } = useMatches(id);
  const [overrides, setOverrides] = useState(new Map<string, SimScore>());
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const matches = matchesData?.results ?? [];
  const activeCat = categories?.find((c) => c.id === selectedCategory) ?? categories?.[0];

  // Load standings for active category
  const { data: catStandings } = useCategoryStandings(
    activeCat?.id ?? 0,
  );

  // Unplayed group matches for this category
  const unplayedMatches = useMemo(() => {
    if (!activeCat) return [];
    return matches
      .filter(
        (m) =>
          m.category === activeCat.id &&
          m.phase === "group" &&
          m.team_home !== null &&
          m.team_away !== null,
      )
      .sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
  }, [matches, activeCat]);

  const onlyUnplayed = useMemo(
    () => unplayedMatches.filter((m) => m.score_home === null),
    [unplayedMatches],
  );

  // Compute simulated standings
  const simStandings = useMemo(() => {
    if (!catStandings || !activeCat) return null;
    return computeStandings(matches, overrides, activeCat, catStandings.groups);
  }, [matches, overrides, activeCat, catStandings]);

  const setScore = (matchId: string, side: "home" | "away", value: string) => {
    const num = value === "" ? null : Math.max(0, parseInt(value, 10));
    if (value !== "" && isNaN(num as number)) return;
    setOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(matchId) ?? { home: null, away: null };
      next.set(matchId, { ...existing, [side]: num });
      return next;
    });
  };

  const reset = () => setOverrides(new Map());

  const modifiedCount = Array.from(overrides.values()).filter(
    (s) => s.home !== null || s.away !== null,
  ).length;

  if (!categories) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="size-6" />
          Simulateur de scénarios
        </h1>
        <p className="text-muted-foreground mt-1">
          Modifiez les scores des matchs pour voir l&apos;impact sur les classements en temps réel.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={(activeCat?.id === cat.id) ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {modifiedCount > 0 && (
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {modifiedCount} score{modifiedCount > 1 ? "s" : ""} modifié{modifiedCount > 1 ? "s" : ""}
          </Badge>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-4 mr-1" />
            Réinitialiser
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: match inputs */}
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <ArrowUpDown className="size-4" />
            Matchs ({onlyUnplayed.length} non joués)
          </h2>

          {onlyUnplayed.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">
              <p>Tous les matchs de poule ont été joués.</p>
              <p className="text-xs mt-1">Modifiez les scores existants ci-dessous.</p>
            </Card>
          )}

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {unplayedMatches.map((m) => {
              const override = overrides.get(m.id);
              const sh = override?.home ?? m.score_home;
              const sa = override?.away ?? m.score_away;
              const isModified = override && (override.home !== null || override.away !== null);

              return (
                <Card
                  key={m.id}
                  className={`p-3 ${isModified ? "ring-2 ring-primary/40" : ""}`}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>{m.field_name ?? "—"}</span>
                    <span>·</span>
                    <span>
                      {new Date(m.start_time).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {m.score_home !== null && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        Joué
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-medium text-right truncate">
                      {m.display_home}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      className="w-14 text-center"
                      value={sh ?? ""}
                      onChange={(e) => setScore(m.id, "home", e.target.value)}
                      placeholder="—"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      className="w-14 text-center"
                      value={sa ?? ""}
                      onChange={(e) => setScore(m.id, "away", e.target.value)}
                      placeholder="—"
                    />
                    <span className="flex-1 text-sm font-medium truncate">
                      {m.display_away}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right: live standings */}
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Trophy className="size-4" />
            Classements simulés
          </h2>

          <Card className="p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-sm flex items-start gap-2">
            <Info className="size-4 text-blue-600 mt-0.5 shrink-0" />
            <span>
              Les classements se recalculent automatiquement quand vous saisissez des scores.
              Aucune donnée n&apos;est sauvegardée.
            </span>
          </Card>

          {simStandings?.map((group) => {
            const origGroup = catStandings?.groups.find(
              (g) => g.group.id === group.group.id,
            );
            return (
              <Card key={group.group.id} className="p-4">
                <h3 className="font-medium text-sm mb-3">{group.group.name}</h3>
                <StandingsTable
                  standings={group.standings}
                  original={origGroup?.standings ?? []}
                />
              </Card>
            );
          })}

          {!simStandings && (
            <Card className="p-8 text-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Chargement des classements…</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

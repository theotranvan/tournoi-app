"use client";

import { use, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical,
  RotateCcw,
  Trophy,
  Loader2,
  Info,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Minus,
  Plus,
  BarChart3,
  List,
} from "lucide-react";
import { useCategories, useMatches, useTeams } from "@/hooks";
import { useCategoryStandings } from "@/hooks/use-standings";
import type {
  MatchList,
  TeamStanding,
  GroupStandings,
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

// ─── Score Button ─────────────────────────────────────────────────────────

function ScoreControl({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
}) {
  const score = value ?? 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm font-medium truncate max-w-[120px] text-center">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="size-12 rounded-full text-lg"
          onClick={() => onChange(Math.max(0, score - 1))}
          disabled={score <= 0}
        >
          <Minus className="size-5" />
        </Button>
        <span className="text-5xl font-bold tabular-nums w-16 text-center">
          {value !== null ? value : "–"}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-12 rounded-full text-lg"
          onClick={() => onChange(score + 1)}
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  );
}

// ─── View Toggle ──────────────────────────────────────────────────────────

type SimView = "wizard" | "standings";

export default function SimulatorPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const { data: categories } = useCategories(id);
  const { data: matchesData } = useMatches(id);
  const [overrides, setOverrides] = useState(new Map<string, SimScore>());
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [view, setView] = useState<SimView>("wizard");

  const matches = matchesData?.results ?? [];
  const activeCat = categories?.find((c) => c.id === selectedCategory) ?? categories?.[0];

  const { data: catStandings } = useCategoryStandings(activeCat?.id ?? 0);

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

  const simStandings = useMemo(() => {
    if (!catStandings || !activeCat) return null;
    return computeStandings(matches, overrides, activeCat, catStandings.groups);
  }, [matches, overrides, activeCat, catStandings]);

  const setScore = useCallback((matchId: string, side: "home" | "away", value: number | null) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(matchId) ?? { home: null, away: null };
      next.set(matchId, { ...existing, [side]: value });
      return next;
    });
  }, []);

  const reset = () => {
    setOverrides(new Map());
    setCurrentIndex(0);
  };

  const modifiedCount = Array.from(overrides.values()).filter(
    (s) => s.home !== null || s.away !== null,
  ).length;

  const safeIndex = Math.min(currentIndex, Math.max(0, onlyUnplayed.length - 1));
  const currentMatch = onlyUnplayed[safeIndex];

  if (!categories) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="size-5" />
            Simulateur
          </h1>
        </div>
        {modifiedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-4 mr-1" />
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Category selector */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={activeCat?.id === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelectedCategory(cat.id);
              setCurrentIndex(0);
            }}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <Button
          variant={view === "wizard" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("wizard")}
          className="gap-1.5"
        >
          <List className="size-3.5" />
          Match par match
        </Button>
        <Button
          variant={view === "standings" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("standings")}
          className="gap-1.5"
        >
          <BarChart3 className="size-3.5" />
          Classements
        </Button>
      </div>

      {view === "wizard" ? (
        <>
          {/* Progress */}
          {onlyUnplayed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Match {safeIndex + 1} / {onlyUnplayed.length}</span>
                <span>{modifiedCount} score{modifiedCount > 1 ? "s" : ""} saisi{modifiedCount > 1 ? "s" : ""}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${((safeIndex + 1) / onlyUnplayed.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Current match card */}
          {currentMatch ? (
            <Card className="p-6">
              <div className="text-center space-y-1 mb-6">
                <div className="text-xs text-muted-foreground">
                  {currentMatch.field_name ?? "Terrain non défini"} · {" "}
                  {new Date(currentMatch.start_time).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {currentMatch.phase === "group" && (
                  <Badge variant="outline" className="text-xs">
                    Poule
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-center gap-6 sm:gap-10">
                <ScoreControl
                  label={currentMatch.display_home ?? "Domicile"}
                  value={overrides.get(currentMatch.id)?.home ?? currentMatch.score_home}
                  onChange={(v) => setScore(currentMatch.id, "home", v)}
                />
                <span className="text-2xl font-bold text-muted-foreground">–</span>
                <ScoreControl
                  label={currentMatch.display_away ?? "Extérieur"}
                  value={overrides.get(currentMatch.id)?.away ?? currentMatch.score_away}
                  onChange={(v) => setScore(currentMatch.id, "away", v)}
                />
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={safeIndex === 0}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Précédent
                </Button>
                <Button
                  onClick={() => {
                    if (safeIndex < onlyUnplayed.length - 1) {
                      setCurrentIndex((i) => i + 1);
                    } else {
                      setView("standings");
                    }
                  }}
                >
                  {safeIndex < onlyUnplayed.length - 1 ? (
                    <>
                      Suivant
                      <ChevronRight className="size-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Voir classements
                      <Trophy className="size-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              <Trophy className="size-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium">Tous les matchs ont été joués</p>
              <p className="text-xs mt-1">
                Consultez les classements simulés.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setView("standings")}
              >
                <BarChart3 className="size-4 mr-1" />
                Voir classements
              </Button>
            </Card>
          )}

          {/* Mini standings preview */}
          {simStandings && simStandings.length > 0 && (
            <Card className="p-3 bg-muted/50">
              <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                <Trophy className="size-3.5" />
                Apercu classements
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {simStandings.map((group) => (
                  <div key={group.group.id} className="text-xs space-y-0.5">
                    <span className="font-medium">{group.group.name}</span>
                    {group.standings.slice(0, 3).map((ts) => (
                      <div key={ts.team_id} className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-medium w-4">{ts.rank}.</span>
                        <span className="truncate flex-1">{ts.team_name}</span>
                        <span className="font-bold">{ts.points} pts</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        /* Full standings view */
        <div className="space-y-4">
          <Card className="p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-sm flex items-start gap-2">
            <Info className="size-4 text-blue-600 mt-0.5 shrink-0" />
            <span>
              Classements recalculés en temps réel à partir de vos scores simulés.
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
              <p className="text-sm">Chargement des classements...</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Trophy, HelpCircle } from "lucide-react";
import type { MatchList, MatchPhase, ScheduleDay } from "@/types/api";

const PHASE_SHORT: Record<MatchPhase, string> = {
  group: "Poule",
  r16: "1/8",
  quarter: "1/4",
  semi: "Demi",
  third: "3e",
  final: "Finale",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TeamJourneyProps {
  teamName: string;
  schedule: ScheduleDay[];
  onClose: () => void;
}

export function TeamJourney({ teamName, schedule, onClose }: TeamJourneyProps) {
  // Collect all matches for this team across all days
  const teamMatches = useMemo(() => {
    const matches: MatchList[] = [];
    for (const day of schedule) {
      for (const fs of day.fields) {
        for (const m of fs.matches) {
          if (m.display_home === teamName || m.display_away === teamName) {
            matches.push(m);
          }
        }
      }
    }
    return matches.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [teamName, schedule]);

  if (teamMatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Aucun match trouvé pour {teamName}.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" />
            Parcours de {teamName}
          </CardTitle>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Fermer
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Horizontal timeline */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-0 min-w-max">
            {teamMatches.map((match, i) => {
              const isHome = match.display_home === teamName;
              const opponent = isHome
                ? match.display_away
                : match.display_home;
              const hasScore =
                match.score_home !== null && match.score_away !== null;
              const teamScore = isHome
                ? match.score_home
                : match.score_away;
              const oppScore = isHome
                ? match.score_away
                : match.score_home;

              let resultColor = "text-muted-foreground";
              let resultLabel = "?";
              if (hasScore && teamScore !== null && oppScore !== null) {
                if (teamScore > oppScore) {
                  resultColor = "text-green-400";
                  resultLabel = `V ${teamScore}-${oppScore}`;
                } else if (teamScore < oppScore) {
                  resultColor = "text-red-400";
                  resultLabel = `D ${teamScore}-${oppScore}`;
                } else {
                  resultColor = "text-amber-400";
                  resultLabel = `N ${teamScore}-${oppScore}`;
                }
              }

              const restMinutes =
                i > 0
                  ? Math.round(
                      (new Date(match.start_time).getTime() -
                        new Date(teamMatches[i - 1].start_time).getTime() -
                        teamMatches[i - 1].duration_minutes * 60_000) /
                        60_000
                    )
                  : null;

              return (
                <div key={match.id} className="flex items-center">
                  {/* Arrow separator with rest time */}
                  {i > 0 && (
                    <div className="flex flex-col items-center px-2">
                      <ArrowRight className="size-4 text-muted-foreground" />
                      {restMinutes !== null && (
                        <span
                          className={`text-[9px] mt-0.5 ${
                            restMinutes < 15
                              ? "text-red-400"
                              : restMinutes < 30
                                ? "text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {restMinutes}min
                        </span>
                      )}
                    </div>
                  )}

                  {/* Match node */}
                  <div className="flex flex-col items-center rounded-lg border p-3 min-w-[120px] text-center bg-card">
                    <span className="text-[10px] text-muted-foreground mb-1">
                      {formatTime(match.start_time)}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 mb-1"
                    >
                      {PHASE_SHORT[match.phase]}
                    </Badge>
                    <span className="text-xs font-medium truncate max-w-[100px]">
                      vs {opponent}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {match.field_name}
                    </span>
                    <span className={`text-sm font-bold mt-1 ${resultColor}`}>
                      {hasScore ? resultLabel : (
                        <HelpCircle className="size-3.5 inline text-muted-foreground" />
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground border-t pt-3">
          <span>{teamMatches.length} match{teamMatches.length > 1 ? "s" : ""}</span>
          <span>
            {teamMatches.filter(
              (m) =>
                m.score_home !== null &&
                m.score_away !== null &&
                ((m.display_home === teamName &&
                  m.score_home! > m.score_away!) ||
                  (m.display_away === teamName &&
                    m.score_away! > m.score_home!))
            ).length}{" "}
            victoire(s)
          </span>
          <span>
            {teamMatches.filter(
              (m) =>
                m.score_home !== null &&
                m.score_away !== null &&
                ((m.display_home === teamName &&
                  m.score_home! < m.score_away!) ||
                  (m.display_away === teamName &&
                    m.score_away! < m.score_home!))
            ).length}{" "}
            défaite(s)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import {
  X,
  AlertTriangle,
  Clock,
  Maximize2,
} from "lucide-react";
import type { MatchList, ScheduleDay, ScheduleConflict } from "@/types/api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface BriefingModeProps {
  schedule: ScheduleDay[];
  conflicts: ScheduleConflict[];
  onClose: () => void;
}

export function BriefingMode({ schedule, conflicts, onClose }: BriefingModeProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(interval);
  }, []);

  // Collect all matches flat
  const allMatches = useMemo(() => {
    const matches: (MatchList & { fieldName: string })[] = [];
    for (const day of schedule) {
      for (const fs of day.fields) {
        for (const m of fs.matches) {
          matches.push({ ...m, fieldName: fs.field.name });
        }
      }
    }
    return matches.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [schedule]);

  // Upcoming matches (next 60 minutes)
  const upcoming = useMemo(() => {
    const nowMs = now.getTime();
    const limit = nowMs + 60 * 60_000;
    return allMatches.filter((m) => {
      const t = new Date(m.start_time).getTime();
      return t >= nowMs - 5 * 60_000 && t <= limit;
    });
  }, [allMatches, now]);

  // Live matches
  const liveMatches = allMatches.filter((m) => m.status === "live");

  // Group upcoming by field
  const byField = useMemo(() => {
    const map = new Map<string, typeof upcoming>();
    for (const m of upcoming) {
      const list = map.get(m.fieldName) ?? [];
      list.push(m);
      map.set(m.fieldName, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [upcoming]);

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Maximize2 className="size-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Mode Briefing</h1>
              <p className="text-sm text-muted-foreground">
                Table ronde de l&apos;organisateur
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="size-4 mr-1" />
            Quitter
          </Button>
        </div>

        {/* Current time - big clock */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <Clock className="size-8 text-primary animate-pulse" />
              <span className="text-5xl font-bold tabular-nums tracking-tight">
                {now.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {now.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </CardContent>
        </Card>

        {/* Live matches */}
        {liveMatches.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold flex items-center gap-2 text-green-400">
              <LiveIndicator size="sm" />
              Matchs en cours ({liveMatches.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {liveMatches.map((m) => (
                <Card
                  key={m.id}
                  className="border-green-500/30 bg-green-500/5"
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{m.fieldName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {formatTime(m.start_time)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-base font-semibold">
                      {m.display_home}{" "}
                      <span className="text-green-400">
                        {m.score_home ?? 0} - {m.score_away ?? 0}
                      </span>{" "}
                      {m.display_away}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.category_name}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming by field */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">
            Prochaine heure ({upcoming.length} match{upcoming.length > 1 ? "s" : ""})
          </h2>
          {byField.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun match dans la prochaine heure.
            </p>
          ) : (
            <div className="space-y-3">
              {byField.map(([fieldName, matches]) => (
                <Card key={fieldName}>
                  <CardContent className="py-3 px-4">
                    <p className="font-semibold text-sm mb-2">{fieldName}</p>
                    <div className="space-y-1.5">
                      {matches.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            {m.display_home} vs {m.display_away}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5"
                            >
                              {m.category_name}
                            </Badge>
                            <span className="font-medium tabular-nums">
                              {formatTime(m.start_time)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-lg flex items-center gap-2 text-amber-400">
              <AlertTriangle className="size-5" />
              Conflits à résoudre ({conflicts.length})
            </h2>
            <Card className="border-amber-500/30">
              <CardContent className="py-3">
                <ul className="space-y-1.5 text-sm">
                  {conflicts.map((c) => (
                    <li
                      key={`${c.match_id}-${c.type}`}
                      className="flex items-start gap-2"
                    >
                      <AlertTriangle className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span>{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  Loader2,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { useDiagnostics } from "@/hooks/use-schedule";
import { useSuggestSwap, useRecalculateSchedule } from "@/hooks/use-mutations";
import {
  penaltySeverity,
  SEVERITY_COLORS,
} from "@/lib/scheduling-explain";
import type { MatchDiagnostic, DiagnosticPenalty } from "@/types/api";

function scoreColor(score: number) {
  if (score >= 950) return "text-green-400";
  if (score >= 900) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function GlobalScoreGauge({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "text-green-500" : score >= 50 ? "text-amber-500" : "text-red-500";
  const strokeClass = score >= 75 ? "stroke-green-500" : score >= 50 ? "stroke-amber-500" : "stroke-red-500";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className={strokeClass}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-xl font-bold ${color}`}>{Math.round(score)}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function PenaltyBadge({ penalty }: { penalty: DiagnosticPenalty }) {
  const severity = penaltySeverity(penalty.amount);
  return (
    <div className={`text-xs px-2 py-1 rounded border ${SEVERITY_COLORS[severity]}`}>
      <span className="font-medium">{penalty.amount > 0 ? "+" : ""}{penalty.amount}</span>
      {" "}{penalty.detail}
    </div>
  );
}

function MatchDiagnosticRow({
  diag,
  tournamentId,
}: {
  diag: MatchDiagnostic;
  tournamentId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const suggestMut = useSuggestSwap(tournamentId);

  const hasPenalties = diag.penalties.length > 0;
  const worstPenalty = hasPenalties
    ? Math.min(...diag.penalties.map((p) => p.amount))
    : 0;

  const rowBorder =
    worstPenalty <= -20
      ? "border-red-500/30"
      : worstPenalty <= -10
        ? "border-amber-500/30"
        : "border-border";

  return (
    <div className={`border rounded-lg ${rowBorder}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{diag.display}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
            {diag.field_name && <span>{diag.field_name}</span>}
            {diag.start_time && (
              <span>
                {new Date(diag.start_time).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {diag.penalties.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {diag.penalties.length} pénalité{diag.penalties.length > 1 ? "s" : ""}
            </Badge>
          )}
          <span className={`text-sm font-bold tabular-nums ${scoreColor(diag.score)}`}>
            {Math.round(diag.score)}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
          {/* Rest info */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            {diag.rest_before_home_minutes != null && (
              <span>Repos dom. : {diag.rest_before_home_minutes} min</span>
            )}
            {diag.rest_before_away_minutes != null && (
              <span>Repos ext. : {diag.rest_before_away_minutes} min</span>
            )}
          </div>

          {/* Penalties */}
          {diag.penalties.length > 0 ? (
            <div className="space-y-1">
              {diag.penalties.map((p, i) => (
                <PenaltyBadge key={i} penalty={p} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-green-400">Aucune pénalité.</p>
          )}

          {/* Suggest swap button */}
          {hasPenalties && (
            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSuggestion(true);
                  suggestMut.mutate({ matchId: diag.match_id });
                }}
                disabled={suggestMut.isPending}
              >
                {suggestMut.isPending ? (
                  <Loader2 className="size-3 mr-1 animate-spin" />
                ) : (
                  <Lightbulb className="size-3 mr-1" />
                )}
                Suggérer un échange
              </Button>

              {showSuggestion &&
                suggestMut.isSuccess &&
                suggestMut.data &&
                typeof suggestMut.data === "object" &&
                "description" in suggestMut.data && (
                <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20 text-xs space-y-1.5">
                  <p>{String(suggestMut.data.description)}</p>
                  <Button
                    size="sm"
                    className="text-xs h-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      suggestMut.mutate({
                        matchId: diag.match_id,
                        apply: true,
                      });
                    }}
                    disabled={suggestMut.isPending}
                  >
                    <ArrowUpDown className="size-3 mr-1" />
                    Appliquer l&apos;échange
                  </Button>
                </div>
              )}

              {showSuggestion && suggestMut.isError && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Aucun échange améliorant trouvé.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiagnosticsContent({
  data,
  tournamentId,
}: {
  data: { global_score: number; matches: MatchDiagnostic[] };
  tournamentId: string;
}) {
  const recalcMut = useRecalculateSchedule(tournamentId);

  // Get match IDs with penalties
  const problemMatchIds = data.matches
    .filter((m) => m.penalties.length > 0)
    .map((m) => m.match_id);

  return (
    <div className="space-y-4">
      {/* Global score */}
      <div className="flex items-center gap-4">
        <GlobalScoreGauge score={data.global_score} />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold">
            Score global du planning
          </p>
          <p className="text-xs text-muted-foreground">
            {data.matches.length} matchs analysés •{" "}
            {data.matches.filter((m) => m.penalties.length > 0).length} avec
            pénalités
          </p>
          {problemMatchIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 mt-1"
              onClick={() =>
                recalcMut.mutate(problemMatchIds.map(Number))
              }
              disabled={recalcMut.isPending}
            >
              {recalcMut.isPending ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="size-3 mr-1" />
              )}
              Corriger automatiquement ({problemMatchIds.length} matchs)
            </Button>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBg(data.global_score)}`}
          style={{ width: `${Math.min(100, data.global_score)}%` }}
        />
      </div>

      {/* Match list (sorted by score ascending = worst first) */}
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {data.matches.map((diag) => (
          <MatchDiagnosticRow
            key={diag.match_id}
            diag={diag}
            tournamentId={tournamentId}
          />
        ))}
      </div>
    </div>
  );
}

export function DiagnosticsPanel({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useDiagnostics(
    tournamentId,
    open
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs"
      >
        <Search className="size-3.5 mr-1" />
        Analyser le planning
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <Card className="w-full sm:max-w-2xl sm:mx-4 max-h-[85vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl">
            <CardHeader className="pb-2 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="size-4" />
                Diagnostic du planning
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 pb-safe">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Skeleton className="size-[100px] rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : isError ? (
                <p className="text-xs text-muted-foreground">
                  Impossible de charger le diagnostic. Vérifiez qu&apos;un planning existe.
                </p>
              ) : data ? (
                <DiagnosticsContent
                  data={data}
                  tournamentId={tournamentId}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

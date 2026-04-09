"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Info, TrendingUp } from "lucide-react";
import { useFeasibility } from "@/hooks/use-schedule";
import type { FeasibilityResult } from "@/types/api";

function scoreColor(score: number) {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Bon";
  if (score >= 50) return "Moyen";
  if (score >= 25) return "Difficile";
  return "Critique";
}

/** Derive a 0-100 score from utilization %.
 *  - 0-70% utilization → score 100-75 (comfortable)
 *  - 70-90% → score 75-50
 *  - 90-100% → score 50-25
 *  - >100% → score 0
 */
function deriveScore(utilization: number, feasible: boolean): number {
  if (!feasible) return Math.min(20, Math.max(0, 100 - utilization));
  if (utilization <= 70) return 100 - (utilization / 70) * 25;     // 100→75
  if (utilization <= 90) return 75 - ((utilization - 70) / 20) * 25; // 75→50
  if (utilization <= 100) return 50 - ((utilization - 90) / 10) * 25; // 50→25
  return 0;
}

function CircularGauge({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={scoreBg(score)}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-xl font-bold ${scoreColor(score)}`}>
          {Math.round(score)}%
        </span>
      </div>
    </div>
  );
}

function UtilizationBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={scoreColor(100 - Math.max(0, value - 80))}>{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBg(100 - Math.max(0, value - 80))}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function FeasibilityContent({ data }: { data: FeasibilityResult }) {
  const score = data.feasibility_score ?? deriveScore(data.utilization, data.feasible);
  const totalMatches = data.total_matches;
  const totalSlots = data.total_available_slots ?? data.total_slots ?? 0;

  // Derive bottlenecks from day_details
  const warnings: string[] = [...(data.bottlenecks ?? [])];
  for (const dd of data.day_details) {
    if (!dd.feasible) {
      warnings.push(
        `${dd.day} : ${dd.day_match_count} matchs pour ${dd.parallel_slots} créneaux (${dd.playable_min} min jouables)`
      );
    }
  }
  if (data.utilization > 90 && warnings.length === 0) {
    warnings.push("Taux d'utilisation très élevé (>90%) — peu de marge.");
  }

  return (
    <div className="space-y-4">
      {/* Score + summary */}
      <div className="flex items-center gap-4">
        <CircularGauge score={score} />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${scoreColor(score)}`}>
              {scoreLabel(score)}
            </span>
            <Badge variant={data.feasible ? "default" : "destructive"} className="text-[10px]">
              {data.feasible ? "Réalisable" : "Non réalisable"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="text-foreground font-medium">{totalMatches}</span> matchs
            </div>
            <div>
              <span className="text-foreground font-medium">{data.fields_count}</span> terrains
            </div>
            <div>
              <span className="text-foreground font-medium">{data.days_count}</span> jour{data.days_count !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {totalSlots} créneaux disponibles • Utilisation globale {Math.round(data.utilization)}%
          </div>
        </div>
      </div>

      {/* Per-day utilization from day_details */}
      {data.day_details.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Utilisation par jour
          </h4>
          {data.day_details.map((dd) => {
            const dayUtil = dd.parallel_slots > 0
              ? (dd.day_match_count / dd.parallel_slots) * 100
              : 0;
            return (
              <UtilizationBar
                key={dd.day}
                label={`${dd.day} (${dd.day_match_count}/${dd.parallel_slots} créneaux)`}
                value={dayUtil}
              />
            );
          })}
        </div>
      )}

      {/* Legacy per-day (if old API) */}
      {data.days && data.days.length > 0 && data.day_details.length === 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Utilisation par jour
          </h4>
          {data.days.map((day) => (
            <UtilizationBar
              key={day.date}
              label={new Date(day.date + "T00:00:00").toLocaleDateString("fr-FR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              value={day.utilization}
            />
          ))}
        </div>
      )}

      {/* Per-category from cat_details */}
      {data.cat_details.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Par catégorie
          </h4>
          <div className="space-y-1.5">
            {data.cat_details.map((cat) => {
              const catPct = totalSlots > 0 ? (cat.match_count / totalSlots) * 100 : 0;
              return (
                <UtilizationBar
                  key={cat.name}
                  label={`${cat.name} (${cat.match_count} matchs)`}
                  value={catPct}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Legacy per-category */}
      {data.categories && data.categories.length > 0 && data.cat_details.length === 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Par catégorie
          </h4>
          <div className="space-y-1.5">
            {data.categories.map((cat) => (
              <UtilizationBar
                key={cat.id}
                label={`${cat.name} (${cat.teams} éq. • ${cat.matches} matchs)`}
                value={cat.utilization}
              />
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Points d&apos;attention
          </h4>
          <ul className="space-y-1">
            {warnings.map((tip, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length === 0 && score >= 75 && (
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <CheckCircle2 className="size-3.5" />
          Aucun problème détecté — le tournoi est bien dimensionné.
        </div>
      )}
    </div>
  );
}

export function FeasibilityPanel({ tournamentId }: { tournamentId: string }) {
  const { data, isLoading, isError } = useFeasibility(tournamentId);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="size-4" />
          Faisabilité du tournoi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Skeleton className="size-[100px] rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-3.5" />
            Impossible de calculer la faisabilité. Vérifiez que le tournoi a des catégories, équipes et terrains.
          </div>
        ) : data ? (
          <FeasibilityContent data={data} />
        ) : null}
      </CardContent>
    </Card>
  );
}

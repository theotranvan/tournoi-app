"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Category, TournamentField, MatchList } from "@/types/api";
import type { TournamentDetail } from "@/types/api";

interface ChecklistStep {
  id: string;
  label: string;
  done: boolean;
  tabValue?: string;
  description: string;
}

export function TournamentChecklist({
  tournament,
  categories,
  teams,
  fields,
  matches,
  onNavigate,
}: {
  tournament: TournamentDetail;
  categories: Category[];
  teams: { id: number }[];
  fields: TournamentField[];
  matches: MatchList[];
  onNavigate?: (tab: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const steps: ChecklistStep[] = [
    {
      id: "create",
      label: "Créer le tournoi",
      done: true,
      description: "Tournoi créé",
    },
    {
      id: "categories",
      label: "Ajouter des catégories",
      done: categories.length > 0,
      tabValue: "categories",
      description: categories.length > 0
        ? `${categories.length} catégorie${categories.length > 1 ? "s" : ""}`
        : "Aucune catégorie",
    },
    {
      id: "teams",
      label: "Ajouter des équipes",
      done: teams.length >= 2,
      tabValue: "teams",
      description: teams.length >= 2
        ? `${teams.length} équipe${teams.length > 1 ? "s" : ""}`
        : teams.length === 1
          ? "1 seule équipe (min. 2)"
          : "Aucune équipe",
    },
    {
      id: "fields",
      label: "Configurer les terrains",
      done: fields.filter((f) => f.is_active).length > 0,
      tabValue: "fields",
      description: fields.filter((f) => f.is_active).length > 0
        ? `${fields.filter((f) => f.is_active).length} terrain${fields.filter((f) => f.is_active).length > 1 ? "s" : ""} actif${fields.filter((f) => f.is_active).length > 1 ? "s" : ""}`
        : "Aucun terrain",
    },
    {
      id: "schedule",
      label: "Générer le planning",
      done: matches.length > 0,
      tabValue: "planning",
      description: matches.length > 0
        ? `${matches.length} match${matches.length > 1 ? "s" : ""} planifié${matches.length > 1 ? "s" : ""}`
        : "Aucun match",
    },
    {
      id: "live",
      label: "Lancer le tournoi en live",
      done: tournament.status === "live" || tournament.status === "finished",
      description: tournament.status === "live"
        ? "En cours"
        : tournament.status === "finished"
          ? "Terminé"
          : "En attente",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;
  const nextStep = steps.find((s) => !s.done);

  // Auto-collapse when all done
  if (allDone && !collapsed) {
    // Don't auto-collapse - let user decide
  }

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            {allDone ? (
              <CheckCircle2 className="size-5 text-green-500 shrink-0" />
            ) : (
              <div className="size-5 shrink-0 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{doneCount}/{steps.length}</span>
              </div>
            )}
            <span className="font-medium text-sm">
              {allDone ? "Configuration terminée !" : "Configuration du tournoi"}
            </span>
          </div>
          <div className="hidden sm:block w-32">
            <Progress value={progress} size="sm" variant={allDone ? "success" : "default"} />
          </div>
        </div>
        {collapsed ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-1">
          <div className="sm:hidden mb-2">
            <Progress value={progress} size="sm" variant={allDone ? "success" : "default"} />
          </div>
          {steps.map((step, i) => {
            const isNext = step.id === nextStep?.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.tabValue && onNavigate) {
                    onNavigate(step.tabValue);
                  }
                }}
                disabled={!step.tabValue}
                className={cn(
                  "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left transition-colors",
                  step.tabValue && "hover:bg-muted/70 cursor-pointer",
                  !step.tabValue && "cursor-default",
                  isNext && "bg-primary/5 ring-1 ring-primary/20",
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                ) : (
                  <Circle
                    className={cn(
                      "size-4 shrink-0",
                      isNext ? "text-primary" : "text-muted-foreground/40",
                    )}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-sm",
                      step.done && "text-muted-foreground line-through",
                      isNext && "font-medium text-primary",
                      !step.done && !isNext && "text-muted-foreground",
                    )}
                  >
                    {i + 1}. {step.label}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                  {step.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

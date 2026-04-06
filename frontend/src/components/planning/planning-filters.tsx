"use client";

import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Category, TournamentField } from "@/types/api";

export interface PlanningFilters {
  category: string;
  team: string;
  field: string;
  phase: string;
  status: string;
  search: string;
}

const EMPTY: PlanningFilters = {
  category: "",
  team: "",
  field: "",
  phase: "",
  status: "",
  search: "",
};

const PHASE_OPTIONS = [
  { value: "group", label: "Poules" },
  { value: "r16", label: "8èmes" },
  { value: "quarter", label: "Quarts" },
  { value: "semi", label: "Demis" },
  { value: "third", label: "3e place" },
  { value: "final", label: "Finale" },
];

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Programmé" },
  { value: "live", label: "En cours" },
  { value: "finished", label: "Terminé" },
  { value: "cancelled", label: "Annulé" },
  { value: "postponed", label: "Reporté" },
];

interface PlanningFiltersBarProps {
  filters: PlanningFilters;
  onChange: (filters: PlanningFilters) => void;
  categories: Category[];
  fields: TournamentField[];
  teamNames: string[];
}

export { EMPTY as EMPTY_FILTERS };

export function PlanningFiltersBar({
  filters,
  onChange,
  categories,
  fields,
  teamNames,
}: PlanningFiltersBarProps) {
  const set = (key: keyof PlanningFilters, value: string) =>
    onChange({ ...filters, [key]: value });

  const hasActive = Object.values(filters).some((v) => v !== "");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.category}
          onChange={(e) => set("category", e.target.value)}
          options={categories.map((c) => ({
            value: String(c.id),
            label: c.name,
          }))}
          placeholder="Catégorie"
          className="w-36"
        />
        <Select
          value={filters.team}
          onChange={(e) => set("team", e.target.value)}
          options={teamNames.map((n) => ({ value: n, label: n }))}
          placeholder="Équipe"
          className="w-40"
        />
        <Select
          value={filters.field}
          onChange={(e) => set("field", e.target.value)}
          options={fields.map((f) => ({
            value: String(f.id),
            label: f.name,
          }))}
          placeholder="Terrain"
          className="w-36"
        />
        <Select
          value={filters.phase}
          onChange={(e) => set("phase", e.target.value)}
          options={PHASE_OPTIONS}
          placeholder="Phase"
          className="w-28"
        />
        <Select
          value={filters.status}
          onChange={(e) => set("status", e.target.value)}
          options={STATUS_OPTIONS}
          placeholder="Statut"
          className="w-32"
        />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Rechercher..."
            className="pl-8 h-9 w-40"
          />
        </div>
        {hasActive && (
          <button
            onClick={() => onChange(EMPTY)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Human-readable explanations for scheduling warnings and penalties.
 * All messages are in French.
 */

export interface SoftWarning {
  type: string;
  message: string;
  affected_team_id?: number | null;
  affected_match_id?: string | null;
}

export interface Penalty {
  type: string;
  amount: number;
  detail: string;
}

export interface WarningExplanation {
  title: string;
  description: string;
  severity: "info" | "warning" | "error";
}

export function explainWarning(warning: SoftWarning): WarningExplanation {
  switch (warning.type) {
    case "short_rest":
      return {
        title: "Temps de repos réduit",
        description: warning.message,
        severity: "error",
      };
    case "reduced_rest":
      return {
        title: "Repos réduit par le moteur",
        description: warning.message,
        severity: "warning",
      };
    case "constraint_relaxed":
      return {
        title: "Contrainte assouplie",
        description:
          "Le moteur a dû assouplir une règle pour placer ce match.",
        severity: "warning",
      };
    case "long_wait":
      return {
        title: "Longue attente entre matchs",
        description: warning.message,
        severity: "warning",
      };
    case "unbalanced_field":
      return {
        title: "Terrain surchargé",
        description: warning.message,
        severity: "warning",
      };
    case "too_many_consecutive":
      return {
        title: "Trop de matchs consécutifs",
        description: warning.message,
        severity: "error",
      };
    case "auto_availability":
      return {
        title: "Disponibilité automatique",
        description: warning.message,
        severity: "info",
      };
    case "phase_separation_impossible":
      return {
        title: "Séparation de phases impossible",
        description: warning.message,
        severity: "warning",
      };
    default:
      return {
        title: warning.type.replace(/_/g, " "),
        description: warning.message,
        severity: "info",
      };
  }
}

export function penaltySeverity(
  amount: number
): "error" | "warning" | "info" {
  const absAmount = Math.abs(amount);
  if (absAmount >= 20) return "error";
  if (absAmount >= 10) return "warning";
  return "info";
}

export const SEVERITY_COLORS = {
  error: "text-red-400 bg-red-500/10 border-red-500/30",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  info: "text-blue-400 bg-blue-500/10 border-blue-500/30",
} as const;

/**
 * Footix pricing plans — client-side source of truth.
 * Mirror of backend/apps/subscriptions/plans.py
 */

// ── Feature keys ────────────────────────────────────────────────────────────

export type PremiumFeature =
  | "knockout_phase"
  | "pdf_kit"
  | "insights"
  | "push_notifications"
  | "multi_day"
  | "speaker_mode"
  | "multi_year_history"
  | "club_branding"
  | "full_export";

export type PlanType = "FREE" | "ONE_SHOT" | "CLUB";

// ── Feature sets ────────────────────────────────────────────────────────────

const FREE_FEATURES = new Set<PremiumFeature>();

const ONE_SHOT_FEATURES = new Set<PremiumFeature>([
  "knockout_phase",
  "pdf_kit",
  "insights",
  "push_notifications",
  "multi_day",
  "speaker_mode",
]);

const CLUB_FEATURES = new Set<PremiumFeature>([
  ...ONE_SHOT_FEATURES,
  "multi_year_history",
  "club_branding",
  "full_export",
]);

const PLAN_FEATURES: Record<PlanType, Set<PremiumFeature>> = {
  FREE: FREE_FEATURES,
  ONE_SHOT: ONE_SHOT_FEATURES,
  CLUB: CLUB_FEATURES,
};

// ── FREE plan limits ────────────────────────────────────────────────────────

export const FREE_LIMITS = {
  maxActiveTournaments: 1,
  maxTeamsPerTournament: 16,
  maxCategoriesPerTournament: 2,
  maxFieldsPerTournament: 3,
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

export function canUseFeature(plan: PlanType, feature: PremiumFeature): boolean {
  return PLAN_FEATURES[plan].has(feature);
}

export function getFeatureLabel(feature: PremiumFeature): string {
  const labels: Record<PremiumFeature, string> = {
    knockout_phase: "Phases finales automatiques",
    pdf_kit: "Kit PDF imprimable",
    insights: "Insights / bilan fin de tournoi",
    push_notifications: "Notifications push",
    multi_day: "Mode multi-jours",
    speaker_mode: "Mode haut-parleur + affichage terrain",
    multi_year_history: "Historique pluriannuel",
    club_branding: "Personnalisation logo + couleurs club",
    full_export: "Export complet Excel/PDF",
  };
  return labels[feature];
}

// ─── Common ─────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Auth / Users ───────────────────────────────────────────────────────────

export type UserRole = "superadmin" | "organizer" | "coach" | "public";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface TeamAccessResponse extends AuthTokens {
  team: TeamBrief;
}

// ─── Clubs ──────────────────────────────────────────────────────────────────

export interface Club {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  website: string;
  contact_email: string;
  owner: User;
  members: User[];
  created_at: string;
  updated_at: string;
}

export type ClubPayload = Pick<Club, "name" | "contact_email" | "website"> & {
  logo?: File | null;
};

// ─── Tournaments ────────────────────────────────────────────────────────────

export type TournamentStatus =
  | "draft"
  | "published"
  | "live"
  | "finished"
  | "archived";

export interface TournamentList {
  id: string;
  club: number;
  name: string;
  slug: string;
  public_code: string;
  location: string;
  start_date: string;
  end_date: string;
  status: TournamentStatus;
  is_public: boolean;
  cover_image: string | null;
  nb_categories: number;
  nb_teams: number;
  nb_matches: number;
  nb_fields: number;
  created_at: string;
}

export interface TournamentDetail extends TournamentList {
  description: string;
  rules: string;
  default_match_duration: number;
  default_transition_time: number;
  default_rest_time: number;
  phase_separation_mode: "none" | "same_day_rest" | "next_day";
  knockout_rest_multiplier: number;
  scheduling_mode: "CATEGORY_BLOCK" | "INTERLEAVE";
  default_min_rest_matches: number;
  max_consecutive_matches: number;
  updated_at: string;
}

export interface TournamentPayload {
  club?: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  description?: string;
  rules?: string;
  is_public?: boolean;
  cover_image?: File | null;
  default_match_duration?: number;
  default_transition_time?: number;
  default_rest_time?: number;
  phase_separation_mode?: "none" | "same_day_rest" | "next_day";
  knockout_rest_multiplier?: number;
  scheduling_mode?: "CATEGORY_BLOCK" | "INTERLEAVE";
  default_min_rest_matches?: number;
  max_consecutive_matches?: number;
}

// ─── Days ───────────────────────────────────────────────────────────────────

export interface Day {
  id: number;
  tournament: string;
  date: string;
  label: string;
  start_time: string;
  end_time: string;
  lunch_start: string;
  lunch_end: string;
  order: number;
  playable_minutes: number;
}

export type DayPayload = Pick<Day, "date" | "label" | "start_time" | "end_time" | "order"> & {
  lunch_start?: string;
  lunch_end?: string;
};

// ─── Categories ─────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  tournament: string;
  name: string;
  display_order: number;
  color: string;
  match_duration: number | null;
  transition_time: number | null;
  rest_time: number | null;
  min_rest_matches: number;
  max_consecutive_matches: number;
  number_of_pools: number | null;
  finals_format: "TOP2_CROSSOVER" | "TOP1_FINAL";
  finals_same_day: boolean;
  day: number | null;
  players_per_team: number | null;
  points_win: number;
  points_draw: number;
  points_loss: number;
  allowed_days: string[] | null;
  earliest_start: string | null;
  latest_end: string | null;
  effective_match_duration: number;
  effective_transition_time: number;
  effective_rest_time: number;
}

export type CategoryPayload = Pick<
  Category,
  "name" | "display_order" | "color"
> &
  Partial<
    Pick<
      Category,
      | "match_duration"
      | "transition_time"
      | "rest_time"
      | "min_rest_matches"
      | "max_consecutive_matches"
      | "number_of_pools"
      | "finals_format"
      | "finals_same_day"
      | "day"
      | "players_per_team"
      | "points_win"
      | "points_draw"
      | "points_loss"
      | "allowed_days"
      | "earliest_start"
      | "latest_end"
    >
  >;

// ─── Fields ─────────────────────────────────────────────────────────────────

export interface FieldAvailabilitySlot {
  start: string;
  end: string;
}

export interface TournamentField {
  id: number;
  tournament: string;
  name: string;
  display_order: number;
  is_active: boolean;
  availability: Record<string, FieldAvailabilitySlot[]> | null;
}

export type FieldPayload = Pick<
  TournamentField,
  "name" | "display_order" | "is_active"
> & {
  availability?: TournamentField["availability"];
};

// ─── Constraints ────────────────────────────────────────────────────────────

export type ConstraintType =
  | "earliest_time"
  | "latest_time"
  | "required_field"
  | "blocked_slot"
  | "category_day";

export interface SchedulingConstraint {
  id: number;
  tournament: string;
  name: string;
  constraint_type: ConstraintType;
  payload: Record<string, unknown>;
  is_hard: boolean;
  created_at: string;
}

export type ConstraintPayload = Pick<
  SchedulingConstraint,
  "name" | "constraint_type" | "payload" | "is_hard"
>;

// ─── Teams ──────────────────────────────────────────────────────────────────

export interface Team {
  id: number;
  tournament: string;
  category: number;
  name: string;
  short_name: string;
  logo: string | null;
  coach_name: string;
  coach_phone: string;
  coach_email: string;
  created_at: string;
  updated_at: string;
}

export interface TeamAdmin extends Team {
  access_code: string;
  qr_code_url: string | null;
}

export interface TeamBrief {
  id: number;
  name: string;
  short_name: string;
  logo: string | null;
  category: { id: number; name: string };
  tournament: { id: string; name: string; slug: string };
}

export type TeamPayload = Pick<
  Team,
  "category" | "name" | "short_name" | "coach_name" | "coach_phone" | "coach_email"
> & {
  logo?: File | null;
};

// ─── Groups ─────────────────────────────────────────────────────────────────

export interface Group {
  id: number;
  category: number;
  name: string;
  display_order: number;
  team_ids: number[];
}

export interface GroupDetail {
  id: number;
  category: number;
  name: string;
  display_order: number;
  teams: TeamBrief[];
}

export type GroupPayload = Pick<Group, "name" | "display_order"> & {
  team_ids?: number[];
};

// ─── Matches ────────────────────────────────────────────────────────────────

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "cancelled"
  | "postponed";

export type MatchPhase =
  | "group"
  | "r16"
  | "quarter"
  | "semi"
  | "third"
  | "final";

export interface MatchList {
  id: string;
  tournament: string;
  category: number;
  category_name: string;
  group: number | null;
  phase: MatchPhase;
  team_home: number | null;
  team_away: number | null;
  display_home: string;
  display_away: string;
  placeholder_home: string;
  placeholder_away: string;
  field: number | null;
  field_name: string | null;
  start_time: string;
  duration_minutes: number;
  status: MatchStatus;
  score_home: number | null;
  score_away: number | null;
  penalty_score_home: number | null;
  penalty_score_away: number | null;
  is_locked: boolean;
}

export interface Goal {
  id: number;
  match: string;
  team: number;
  player_name: string;
  minute: number | null;
  created_at: string;
}

export interface MatchDetail extends MatchList {
  team_home_detail: TeamBrief | null;
  team_away_detail: TeamBrief | null;
  score_validated: boolean;
  score_entered_by: number | null;
  notes: string;
  goals: Goal[];
  created_at: string;
  updated_at: string;
}

export interface MatchUpdatePayload {
  field?: number;
  start_time?: string;
  duration_minutes?: number;
  notes?: string;
  status?: MatchStatus;
}

export interface GoalInput {
  team: "home" | "away";
  player_name?: string;
  minute?: number | null;
}

export interface ScoreInput {
  score_home: number;
  score_away: number;
  penalty_score_home?: number | null;
  penalty_score_away?: number | null;
  goals?: GoalInput[];
}

// ─── Standings ──────────────────────────────────────────────────────────────

export interface TeamStanding {
  team_id: number;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  rank: number;
  form: ("W" | "D" | "L")[];
}

export interface GroupStandings {
  group: { id: number; name: string };
  standings: TeamStanding[];
}

export interface CategoryStandings {
  category: { id: number; name: string };
  groups: GroupStandings[];
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

export interface ScheduleTaskResponse {
  task_id: string;
  status: "pending";
}

export interface ScheduleTaskStatus {
  task_id: string;
  status: "PENDING" | "STARTED" | "PROGRESS" | "SUCCESS" | "FAILURE";
  result?: Record<string, unknown>;
  error?: string;
  percent?: number;
  message?: string;
}

export interface ScheduleDay {
  date: string;
  fields: {
    field: { id: number; name: string };
    matches: MatchList[];
  }[];
}

export interface ScheduleConflict {
  match_id: string;
  type: string;
  detail: string;
}

// ─── Feasibility ────────────────────────────────────────────────────────────

export interface FeasibilityDay {
  date: string;
  slots: number;
  estimated_matches: number;
  utilization: number;
}

export interface FeasibilityCategory {
  id: number;
  name: string;
  teams: number;
  matches: number;
  slots_available: number;
  utilization: number;
  match_duration: number;
  rest_time: number;
  days: string[];
}

export interface FeasibilityResult {
  feasibility_score?: number;
  total_matches: number;
  total_available_slots: number;
  total_slots?: number;
  feasible: boolean;
  utilization: number;
  rest_overhead_pct?: number;
  fields_count: number;
  categories_count?: number;
  days_count: number;
  teams_count?: number;
  cat_details: { name: string; match_count: number }[];
  day_details: {
    day: string;
    playable_min: number;
    slots_per_day: number;
    parallel_slots: number;
    day_match_count: number;
    feasible: boolean;
  }[];
  days?: FeasibilityDay[];
  categories?: FeasibilityCategory[];
  bottlenecks?: string[];
}

// ─── Generate Results ───────────────────────────────────────────────────────

export interface GenerateResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  stats?: {
    total_matches: number;
    placed: number;
    forced: number;
  };
}

export interface FinalsResult {
  success: boolean;
  error?: string;
  match_count?: number;
}

export interface AutoPoolsResult {
  warnings: string[];
  pools: { id: number; name: string }[];
}

// ─── Diagnostics ────────────────────────────────────────────────────────────

export interface DiagnosticPenalty {
  type: string;
  amount: number;
  detail: string;
}

export interface MatchDiagnostic {
  match_id: string;
  display: string;
  score: number;
  field_name: string | null;
  start_time: string | null;
  penalties: DiagnosticPenalty[];
  rest_before_home_minutes: number | null;
  rest_before_away_minutes: number | null;
}

export interface DiagnosticsResult {
  global_score: number;
  matches: MatchDiagnostic[];
}

export interface SwapSuggestion {
  swap_with_match_id: string;
  swap_with_display: string;
  swap_with_time: string;
  swap_with_field: string;
  improvement: number;
  description: string;
  applied: boolean;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface PublicTournament {
  id: string;
  name: string;
  slug: string;
  location: string;
  start_date: string;
  end_date: string;
  description: string;
  status: TournamentStatus;
  cover_image: string | null;
  categories: { id: number; name: string; color: string }[];
}

export interface PublicCategory {
  id: number;
  name: string;
  color: string;
  players_per_team: number | null;
}

export interface PublicLive {
  live_matches: MatchList[];
  upcoming_matches: MatchList[];
  recent_results: MatchList[];
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationType =
  | "match_started"
  | "match_finished"
  | "score_updated"
  | "planning_generated"
  | "field_change"
  | "tournament_published";

export interface Notification {
  id: string;
  type: NotificationType;
  target: "admin" | "coach" | "all";
  title: string;
  body: string;
  link: string;
  tournament_id: string | null;
  match_id: string | null;
  team_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── Subscriptions / Pricing ────────────────────────────────────────────────

export type SubscriptionPlan =
  | "free"
  | "monthly"
  | "yearly"
  | "club_monthly"
  | "club_yearly";

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "trialing";

export interface SubscriptionData {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  is_premium: boolean;
  is_club: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface TournamentLicenseData {
  id: string;
  tournament_id: string;
  tournament_name: string;
  is_active: boolean;
  is_valid: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

export interface SubscriptionStatusResponse {
  subscription: SubscriptionData;
  licenses: TournamentLicenseData[];
}

export interface TournamentPlanResponse {
  plan: "FREE" | "ONE_SHOT" | "CLUB";
  tournament_id: string;
}

// ─── FFF Club Search ────────────────────────────────────────────────────────

export interface FFFClub {
  fff_id: number;
  name: string;
  short_name: string;
  city: string;
  postal_code: string;
  logo: string | null;
  colors: string | null;
  latitude: number | null;
  longitude: number | null;
}

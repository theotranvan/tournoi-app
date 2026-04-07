/**
 * Shared fixtures and helpers for Footix E2E tests.
 * Provides API-route mocking utilities and reusable mock data.
 */
import { test as base, type Page, type Route } from "@playwright/test";

/* ── Mock data ───────────────────────────────────────────── */

export const MOCK_USER = {
  id: 1,
  username: "testadmin",
  email: "test@footix.fr",
  first_name: "Test",
  last_name: "Admin",
  role: "organizer" as const,
  phone: "",
};

export const MOCK_TOKENS = {
  access: "fake-access-token",
  refresh: "fake-refresh-token",
};

export const MOCK_TOURNAMENT = {
  id: "t-001",
  club: 1,
  name: "Tournoi de Printemps U13",
  slug: "tournoi-printemps-u13",
  location: "Stade municipal, Lyon",
  start_date: "2025-06-15",
  end_date: "2025-06-16",
  description: "Tournoi de football pour les U13",
  rules: "",
  status: "published" as const,
  is_public: true,
  cover_image: null,
  nb_categories: 2,
  nb_teams: 8,
  nb_matches: 12,
  nb_fields: 2,
  created_at: "2025-01-01T00:00:00Z",
  default_match_duration: 15,
  default_transition_time: 5,
  default_rest_time: 30,
  phase_separation_mode: "same_day_rest" as const,
  knockout_rest_multiplier: 3,
  updated_at: "2025-01-01T00:00:00Z",
};

export const MOCK_PUBLIC_TOURNAMENT = {
  id: "t-001",
  name: "Tournoi de Printemps U13",
  slug: "tournoi-printemps-u13",
  location: "Stade municipal, Lyon",
  start_date: "2025-06-15",
  end_date: "2025-06-16",
  description: "Tournoi de football pour les U13",
  status: "live" as const,
  cover_image: null,
  categories: [
    { id: 1, name: "U13", color: "#3b82f6" },
    { id: 2, name: "U15", color: "#ef4444" },
  ],
};

export const MOCK_MATCH_LIVE = {
  id: "m-001",
  tournament: "t-001",
  category: 1,
  category_name: "U13",
  group: 1,
  phase: "group" as const,
  team_home: 1,
  team_away: 2,
  display_home: "FC Lyon",
  display_away: "AS Monaco",
  placeholder_home: "",
  placeholder_away: "",
  field: 1,
  field_name: "Terrain A",
  start_time: new Date(Date.now() - 10 * 60_000).toISOString(), // started 10 min ago
  duration_minutes: 15,
  status: "live" as const,
  score_home: 1,
  score_away: 0,
  penalty_score_home: null,
  penalty_score_away: null,
  is_locked: false,
};

export const MOCK_MATCH_SCHEDULED = {
  ...MOCK_MATCH_LIVE,
  id: "m-002",
  team_home: 3,
  team_away: 4,
  display_home: "OL Juniors",
  display_away: "PSG Academy",
  field_name: "Terrain B",
  start_time: new Date(Date.now() + 30 * 60_000).toISOString(),
  status: "scheduled" as const,
  score_home: null,
  score_away: null,
};

export const MOCK_MATCH_FINISHED = {
  ...MOCK_MATCH_LIVE,
  id: "m-003",
  team_home: 5,
  team_away: 6,
  display_home: "OM Kids",
  display_away: "ASSE Mini",
  start_time: new Date(Date.now() - 60 * 60_000).toISOString(),
  status: "finished" as const,
  score_home: 2,
  score_away: 1,
};

export const MOCK_LIVE_DATA = {
  live_matches: [MOCK_MATCH_LIVE],
  upcoming_matches: [MOCK_MATCH_SCHEDULED],
  recent_results: [MOCK_MATCH_FINISHED],
};

export const MOCK_STANDINGS = [
  {
    category: { id: 1, name: "U13" },
    groups: [
      {
        group: { id: 1, name: "Groupe A" },
        standings: [
          {
            team_id: 1,
            team_name: "FC Lyon",
            played: 2,
            won: 2,
            drawn: 0,
            lost: 0,
            goals_for: 5,
            goals_against: 1,
            goal_difference: 4,
            points: 6,
            rank: 1,
            form: ["W", "W"],
          },
          {
            team_id: 2,
            team_name: "AS Monaco",
            played: 2,
            won: 1,
            drawn: 0,
            lost: 1,
            goals_for: 3,
            goals_against: 3,
            goal_difference: 0,
            points: 3,
            rank: 2,
            form: ["W", "L"],
          },
          {
            team_id: 3,
            team_name: "OL Juniors",
            played: 2,
            won: 0,
            drawn: 1,
            lost: 1,
            goals_for: 1,
            goals_against: 2,
            goal_difference: -1,
            points: 1,
            rank: 3,
            form: ["D", "L"],
          },
          {
            team_id: 4,
            team_name: "PSG Academy",
            played: 2,
            won: 0,
            drawn: 1,
            lost: 1,
            goals_for: 2,
            goals_against: 5,
            goal_difference: -3,
            points: 1,
            rank: 4,
            form: ["L", "D"],
          },
        ],
      },
    ],
  },
];

export const MOCK_MATCH_DETAIL = {
  ...MOCK_MATCH_LIVE,
  team_home_detail: {
    id: 1,
    name: "FC Lyon",
    short_name: "FCL",
    logo: null,
    category: { id: 1, name: "U13" },
    tournament: { id: "t-001", name: "Tournoi de Printemps U13", slug: "tournoi-printemps-u13" },
  },
  team_away_detail: {
    id: 2,
    name: "AS Monaco",
    short_name: "ASM",
    logo: null,
    category: { id: 1, name: "U13" },
    tournament: { id: "t-001", name: "Tournoi de Printemps U13", slug: "tournoi-printemps-u13" },
  },
  score_validated: false,
  score_entered_by: null,
  notes: "",
  goals: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

/* ── Route mocking helper ────────────────────────────────── */

/**
 * Mock API routes by intercepting fetch calls to the backend.
 * Pattern matches against the URL path (e.g. `/api/auth/login/`).
 */
export async function mockApi(
  page: Page,
  mocks: Array<{
    path: string | RegExp;
    method?: string;
    status?: number;
    body: unknown;
  }>
) {
  for (const mock of mocks) {
    await page.route(
      (url) => {
        const urlPath = url.pathname;
        if (typeof mock.path === "string") {
          return urlPath.includes(mock.path);
        }
        return mock.path.test(urlPath);
      },
      async (route: Route) => {
        const method = route.request().method();
        if (mock.method && method !== mock.method.toUpperCase()) {
          return route.fallback();
        }
        await route.fulfill({
          status: mock.status ?? 200,
          contentType: "application/json",
          body: JSON.stringify(mock.body),
        });
      }
    );
  }
}

/**
 * Set auth tokens in localStorage so the app thinks we're logged in.
 */
export async function loginViaStorage(page: Page) {
  await page.addInitScript(
    ({ tokens, user }) => {
      localStorage.setItem("access_token", tokens.access);
      localStorage.setItem("refresh_token", tokens.refresh);
      localStorage.setItem("onboarding_done", "true");
    },
    { tokens: MOCK_TOKENS, user: MOCK_USER }
  );
}

/**
 * Mark onboarding as seen so tests skip the welcome flow.
 */
export async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_done", "true");
  });
}

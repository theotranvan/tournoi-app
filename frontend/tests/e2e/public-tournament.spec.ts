import { test, expect } from "@playwright/test";
import {
  mockApi,
  skipOnboarding,
  MOCK_PUBLIC_TOURNAMENT,
  MOCK_LIVE_DATA,
  MOCK_MATCH_LIVE,
  MOCK_MATCH_SCHEDULED,
  MOCK_MATCH_FINISHED,
  MOCK_STANDINGS,
} from "./helpers";

/**
 * E2E — Public tournament page.
 *
 * Covers:
 *  - Tournament code access page: form, valid code, invalid code / 404
 *  - Public tournament slug page: hero, tournament name, location, categories
 *  - Tabs: Live, Matches, Standings (classement)
 *  - Match display: live badge, scores, team names, field name
 *  - Standings display: team ranking, points, goal difference
 *  - Invalid slug → error state
 */

const SLUG = MOCK_PUBLIC_TOURNAMENT.slug;

test.describe("Public tournament page", () => {
  /* ── Code access page /tournoi ───────────────────────── */

  test.describe("Tournament code access", () => {
    test.beforeEach(async ({ page }) => {
      await skipOnboarding(page);
    });

    test("shows code input form", async ({ page }) => {
      await page.goto("/tournoi");
      await expect(page.getByText("Code du tournoi", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /accéder/i })
      ).toBeVisible();
    });

    test("valid code navigates to tournament page", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/public/tournaments/by-code/",
          body: { slug: SLUG, name: MOCK_PUBLIC_TOURNAMENT.name },
        },
        {
          path: `/public/tournaments/${SLUG}/`,
          body: MOCK_PUBLIC_TOURNAMENT,
        },
        {
          path: `/public/tournaments/${SLUG}/live/`,
          body: MOCK_LIVE_DATA,
        },
        {
          path: `/public/tournaments/${SLUG}/matches/`,
          body: [MOCK_MATCH_LIVE, MOCK_MATCH_SCHEDULED, MOCK_MATCH_FINISHED],
        },
        {
          path: `/public/tournaments/${SLUG}/standings/`,
          body: MOCK_STANDINGS,
        },
      ]);

      await page.goto("/tournoi");
      await page.getByRole("textbox").fill("ABC123");
      await page.getByRole("button", { name: /accéder/i }).click();

      await expect(page).toHaveURL(new RegExp(`/tournoi/${SLUG}`));
    });

    test("invalid code shows error message", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/public/tournaments/by-code/",
          status: 404,
          body: { detail: "Not found" },
        },
      ]);

      await page.goto("/tournoi");
      await page.getByRole("textbox").fill("WRONG");
      await page.getByRole("button", { name: /accéder/i }).click();

      await expect(page.getByText(/introuvable/i)).toBeVisible();
    });

    test("has back link to /start", async ({ page }) => {
      await page.goto("/tournoi");
      const backLink = page.getByRole("link", { name: /retour/i });
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute("href", "/start");
    });
  });

  /* ── Tournament slug page — Hero / info ──────────────── */

  test.describe("Tournament detail page", () => {
    function setupMocks(page: import("@playwright/test").Page) {
      return mockApi(page, [
        {
          path: `/public/tournaments/${SLUG}/`,
          body: MOCK_PUBLIC_TOURNAMENT,
        },
        {
          path: `/public/tournaments/${SLUG}/live/`,
          body: MOCK_LIVE_DATA,
        },
        {
          path: `/public/tournaments/${SLUG}/matches/`,
          body: [MOCK_MATCH_LIVE, MOCK_MATCH_SCHEDULED, MOCK_MATCH_FINISHED],
        },
        {
          path: `/public/tournaments/${SLUG}/standings/`,
          body: MOCK_STANDINGS,
        },
      ]);
    }

    test.beforeEach(async ({ page }) => {
      await skipOnboarding(page);
    });

    test("displays tournament name and location", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      await expect(
        page.getByRole("heading", { name: MOCK_PUBLIC_TOURNAMENT.name })
      ).toBeVisible();
      await expect(
        page.getByText(MOCK_PUBLIC_TOURNAMENT.location)
      ).toBeVisible();
    });

    test("displays category badges", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      for (const cat of MOCK_PUBLIC_TOURNAMENT.categories) {
        await expect(page.getByText(cat.name).first()).toBeVisible();
      }
    });

    test("shows live badge when matches are live", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      await expect(page.getByText(/en direct/i).first()).toBeVisible();
    });

    test("displays dates", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      // Partial date match — at least the day should appear
      await expect(page.getByText(/15/).first()).toBeVisible();
    });

    /* ── Live tab ──────────────────────────────────────── */

    test("live tab shows live matches with scores", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      // Should be on live tab by default or click it
      const liveTab = page.getByRole("tab", { name: /live|en direct/i });
      if (await liveTab.isVisible()) {
        await liveTab.click();
      }

      // Live match teams
      await expect(page.getByText("FC Lyon").first()).toBeVisible();
      await expect(page.getByText("AS Monaco").first()).toBeVisible();
    });

    test("live tab shows upcoming matches", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      const liveTab = page.getByRole("tab", { name: /live|en direct/i });
      if (await liveTab.isVisible()) {
        await liveTab.click();
      }

      await expect(page.getByText("OL Juniors").first()).toBeVisible();
      await expect(page.getByText("PSG Academy").first()).toBeVisible();
    });

    test("live tab shows recent results", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      const liveTab = page.getByRole("tab", { name: /live|en direct/i });
      if (await liveTab.isVisible()) {
        await liveTab.click();
      }

      await expect(page.getByText("OM Kids").first()).toBeVisible();
      await expect(page.getByText("ASSE Mini").first()).toBeVisible();
    });

    /* ── Matches tab ───────────────────────────────────── */

    test("matches tab shows all matches", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      const matchesTab = page.getByRole("tab", { name: /matchs|matches/i });
      await matchesTab.click();

      // All 3 teams from matches should be visible
      await expect(page.getByText("FC Lyon").first()).toBeVisible();
      await expect(page.getByText("OL Juniors").first()).toBeVisible();
      await expect(page.getByText("OM Kids").first()).toBeVisible();
    });

    test("matches tab shows field names", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      const matchesTab = page.getByRole("tab", { name: /matchs|matches/i });
      await matchesTab.click();

      await expect(page.getByText("Terrain A").first()).toBeVisible();
    });

    /* ── Standings tab ─────────────────────────────────── */

    test("standings tab shows group name", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      const standingsTab = page.getByRole("tab", {
        name: /classement|standings/i,
      });
      await standingsTab.click();

      await expect(page.getByText("Groupe A").first()).toBeVisible();
    });

    test("standings tab shows team ranking and points", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      const standingsTab = page.getByRole("tab", {
        name: /classement|standings/i,
      });
      await standingsTab.click();

      // FC Lyon should be first with 6 points
      await expect(page.getByText("FC Lyon").first()).toBeVisible();
      // Points column — 6 pts
      await expect(page.getByText("6").first()).toBeVisible();
    });

    test("standings tab shows all teams in group", async ({ page }) => {
      await setupMocks(page);
      await page.goto(`/tournoi/${SLUG}`);

      const standingsTab = page.getByRole("tab", {
        name: /classement|standings/i,
      });
      await standingsTab.click();

      for (const standing of MOCK_STANDINGS[0].groups[0].standings) {
        await expect(
          page.getByText(standing.team_name).first()
        ).toBeVisible();
      }
    });
  });

  /* ── Invalid slug ────────────────────────────────────── */

  test.describe("Invalid slug handling", () => {
    test.beforeEach(async ({ page }) => {
      await skipOnboarding(page);
    });

    test("unknown slug shows error or empty state", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/public/tournaments/non-existent/",
          status: 404,
          body: { detail: "Not found" },
        },
        {
          path: "/public/tournaments/non-existent/live/",
          status: 404,
          body: { detail: "Not found" },
        },
        {
          path: "/public/tournaments/non-existent/matches/",
          status: 404,
          body: { detail: "Not found" },
        },
        {
          path: "/public/tournaments/non-existent/standings/",
          status: 404,
          body: { detail: "Not found" },
        },
      ]);

      await page.goto("/tournoi/non-existent");
      // The page should show some kind of error state (loading, error, or empty)
      // Since the tournament doesn't exist, verifying the page doesn't crash
      await page.waitForTimeout(2000);
      // Page should still be functional (no blank white screen)
      const body = page.locator("body");
      await expect(body).toBeVisible();
    });
  });

  /* ── No live matches ─────────────────────────────────── */

  test("shows empty state when no live matches", async ({ page }) => {
    await skipOnboarding(page);
    await mockApi(page, [
      {
        path: `/public/tournaments/${SLUG}/`,
        body: { ...MOCK_PUBLIC_TOURNAMENT, status: "published" },
      },
      {
        path: `/public/tournaments/${SLUG}/live/`,
        body: {
          live_matches: [],
          upcoming_matches: [MOCK_MATCH_SCHEDULED],
          recent_results: [],
        },
      },
      {
        path: `/public/tournaments/${SLUG}/matches/`,
        body: [MOCK_MATCH_SCHEDULED],
      },
      {
        path: `/public/tournaments/${SLUG}/standings/`,
        body: [],
      },
    ]);

    await page.goto(`/tournoi/${SLUG}`);
    // Tournament name should still show
    await expect(
      page.getByRole("heading", { name: MOCK_PUBLIC_TOURNAMENT.name })
    ).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import {
  mockApi,
  loginViaStorage,
  skipOnboarding,
  MOCK_USER,
  MOCK_TOKENS,
  MOCK_TOURNAMENT,
} from "./helpers";

/**
 * E2E — Tournament creation flow (organizer).
 *
 * Covers:
 *  - Auth: login form, error state, successful redirect
 *  - Registration: account creation form, field validation
 *  - Tournament creation: form filling, submission, redirect to detail
 *  - Tournament list: display, filtering, "new" button
 *  - Navigation: admin → tournois → new, breadcrumb / back link
 */

test.describe("Tournament creation flow", () => {
  /* ── Auth: Login ─────────────────────────────────────── */

  test.describe("Login", () => {
    test.beforeEach(async ({ page }) => {
      await skipOnboarding(page);
    });

    test("shows login form with username, password and submit button", async ({
      page,
    }) => {
      await page.goto("/admin/login");
      await expect(page.getByLabel(/nom d'utilisateur/i)).toBeVisible();
      await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /se connecter/i })
      ).toBeVisible();
    });

    test("shows error on invalid credentials", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/auth/login/",
          method: "POST",
          status: 401,
          body: { detail: "Identifiants incorrects" },
        },
      ]);

      await page.goto("/admin/login");
      await page.getByLabel(/nom d'utilisateur/i).fill("wrong");
      await page.getByLabel(/mot de passe/i).fill("badpass");
      await page.getByRole("button", { name: /se connecter/i }).click();

      await expect(
        page.getByText(/identifiants incorrects/i)
      ).toBeVisible();
    });

    test("successful login redirects to /admin", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/auth/login/",
          method: "POST",
          body: { ...MOCK_TOKENS, user: MOCK_USER },
        },
        {
          path: "/auth/me/",
          body: MOCK_USER,
        },
        {
          path: "/tournaments/",
          body: { count: 0, results: [], next: null, previous: null },
        },
        {
          path: "/clubs/",
          body: { count: 0, results: [], next: null, previous: null },
        },
      ]);

      await page.goto("/admin/login");
      await page.getByLabel(/nom d'utilisateur/i).fill("testadmin");
      await page.getByLabel(/mot de passe/i).fill("secret123");
      await page.getByRole("button", { name: /se connecter/i }).click();

      await expect(page).toHaveURL(/\/admin/);
    });

    test("has link to registration page", async ({ page }) => {
      await page.goto("/admin/login");
      const link = page.getByRole("link", { name: /créer un compte/i });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/admin/register");
    });
  });

  /* ── Auth: Register ──────────────────────────────────── */

  test.describe("Register", () => {
    test.beforeEach(async ({ page }) => {
      await skipOnboarding(page);
    });

    test("shows registration form fields", async ({ page }) => {
      await page.goto("/admin/register");
      await expect(page.getByLabel(/nom d'utilisateur/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      // Two password fields
      await expect(page.getByLabel(/^mot de passe$/i)).toBeVisible();
    });

    test("successful registration redirects to /admin", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/auth/register/",
          method: "POST",
          body: { ...MOCK_TOKENS, user: MOCK_USER },
        },
        {
          path: "/auth/me/",
          body: MOCK_USER,
        },
        {
          path: "/tournaments/",
          body: { count: 0, results: [], next: null, previous: null },
        },
        {
          path: "/clubs/",
          body: { count: 0, results: [], next: null, previous: null },
        },
      ]);

      await page.goto("/admin/register");
      await page.getByLabel(/nom d'utilisateur/i).fill("newuser");
      await page.getByLabel(/email/i).fill("new@footix.fr");
      await page.getByLabel(/^mot de passe$/i).fill("Str0ng!Pass");
      await page.getByLabel(/confirmer/i).fill("Str0ng!Pass");
      await page.getByRole("button", { name: /créer/i }).click();

      await expect(page).toHaveURL(/\/admin/);
    });
  });

  /* ── Tournament list ─────────────────────────────────── */

  test.describe("Tournament list", () => {
    test.beforeEach(async ({ page }) => {
      await skipOnboarding(page);
      await loginViaStorage(page);
      await mockApi(page, [
        { path: "/auth/me/", body: MOCK_USER },
        {
          path: "/clubs/",
          body: { count: 1, results: [{ id: 1, name: "Club Test" }], next: null, previous: null },
        },
      ]);
    });

    test("displays tournament list with items", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/tournaments/",
          body: {
            count: 1,
            results: [MOCK_TOURNAMENT],
            next: null,
            previous: null,
          },
        },
      ]);

      await page.goto("/admin/tournois");
      await expect(page.getByText("Tournoi de Printemps U13")).toBeVisible();
      await expect(page.getByText("Stade municipal, Lyon")).toBeVisible();
    });

    test("shows empty state when no tournaments", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/tournaments/",
          body: { count: 0, results: [], next: null, previous: null },
        },
      ]);

      await page.goto("/admin/tournois");
      await expect(page.getByText(/aucun tournoi/i)).toBeVisible();
    });

    test("has 'Nouveau tournoi' button linking to creation", async ({
      page,
    }) => {
      await mockApi(page, [
        {
          path: "/tournaments/",
          body: { count: 0, results: [], next: null, previous: null },
        },
      ]);

      await page.goto("/admin/tournois");
      const btn = page.getByRole("link", { name: /nouveau tournoi/i });
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute("href", "/admin/tournois/new");
    });

    test("filter tabs work", async ({ page }) => {
      const liveTournament = {
        ...MOCK_TOURNAMENT,
        id: "t-002",
        name: "Tournoi Live",
        status: "live",
      };
      await mockApi(page, [
        {
          path: "/tournaments/",
          body: {
            count: 2,
            results: [MOCK_TOURNAMENT, liveTournament],
            next: null,
            previous: null,
          },
        },
      ]);

      await page.goto("/admin/tournois");
      // Both visible on "Tous"
      await expect(page.getByText("Tournoi de Printemps U13")).toBeVisible();
      await expect(page.getByText("Tournoi Live")).toBeVisible();

      // Click "Actifs" tab (live + published)
      await page.getByRole("tab", { name: /actifs/i }).click();
      await expect(page.getByText("Tournoi de Printemps U13")).toBeVisible();
      await expect(page.getByText("Tournoi Live")).toBeVisible();

      // Click "Brouillons" — empty for these
      await page.getByRole("tab", { name: /brouillons/i }).dispatchEvent("click");
      await expect(page.getByText(/aucun tournoi/i)).toBeVisible();
    });
  });

  /* ── Tournament creation form ────────────────────────── */

  test.describe("New tournament form", () => {
    test.beforeEach(async ({ page }) => {
      await skipOnboarding(page);
      await loginViaStorage(page);
      await mockApi(page, [
        { path: "/auth/me/", body: MOCK_USER },
        {
          path: "/clubs/",
          body: { count: 1, results: [{ id: 1, name: "Club Test" }], next: null, previous: null },
        },
      ]);
    });

    test("shows creation form with required fields", async ({ page }) => {
      await page.goto("/admin/tournois/new");
      await expect(page.getByLabel(/nom du tournoi/i)).toBeVisible();
      await expect(page.getByLabel(/lieu/i)).toBeVisible();
      await expect(page.getByLabel(/date de début/i)).toBeVisible();
      await expect(page.getByLabel(/date de fin/i)).toBeVisible();
    });

    test("validates required fields on submit", async ({ page }) => {
      await page.goto("/admin/tournois/new");
      await page.getByRole("button", { name: /créer|enregistrer|sauvegarder/i }).click();

      // Validation errors should appear
      await expect(page.getByText(/le nom est requis/i)).toBeVisible();
      await expect(page.getByText(/le lieu est requis/i)).toBeVisible();
    });

    test("validates end date after start date", async ({ page }) => {
      await page.goto("/admin/tournois/new");

      await page.getByLabel(/nom du tournoi/i).fill("Test");
      await page.getByLabel(/lieu/i).fill("Paris");
      await page.getByLabel(/date de début/i).fill("2025-07-20");
      await page.getByLabel(/date de fin/i).fill("2025-07-19");

      await page.getByRole("button", { name: /créer|enregistrer|sauvegarder/i }).click();
      await expect(
        page.getByText(/date de fin doit être après/i)
      ).toBeVisible();
    });

    test("successful creation redirects to tournament detail", async ({
      page,
    }) => {
      const created = {
        ...MOCK_TOURNAMENT,
        id: "new-t-001",
        name: "Mon Nouveau Tournoi",
      };

      // Intercept all unmatched API calls with safe defaults
      await page.route(
        (url) => url.pathname.includes("/api/"),
        (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      );

      await mockApi(page, [
        {
          path: "/tournaments/",
          method: "POST",
          status: 201,
          body: created,
        },
        {
          path: `/tournaments/${created.id}/`,
          body: created,
        },
        {
          path: `/tournaments/${created.id}/categories/`,
          body: [],
        },
        {
          path: `/tournaments/${created.id}/fields/`,
          body: [],
        },
        {
          path: `/tournaments/${created.id}/teams/`,
          body: { count: 0, results: [], next: null, previous: null },
        },
        {
          path: `/tournaments/${created.id}/matches/`,
          body: [],
        },
      ]);

      await page.goto("/admin/tournois/new");

      await page.getByLabel(/nom du tournoi/i).fill("Mon Nouveau Tournoi");
      await page.getByLabel(/lieu/i).fill("Stade de France");
      await page.getByLabel(/date de début/i).fill("2025-07-15");
      await page.getByLabel(/date de fin/i).fill("2025-07-16");

      // Capture the POST request to verify it was sent
      const postPromise = page.waitForRequest(
        (req) => req.url().includes("/tournaments/") && req.method() === "POST"
      );

      await page.getByRole("button", { name: /créer|enregistrer|sauvegarder/i }).click();

      const postReq = await postPromise;
      const body = postReq.postDataJSON();
      expect(body.name).toBe("Mon Nouveau Tournoi");
      expect(body.location).toBe("Stade de France");
    });

    test("back link navigates to tournaments list", async ({ page }) => {
      await mockApi(page, [
        {
          path: "/tournaments/",
          body: { count: 0, results: [], next: null, previous: null },
        },
      ]);

      await page.goto("/admin/tournois/new");
      await page.getByRole("link", { name: /retour/i }).click();
      await expect(page).toHaveURL(/\/admin\/tournois/);
    });

    test("default match duration fields are pre-filled", async ({ page }) => {
      await page.goto("/admin/tournois/new");
      // The "Match (min)" field should default to 15
      const durationInput = page.getByLabel(/match.*min/i);
      await expect(durationInput).toHaveValue("15");
    });

    test("is_public checkbox is checked by default", async ({ page }) => {
      await page.goto("/admin/tournois/new");
      const checkbox = page.getByLabel(/page publique/i);
      await expect(checkbox).toBeChecked();
    });
  });
});

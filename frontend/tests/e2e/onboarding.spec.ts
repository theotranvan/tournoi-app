import { test, expect } from "@playwright/test";

test.describe("Onboarding flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addInitScript(() => localStorage.clear());
  });

  test("first visit redirects to /bienvenue and shows slide 1", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/bienvenue/);
    await expect(
      page.getByText("Vis chaque tournoi en direct")
    ).toBeVisible();
  });

  test("next button advances through all 3 slides then lands on /start", async ({
    page,
  }) => {
    await page.goto("/bienvenue");
    await expect(
      page.getByText("Vis chaque tournoi en direct")
    ).toBeVisible();

    await page.getByRole("button", { name: /suivant/i }).click();
    await expect(
      page.getByText("Toute ton équipe dans ta poche")
    ).toBeVisible();

    await page.getByRole("button", { name: /suivant/i }).click();
    await expect(
      page.getByText(/Organise ton tournoi/i)
    ).toBeVisible();

    await page.getByRole("button", { name: /commencer/i }).click();
    await expect(page).toHaveURL(/\/start/);
  });

  test("skip button jumps directly to /start", async ({ page }) => {
    await page.goto("/bienvenue");
    await page.getByRole("button", { name: /passer/i }).click();
    await expect(page).toHaveURL(/\/start/);
  });

  test("revisit goes directly to /start", async ({ page }) => {
    // Simulate that onboarding was already seen
    await page.goto("/bienvenue");
    await page.getByRole("button", { name: /passer/i }).click();
    await expect(page).toHaveURL(/\/start/);

    // Go back to root
    await page.goto("/");
    await expect(page).toHaveURL(/\/start/);
  });

  test("/start has 3 role cards and create account CTA", async ({ page }) => {
    await page.goto("/start");
    await expect(page.getByText("Je suis spectateur")).toBeVisible();
    await expect(page.getByText("Je suis coach")).toBeVisible();
    await expect(page.getByText("Je suis organisateur")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /créer un compte/i })
    ).toBeVisible();
  });

  test("spectator card navigates to /tournoi", async ({ page }) => {
    await page.goto("/start");
    await page.getByText("Je suis spectateur").click();
    await expect(page).toHaveURL(/\/tournoi/);
  });
});

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding.spec.ts >> Onboarding flow >> revisit goes directly to /start
- Location: tests\e2e\onboarding.spec.ts:47:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/start/
Received string:  "http://localhost:3000/bienvenue"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    3 × unexpected value "http://localhost:3000/"
    6 × unexpected value "http://localhost:3000/bienvenue"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - button "Passer" [ref=e4]
    - region "Présentation de Footix" [ref=e5]:
      - generic [ref=e7]:
        - img "Terrain de foot avec scores en direct" [ref=e9]:
          - generic [ref=e14]:
            - generic [ref=e16]: FCL
            - generic [ref=e17]: 3-1
            - generic [ref=e18]: SER
          - generic [ref=e21]: LIVE
          - generic [ref=e22]: ⭐
        - heading "Vis chaque tournoi en direct" [level=2] [ref=e23]
        - paragraph [ref=e24]: Scores en temps réel, classements animés, suis tes équipes favorites. Aucune inscription, zéro friction.
    - generic [ref=e25]:
      - tablist [ref=e26]:
        - tab "Slide 1" [selected] [ref=e27]
        - tab "Slide 2" [ref=e28]
        - tab "Slide 3" [ref=e29]
      - button "Suivant →" [ref=e30]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e36] [cursor=pointer]:
    - img [ref=e37]
  - alert [ref=e40]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Onboarding flow", () => {
  4  |   test.beforeEach(async ({ context }) => {
  5  |     await context.clearCookies();
  6  |     await context.addInitScript(() => localStorage.clear());
  7  |   });
  8  | 
  9  |   test("first visit redirects to /bienvenue and shows slide 1", async ({
  10 |     page,
  11 |   }) => {
  12 |     await page.goto("/");
  13 |     await expect(page).toHaveURL(/\/bienvenue/);
  14 |     await expect(
  15 |       page.getByText("Vis chaque tournoi en direct")
  16 |     ).toBeVisible();
  17 |   });
  18 | 
  19 |   test("next button advances through all 3 slides then lands on /start", async ({
  20 |     page,
  21 |   }) => {
  22 |     await page.goto("/bienvenue");
  23 |     await expect(
  24 |       page.getByText("Vis chaque tournoi en direct")
  25 |     ).toBeVisible();
  26 | 
  27 |     await page.getByRole("button", { name: /suivant/i }).click();
  28 |     await expect(
  29 |       page.getByText("Toute ton équipe dans ta poche")
  30 |     ).toBeVisible();
  31 | 
  32 |     await page.getByRole("button", { name: /suivant/i }).click();
  33 |     await expect(
  34 |       page.getByText(/Organise ton tournoi/i)
  35 |     ).toBeVisible();
  36 | 
  37 |     await page.getByRole("button", { name: /commencer/i }).click();
  38 |     await expect(page).toHaveURL(/\/start/);
  39 |   });
  40 | 
  41 |   test("skip button jumps directly to /start", async ({ page }) => {
  42 |     await page.goto("/bienvenue");
  43 |     await page.getByRole("button", { name: /passer/i }).click();
  44 |     await expect(page).toHaveURL(/\/start/);
  45 |   });
  46 | 
  47 |   test("revisit goes directly to /start", async ({ page }) => {
  48 |     // Simulate that onboarding was already seen
  49 |     await page.goto("/bienvenue");
  50 |     await page.getByRole("button", { name: /passer/i }).click();
  51 |     await expect(page).toHaveURL(/\/start/);
  52 | 
  53 |     // Go back to root
  54 |     await page.goto("/");
> 55 |     await expect(page).toHaveURL(/\/start/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  56 |   });
  57 | 
  58 |   test("/start has 3 role cards and create account CTA", async ({ page }) => {
  59 |     await page.goto("/start");
  60 |     await expect(page.getByText("Je suis spectateur")).toBeVisible();
  61 |     await expect(page.getByText("Je suis coach")).toBeVisible();
  62 |     await expect(page.getByText("Je suis organisateur")).toBeVisible();
  63 |     await expect(
  64 |       page.getByRole("button", { name: /créer un compte/i })
  65 |     ).toBeVisible();
  66 |   });
  67 | 
  68 |   test("spectator card navigates to /tournoi", async ({ page }) => {
  69 |     await page.goto("/start");
  70 |     await page.getByText("Je suis spectateur").click();
  71 |     await expect(page).toHaveURL(/\/tournoi/);
  72 |   });
  73 | });
  74 | 
```
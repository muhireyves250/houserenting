import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./support/flows";

test("root redirects to the default locale", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: /Find\s*your new home/ })).toBeVisible();
});

test("mobile uses the bottom tab bar, desktop the header", async ({ page }, testInfo) => {
  await skipOnboarding(page);
  await page.goto("/en");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  if (testInfo.project.name === "mobile") {
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(page.getByRole("link", { name: "Log in" })).toBeHidden();
  } else {
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  }
});

test("language switcher translates the page", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en");
  await page.getByRole("button", { name: /^Language:/ }).filter({ visible: true }).click();
  await page.getByRole("menuitemradio", { name: /Français/ }).click();
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.getByRole("heading", { name: /Trouvez\s*votre nouveau chez-vous/ })).toBeVisible();
});

test("language switcher keeps the query string (desktop header)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the header switcher is desktop-only");
  await skipOnboarding(page);
  await page.goto("/en/search?mode=long&location=Kigali");
  await page.getByRole("button", { name: /^Language:/ }).filter({ visible: true }).click();
  await page.getByRole("menuitemradio", { name: /Français/ }).click();
  await expect(page).toHaveURL(/\/fr\/search\?mode=long&location=Kigali/);
  await expect(page.getByText("À partir de 6 mois")).toBeVisible();
});

test("search with garbage params still renders", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en/search?mode=zzz&guests=-4&checkIn=2026-02-31");
  await expect(page.getByRole("heading", { level: 1, name: "Anywhere in Rwanda" })).toBeVisible();
});

test("first mobile visit shows onboarding once", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "onboarding is mobile-only");
  await page.goto("/en");
  await expect(page).toHaveURL(/\/en\/welcome/);
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.reload();
  await expect(page).toHaveURL(/\/en$/);
});

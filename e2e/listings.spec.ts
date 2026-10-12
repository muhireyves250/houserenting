import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./support/flows";

test("search Kigali short-term, open a listing and see its prices", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en");
  await page.getByLabel("Location").fill("Kimihurura");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/en\/search\?mode=short&location=Kimihurura/);
  await page.getByRole("link", { name: /Bright 2-bedroom flat in Kimihurura/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Bright 2-bedroom flat in Kimihurura" })).toBeVisible();
  await expect(page.getByText("RWF 55,250").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Book" }).filter({ visible: true })).toBeDisabled();
});

test("long-term search only shows monthly listings with the viewing action", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en/search?mode=long&location=Nyarutarama");
  await page.getByRole("link", { name: /Family villa with garden in Nyarutarama/ }).click();
  await expect(page.getByText("/ month").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply for viewing" }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Book" })).toHaveCount(0);
});

test("unknown listings return 404", async ({ page }) => {
  const res = await page.goto("/en/listings/does-not-exist");
  expect(res?.status()).toBe(404);
});

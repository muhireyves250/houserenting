import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./support/flows";

test("search Kigali short-term, open a listing and see its prices", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en");
  await page.getByRole("combobox", { name: "Where" }).first().fill("Kimihurura");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search", exact: true }).click();

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

test("search bar: pick a suggested city, dates and guests", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop popovers; phone sheets are covered by unit tests");
  await skipOnboarding(page);
  await page.goto("/en");
  await page.getByRole("combobox", { name: "Where" }).click();
  await page.getByRole("option", { name: /Kigali, Rwanda/ }).click();

  // Picking a city moves on to the calendar; choose the first two selectable days.
  const days = page.locator("[data-date]:not([disabled])");
  const checkIn = await days.nth(1).getAttribute("data-date");
  const checkOut = await days.nth(3).getAttribute("data-date");
  await days.nth(1).click();
  await days.nth(3).click();

  await page.getByRole("button", { name: /Who/ }).click();
  await page.getByRole("button", { name: "Add one: Adults" }).click();
  await page.getByRole("button", { name: "Add one: Adults" }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/en/search\\?mode=short&location=Kigali&checkIn=${checkIn}&checkOut=${checkOut}&guests=2`));
  await expect(page.getByRole("heading", { level: 1, name: "Homes in Kigali" })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./support/flows";

test("search Kigali short-term, open a listing and see its prices", async ({ page }, testInfo) => {
  await skipOnboarding(page);
  if (testInfo.project.name === "desktop") {
    await page.goto("/en");
    // The place is an apartment: switch the search to Apartments first.
    await page.getByRole("radio", { name: "Apartments" }).first().click();
    await page.getByRole("combobox", { name: "Where" }).first().fill("Kimihurura");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Search", exact: true }).click();
  } else {
    // Phones search from a full-screen sheet (covered by unit tests); start from the results.
    await page.goto("/en/search?mode=short&location=Kimihurura");
  }

  await expect(page).toHaveURL(/\/en\/search\?mode=short&location=Kimihurura/);
  // The card's own link (its "Save …" button also names the place).
  await page.getByRole("link", { name: /^Bright 2-bedroom flat in Kimihurura/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Bright 2-bedroom flat in Kimihurura" })).toBeVisible();
  // The price on screen (phones: the booking bar; computers: the booking card).
  await expect(page.getByText("RWF 55,250").filter({ visible: true }).first()).toBeVisible();
  // Signed out: Reserve asks to log in first (and comes back here).
  await expect(page.getByRole("link", { name: "Reserve" }).filter({ visible: true }).first()).toHaveAttribute("href", /\/en\/login\?next=/);
});

test("long-term search shows monthly listings, booked by choosing a move-in date and months", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en/search?mode=long&location=Nyarutarama");
  await page.getByRole("link", { name: /^Family villa with garden in Nyarutarama/ }).click();
  await expect(page.getByText("/ month").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByLabel("Move-in date").filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("Length").filter({ visible: true })).toBeVisible();
  // Signed out: Reserve asks to log in first.
  await expect(page.getByRole("link", { name: "Reserve" }).filter({ visible: true }).first()).toHaveAttribute("href", /\/en\/login\?next=/);
});

test("unknown listings say so and aren't indexed", async ({ page }) => {
  // Opened links start on the welcome page; skip it to reach the page itself.
  await skipOnboarding(page);
  // The page streams (its loading screen shows first), so the status is sent before "not found" is known:
  // what matters is the message and the noindex tag.
  await page.goto("/en/listings/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveCount(1);
});

test("search bar: pick a suggested city, dates and guests", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop popovers; phone sheets are covered by unit tests");
  await skipOnboarding(page);
  await page.goto("/en");
  await page.getByRole("combobox", { name: "Where" }).click();
  // Suggestions are districts (with their town): pick Gasabo, in Kigali.
  await page.getByRole("option", { name: /^Gasabo/ }).click();

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

  await expect(page).toHaveURL(new RegExp(`/en/search\\?mode=short&location=Gasabo&checkIn=${checkIn}&checkOut=${checkOut}&guests=2`));
  await expect(page.getByRole("heading", { level: 1, name: "Homes in Gasabo" })).toBeVisible();
});

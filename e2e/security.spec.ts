import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./support/flows";

test("pages carry security headers", async ({ request }) => {
  const res = await request.get("/en");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("unknown pages return a localized 404", async ({ page }) => {
  // Opened links start on the welcome page; skip it to reach the page itself.
  await skipOnboarding(page);
  const res = await page.goto("/fr/nexiste-pas");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page introuvable")).toBeVisible();
});

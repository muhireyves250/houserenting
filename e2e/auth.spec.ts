import { expect, test } from "@playwright/test";
import { PASSWORD, signUpAndVerify, skipOnboarding } from "./support/flows";
import { firstLink, waitForMail } from "./support/mail";

test("sign up → verify → signed in → sign out → log in", async ({ page }) => {
  const email = await signUpAndVerify(page);
  await page.goto("/en/profile");
  await expect(page.getByText(email).first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/en$/);

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("wrong password shows a friendly error", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
});

test("protected pages send you to login and back", async ({ page }) => {
  const email = await signUpAndVerify(page);
  await page.context().clearCookies();
  await skipOnboarding(page);

  await page.goto("/en/bookings");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fbookings/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/bookings$/);
  await expect(page.getByText("No bookings yet")).toBeVisible();
});

test("an unsafe next parameter is ignored", async ({ page }) => {
  const email = await signUpAndVerify(page);
  await page.context().clearCookies();
  await skipOnboarding(page);
  await page.goto("/en/login?next=//evil.example");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/localhost:3100\/en$/);
});

test("forgot password → reset → log in with the new password", async ({ page }) => {
  const email = await signUpAndVerify(page);
  await page.context().clearCookies();
  await skipOnboarding(page);

  await page.goto("/en/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link is on its way");

  await expect.poll(async () => (await waitForMail(email)).subject).toBe("Reset your Space Rental password");
  await page.goto(firstLink((await waitForMail(email)).text));
  await expect(page).toHaveURL(/\/en\/reset-password\?token=/);
  await page.getByLabel("New password").fill("new-river-kivu-77");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("status")).toHaveText("Password updated. You can now log in.");

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("new-river-kivu-77");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("signed-out: a members-only menu link opens the login modal, then lands on that page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "header menu is desktop-only; phones use the bottom tabs");
  await skipOnboarding(page);
  await page.goto("/en/search");
  await page.getByRole("link", { name: "Chats" }).click();
  const dialog = page.getByRole("dialog", { name: "Rent your perfect fit" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fchats/);
  await dialog.getByLabel("Email").fill("host@spacerental.rw");
  await dialog.getByLabel("Password", { exact: true }).fill("SpaceRental-demo-2026");
  await dialog.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/chats$/);
  await expect(page.getByText("No messages yet")).toBeVisible();
});

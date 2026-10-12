import { expect, type Page } from "@playwright/test";
import { firstLink, uniqueEmail, waitForMail } from "./mail";

export const PASSWORD = "umuganda-blue-lake-42";

const BASE_URL = "http://localhost:3100";

export async function skipOnboarding(page: Page) {
  await page.context().addCookies([{ name: "sr_onboarded", value: "1", url: BASE_URL }]);
}

/** Signs up through the UI, follows the verification link and ends signed in. Returns the email. */
export async function signUpAndVerify(page: Page, name = "Alona Test"): Promise<string> {
  const email = uniqueEmail("user");
  await skipOnboarding(page);
  await page.goto("/en/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/check-email/);
  const mail = await waitForMail(email);
  await page.goto(firstLink(mail.text));
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  return email;
}

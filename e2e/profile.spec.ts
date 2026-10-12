import { expect, test } from "@playwright/test";
import { signUpAndVerify } from "./support/flows";

test("edit name and phone, then switch language", async ({ page }) => {
  await signUpAndVerify(page);
  await page.goto("/en/profile");

  await page.getByLabel("Full name").fill("Alona Kotilevska");
  await page.getByLabel("Phone number").fill("0788 123 456");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Alona Kotilevska");
  await expect(page.getByLabel("Phone number")).toHaveValue("+250788123456");

  await page.getByLabel("Phone number").fill("12");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Phone number")).toHaveAccessibleDescription("Enter a valid phone number.");

  await page.getByLabel("Phone number").fill("");
  await page.getByRole("main").getByLabel("Language", { exact: true }).selectOption("fr");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/fr\/profile$/);
  await expect(page.getByRole("heading", { name: "Profil" })).toBeVisible();
});

import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `tsx scripts/with-test-db.ts sh -c "pnpm build && pnpm start -p ${PORT}"`,
    url: `${baseURL}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      BETTER_AUTH_URL: baseURL,
      MAIL_DRIVER: "file",
      MAIL_OUTBOX_DIR: ".e2e-mail",
      RATE_LIMIT_ENABLED: "false",
    },
  },
});

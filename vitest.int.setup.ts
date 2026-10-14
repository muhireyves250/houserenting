import { config } from "dotenv";
import { afterAll } from "vitest";
import { assertSafeTestDatabase, localDevDatabaseUrls } from "./src/test/db-guard";

config({ path: ".env.test", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error("TEST_DATABASE_URL is not set. Add it to .env.test (see .env.example).");
}
assertSafeTestDatabase(testUrl, localDevDatabaseUrls());

process.env.DATABASE_URL = testUrl;
process.env.ALLOW_DB_RESET = "1";
process.env.MAIL_DRIVER = "memory";
// The auth tests cover the verification flow.
process.env.EMAIL_VERIFICATION = "on";
process.env.BETTER_AUTH_URL ??= "http://localhost:3100";
process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-0123456789abcdef";

afterAll(async () => {
  const { db } = await import("@/lib/db");
  await db.$disconnect();
});

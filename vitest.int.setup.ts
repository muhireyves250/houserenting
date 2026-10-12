import { existsSync, readFileSync } from "node:fs";
import { config, parse } from "dotenv";
import { afterAll } from "vitest";

config({ path: ".env.test", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error("TEST_DATABASE_URL is not set. Add it to .env.test (see .env.example).");
}
if (existsSync(".env")) {
  const devUrl = parse(readFileSync(".env")).DATABASE_URL;
  if (devUrl && devUrl === testUrl) {
    throw new Error("TEST_DATABASE_URL equals the dev DATABASE_URL in .env. Refusing to run tests against dev data.");
  }
}

process.env.DATABASE_URL = testUrl;
process.env.ALLOW_DB_RESET = "1";
process.env.MAIL_DRIVER = "memory";
process.env.BETTER_AUTH_URL ??= "http://localhost:3100";
process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-0123456789abcdef";

afterAll(async () => {
  const { db } = await import("@/lib/db");
  await db.$disconnect();
});

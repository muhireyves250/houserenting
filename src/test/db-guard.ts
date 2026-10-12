import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

/** host:port/database, ignoring credentials, query options, case and Neon's "-pooler" host suffix. */
export function databaseIdentity(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;
    const host = parsed.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres";
    return `${host}:${parsed.port || "5432"}/${database}`;
  } catch {
    return null;
  }
}

/** Throws unless `testUrl` is a valid, test-named database distinct from every dev URL. */
export function assertSafeTestDatabase(testUrl: string, devUrls: (string | undefined)[]): void {
  const identity = databaseIdentity(testUrl);
  if (!identity) throw new Error("TEST_DATABASE_URL is not a valid database URL.");
  const name = identity.slice(identity.indexOf("/") + 1);
  if (!/test/i.test(name)) {
    throw new Error(`The test database name must contain "test" (got "${name}"). Refusing to run tests that wipe data.`);
  }
  for (const url of devUrls) {
    if (url && databaseIdentity(url) === identity) {
      throw new Error("TEST_DATABASE_URL points at the same database as a dev DATABASE_URL. Refusing to run tests against dev data.");
    }
  }
}

/** DATABASE_URL values from every local env file Next.js or Prisma might load. */
export function localDevDatabaseUrls(): string[] {
  return [".env", ".env.local", ".env.development", ".env.development.local"]
    .filter((file) => existsSync(file))
    .map((file) => parse(readFileSync(file)).DATABASE_URL)
    .filter((url): url is string => Boolean(url));
}

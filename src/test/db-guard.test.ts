// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertSafeTestDatabase, databaseIdentity } from "./db-guard";

const DEV = "postgresql://u:p@ep-spring-term.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";
const TEST = "postgresql://u:p@ep-spring-term.c-7.us-east-2.aws.neon.tech/neondb_test?sslmode=require";

describe("databaseIdentity", () => {
  it("ignores credentials, query options, the Neon pooler suffix and host case", () => {
    expect(databaseIdentity(DEV)).toBe("ep-spring-term.c-7.us-east-2.aws.neon.tech:5432/neondb");
    expect(databaseIdentity("postgresql://x:y@EP-SPRING-TERM-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require")).toBe(
      "ep-spring-term.c-7.us-east-2.aws.neon.tech:5432/neondb",
    );
  });

  it("returns null for garbage", () => {
    expect(databaseIdentity("not a url")).toBeNull();
  });
});

describe("assertSafeTestDatabase", () => {
  it("accepts a separate database whose name contains 'test'", () => {
    expect(() => assertSafeTestDatabase(TEST, [DEV])).not.toThrow();
  });

  it.each([
    ["the exact dev URL", DEV.replace("neondb?", "neondb_test_x?").replace("_test_x", "")],
    ["the pooled dev URL", DEV.replace("ep-spring-term.", "ep-spring-term-pooler.")],
    ["the dev URL with extra options", `${DEV}&channel_binding=require`],
  ])("refuses %s", (_label, url) => {
    expect(() => assertSafeTestDatabase(url, [DEV])).toThrow();
  });

  it("refuses a test database that matches any local dev URL (e.g. .env.local)", () => {
    expect(() => assertSafeTestDatabase(TEST, [undefined, DEV, TEST])).toThrow(/same database/);
  });

  it("refuses a database whose name does not say 'test'", () => {
    expect(() => assertSafeTestDatabase(DEV.replace("/neondb?", "/staging?"), [DEV])).toThrow(/test/);
  });

  it("refuses an invalid URL", () => {
    expect(() => assertSafeTestDatabase("nope", [])).toThrow(/valid/);
  });
});

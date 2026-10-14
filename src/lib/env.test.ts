import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("applies safe defaults", () => {
    const env = parseEnv(base);
    expect(env.MAIL_DRIVER).toBe("file");
    expect(env.RATE_LIMIT_ENABLED).toBe(true);
    expect(env.MAIL_OUTBOX_DIR).toBe(".mail-outbox");
  });

  it("parses RATE_LIMIT_ENABLED=false", () => {
    expect(parseEnv({ ...base, RATE_LIMIT_ENABLED: "false" }).RATE_LIMIT_ENABLED).toBe(false);
  });

  it("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow();
  });

  it("requires RESEND_API_KEY when MAIL_DRIVER=resend", () => {
    expect(() => parseEnv({ ...base, MAIL_DRIVER: "resend", RESEND_API_KEY: "" })).toThrow(/RESEND_API_KEY/);
    expect(parseEnv({ ...base, MAIL_DRIVER: "resend", RESEND_API_KEY: "re_123" }).MAIL_DRIVER).toBe("resend");
  });

  it("tidies common slips in BETTER_AUTH_URL (quotes, spaces, missing https://, trailing slash)", () => {
    for (const value of ['"https://site.vercel.app/"', "  site.vercel.app ", "https://site.vercel.app/", "'site.vercel.app'"]) {
      expect(parseEnv({ ...base, BETTER_AUTH_URL: value }).BETTER_AUTH_URL).toBe("https://site.vercel.app");
    }
    expect(parseEnv({ ...base, BETTER_AUTH_URL: "http://localhost:3000/" }).BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(() => parseEnv({ ...base, BETTER_AUTH_URL: "not a url at all" })).toThrow();
  });
});

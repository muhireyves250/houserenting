import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { DEMO_HOST, seedDemoData } from "./seed";
import { SEED_LISTINGS } from "./seed-data";

describe("seedDemoData", () => {
  beforeEach(resetDb);

  it("creates the demo host and all listings as published", async () => {
    await seedDemoData(db);
    expect(await db.listing.count({ where: { status: "PUBLISHED" } })).toBe(SEED_LISTINGS.length);
    const host = await db.user.findUniqueOrThrow({ where: { email: DEMO_HOST.email } });
    expect(host).toMatchObject({ isHost: true, emailVerified: true });
  });

  it("is safe to run twice", async () => {
    await seedDemoData(db);
    await seedDemoData(db);
    expect(await db.listing.count()).toBe(SEED_LISTINGS.length);
    expect(await db.listingPhoto.count()).toBe(SEED_LISTINGS.reduce((n, l) => n + l.photos.length, 0));
    expect(await db.user.count()).toBe(1);
  });

  it("lets the demo host log in with the documented password", async () => {
    await seedDemoData(db);
    const result = await auth.api.signInEmail({ body: { email: DEMO_HOST.email, password: DEMO_HOST.password } });
    expect(result.user.email).toBe(DEMO_HOST.email);
  });

  it("refuses to run in production unless explicitly allowed", async () => {
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      await expect(seedDemoData(db)).rejects.toThrow(/ALLOW_SEED/);
    } finally {
      env.NODE_ENV = original;
    }
  });
});

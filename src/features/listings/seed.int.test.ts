import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { DEMO_HOST, seedDemoData } from "./seed";
import { SEED_LISTINGS } from "./seed-data";

describe("seedDemoData", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.ALLOW_DEMO_SEED = "1";
  });

  it("creates the demo host and all listings as published", async () => {
    await seedDemoData(db);
    expect(await db.listing.count({ where: { status: "PUBLISHED" } })).toBe(SEED_LISTINGS.length);
    const host = await db.user.findUniqueOrThrow({ where: { email: DEMO_HOST.email } });
    expect(host).toMatchObject({ isHost: true, emailVerified: true });
  });

  // Two full seeds over the remote dev/test database can take ~30s.
  it("is safe to run twice", { timeout: 60_000 }, async () => {
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

  it("refuses to run unless ALLOW_DEMO_SEED=1 (never set it for production)", async () => {
    delete process.env.ALLOW_DEMO_SEED;
    await expect(seedDemoData(db)).rejects.toThrow(/ALLOW_DEMO_SEED/);
    expect(await db.listing.count()).toBe(0);
  });

  it("never attaches the documented demo password to an account it did not create", async () => {
    await db.user.create({ data: { id: "real-person", name: "Real Person", email: DEMO_HOST.email } });
    await expect(seedDemoData(db)).rejects.toThrow(/already belongs/);
    expect(await db.account.count({ where: { userId: "real-person" } })).toBe(0);
  });
});

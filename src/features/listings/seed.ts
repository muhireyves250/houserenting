import { hashPassword } from "@/features/auth/password";
import type { PrismaClient } from "@/generated/prisma/client";
import { SEED_LISTINGS } from "./seed-data";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Demo-only credentials, documented in the README. Never seeded in production. */
export const DEMO_HOST = {
  id: "seed-host",
  name: "Sabrina Ghilaci",
  email: "host@spacerental.rw",
  password: "SpaceRental-demo-2026",
} as const;

export async function seedDemoData(db: PrismaClient): Promise<{ listings: number }> {
  // Explicit opt-in: set ALLOW_DEMO_SEED=1 only for dev/test databases, never for production.
  if (process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed demo data: set ALLOW_DEMO_SEED=1 (dev/test databases only).");
  }

  const existing = await db.user.findUnique({ where: { email: DEMO_HOST.email } });
  if (existing && existing.id !== DEMO_HOST.id) {
    // Never put the publicly documented demo password on a real person's account.
    throw new Error(`${DEMO_HOST.email} already belongs to an account the seed did not create. Refusing to continue.`);
  }
  const host = existing
    ? await db.user.update({ where: { id: DEMO_HOST.id }, data: { isHost: true, emailVerified: true } })
    : await db.user.create({
        data: { id: DEMO_HOST.id, name: DEMO_HOST.name, email: DEMO_HOST.email, emailVerified: true, isHost: true },
      });

  const hasPassword = await db.account.findFirst({ where: { userId: host.id, providerId: "credential" } });
  if (!hasPassword) {
    await db.account.create({
      data: {
        id: `${host.id}-credential`,
        accountId: host.id,
        providerId: "credential",
        userId: host.id,
        // DEMO_HOST_PASSWORD keeps the public demo password off a production database.
        password: await hashPassword(process.env.DEMO_HOST_PASSWORD || DEMO_HOST.password),
      },
    });
  }

  // Recreate the seed listings so re-running picks up edits to seed-data.ts.
  await db.listing.deleteMany({ where: { id: { in: SEED_LISTINGS.map((l) => l.id) } } });
  const now = Date.now();
  await Promise.all(
    SEED_LISTINGS.map(({ id, photos, rates, daysSincePublished, ...fields }) =>
      db.listing.create({
        data: {
          id,
          ...fields,
          hostId: host.id,
          status: "PUBLISHED",
          publishedAt: new Date(now - daysSincePublished * DAY_MS),
          photos: {
            create: photos.map((url, position) => ({ url, publicId: `${id}-${position}`, width: 1600, height: 1067, position })),
          },
          rates: { create: rates },
        },
      }),
    ),
  );

  return { listings: SEED_LISTINGS.length };
}

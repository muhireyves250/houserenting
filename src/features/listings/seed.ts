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
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    throw new Error("Refusing to seed demo data in production. Set ALLOW_SEED=1 to override.");
  }

  await db.user.upsert({
    where: { email: DEMO_HOST.email },
    update: { isHost: true, emailVerified: true },
    create: { id: DEMO_HOST.id, name: DEMO_HOST.name, email: DEMO_HOST.email, emailVerified: true, isHost: true },
  });
  const host = await db.user.findUniqueOrThrow({ where: { email: DEMO_HOST.email } });

  const hasPassword = await db.account.findFirst({ where: { userId: host.id, providerId: "credential" } });
  if (!hasPassword) {
    await db.account.create({
      data: {
        id: `${host.id}-credential`,
        accountId: host.id,
        providerId: "credential",
        userId: host.id,
        password: await hashPassword(DEMO_HOST.password),
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

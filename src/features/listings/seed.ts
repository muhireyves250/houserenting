import { hashPassword } from "@/features/auth/password";
import type { PrismaClient } from "@/generated/prisma/client";
import { SEED_RESTAURANTS } from "@/features/food/seed-data";
import { SEED_LISTINGS } from "./seed-data";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Demo-only credentials, documented in the README. Never seeded in production. */
export const DEMO_HOST = {
  id: "seed-host",
  name: "Sabrina Ghilaci",
  email: "host@spacerental.rw",
  password: "SpaceRental-demo-2026",
} as const;

export async function seedDemoData(db: PrismaClient): Promise<{ listings: number; restaurants: number }> {
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
  if (hasPassword && process.env.DEMO_HOST_PASSWORD) {
    // A new private password replaces the one already stored (e.g. the public demo password).
    await db.account.update({ where: { id: hasPassword.id }, data: { password: await hashPassword(process.env.DEMO_HOST_PASSWORD) } });
  }
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

  const restaurants = await seedDemoRestaurants(db, host.id);
  return { listings: SEED_LISTINGS.length, restaurants };
}

/**
 * Creates or refreshes the demo restaurants and their menus (published, owned by the demo host). Safe to run again:
 * restaurants are updated in place, so their orders stay, and only demo places that exist are linked.
 */
export async function seedDemoRestaurants(db: PrismaClient, ownerId: string = DEMO_HOST.id): Promise<number> {
  if (process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed demo data: set ALLOW_DEMO_SEED=1.");
  }
  const places = new Set((await db.listing.findMany({ where: { id: { in: SEED_RESTAURANTS.flatMap((r) => (r.listingId ? [r.listingId] : [])) } }, select: { id: true } })).map((l) => l.id));
  for (const { id, menu, listingId, ...fields } of SEED_RESTAURANTS) {
    const data = { ...fields, ownerId, listingId: listingId && places.has(listingId) ? listingId : null, status: "PUBLISHED" as const, paused: false, statusReason: null };
    await db.restaurant.upsert({ where: { id }, create: { id, ...data }, update: data });
    await db.menuItem.deleteMany({ where: { restaurantId: id } });
    await db.menuItem.createMany({ data: menu.map((dish, position) => ({ restaurantId: id, position, section: dish.section, name: dish.name, description: dish.description ?? "", price: dish.price, photoUrl: dish.photo ? `https://images.unsplash.com/${dish.photo}?auto=format&fit=crop&w=400&q=80` : null })) });
  }
  return SEED_RESTAURANTS.length;
}

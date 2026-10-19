/**
 * Only the demo restaurants (owned by the demo host, linked to demo places that exist). Doesn't touch places or
 * bookings, so it can run where demo places already have bookings. Needs ALLOW_DEMO_SEED=1.
 */
import { config } from "dotenv";

config({ quiet: true });

async function main() {
  const { db } = await import("../src/lib/db");
  const { DEMO_HOST, seedDemoRestaurants } = await import("../src/features/listings/seed");
  try {
    const host = await db.user.findUnique({ where: { id: DEMO_HOST.id }, select: { id: true } });
    if (!host) throw new Error("The demo host doesn't exist here: run the full seed first.");
    console.log(`Seeded ${await seedDemoRestaurants(db, host.id)} demo restaurants.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

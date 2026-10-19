import { DEMO_HOST, seedDemoRestaurants } from "@/features/listings/seed";
import { db } from "@/lib/db";

/**
 * Only the demo restaurants (owned by the demo host, linked to demo places that exist). Doesn't touch places or
 * bookings, so it can run where demo places already have bookings. Needs ALLOW_DEMO_SEED=1.
 */
async function main() {
  const host = await db.user.findUnique({ where: { id: DEMO_HOST.id }, select: { id: true } });
  if (!host) throw new Error("The demo host doesn't exist here: run the full seed first.");
  console.log(`Seeded ${await seedDemoRestaurants(db, host.id)} demo restaurants.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

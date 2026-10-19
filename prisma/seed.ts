import { seedDemoData } from "@/features/listings/seed";
import { db } from "@/lib/db";

seedDemoData(db)
  .then(({ listings, restaurants }) => console.log(`Seeded ${listings} demo listings, ${restaurants} demo restaurants and the demo host.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

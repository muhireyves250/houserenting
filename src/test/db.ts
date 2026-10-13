import { db } from "@/lib/db";

const TABLES = ["favorite", "rateLimit", "verification", "session", "account", "user"];

export async function resetDb(): Promise<void> {
  if (process.env.ALLOW_DB_RESET !== "1") {
    throw new Error("resetDb() refused: ALLOW_DB_RESET is not set. Only the integration test setup may wipe the database.");
  }
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

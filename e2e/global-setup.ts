import { execFileSync } from "node:child_process";

/** Seeds the demo listings into the test database before the browser tests run. */
export default function globalSetup() {
  // tsx resolves the app's "@/..." imports; with-test-db points DATABASE_URL at TEST_DATABASE_URL.
  execFileSync("pnpm", ["exec", "tsx", "scripts/with-test-db.ts", "pnpm", "exec", "tsx", "prisma/seed.ts"], {
    stdio: "inherit",
    env: { ...process.env, ALLOW_DEMO_SEED: "1" },
  });
}

import { spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.test", quiet: true });

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set. Put it in .env.test (see .env.example).");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: tsx scripts/with-test-db.ts <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
child.on("exit", (code) => process.exit(code ?? 1));

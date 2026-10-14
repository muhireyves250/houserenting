import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.int.test.ts", "node_modules/**"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          // Run afterEach hooks in registration order: the setup file's cleanup() unmounts components
          // before a test file's own afterEach removes stubs (e.g. matchMedia) they may still read.
          sequence: { hooks: "list" },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          environment: "node",
          setupFiles: ["./vitest.int.setup.ts"],
          fileParallelism: false,
          // The test database is remote; on slow links a single query can take ~0.5s.
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

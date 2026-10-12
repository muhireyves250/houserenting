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
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});

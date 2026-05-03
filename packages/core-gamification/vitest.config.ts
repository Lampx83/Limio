import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(import.meta.dirname, ".env.test") });

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    sequence: { concurrent: false },
    fileParallelism: false,
    testTimeout: 15_000,
  },
});

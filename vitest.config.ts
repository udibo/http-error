import { fileURLToPath } from "node:url";
import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
  resolve: {
    alias: {
      "@udibo/http-error": fileURLToPath(
        new URL("./src/mod.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "examples/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "examples/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});

export default config;

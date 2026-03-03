import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ["src/**/*.test.ts", "electron/**/*.test.mjs"],
    environmentMatchGlobs: [
      ["src/**", "happy-dom"],
      ["electron/**", "node"]
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "electron/main/**/*.mjs"],
      exclude: ["src/main.ts", "src/env.d.ts", "**/*.test.*"]
    }
  }
});

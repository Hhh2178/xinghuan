import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx,js,mjs}"],
    exclude: ["node_modules/**", "dist/**", "dist-release/**", "runtime/**"],
  },
});

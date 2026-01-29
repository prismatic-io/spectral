import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["dist/**", "node_modules/**"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});

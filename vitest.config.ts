import * as path from "node:path";
import { defineConfig } from "vitest/config";

// Alias workspace packages to their sources so tests run without a prior build.
const pkg = (name: string) => path.resolve(__dirname, "packages", name, "src", "index.ts");

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@ai-context-bridge/shared": pkg("shared"),
      "@ai-context-bridge/context-engine": pkg("context-engine"),
      "@ai-context-bridge/provider-sdk": pkg("provider-sdk"),
    },
  },
});

import * as fs from "node:fs";
import * as path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";

// Alias workspace packages to their sources so tests run without a prior build.
const pkg = (name: string) => path.resolve(__dirname, "packages", name, "src", "index.ts");

/** Load `.md` files as default-exported strings (matches esbuild text loader). */
function markdownRawPlugin(): Plugin {
  return {
    name: "markdown-raw",
    load(id) {
      if (!id.endsWith(".md")) return null;
      const content = fs.readFileSync(id, "utf8");
      return `export default ${JSON.stringify(content)};`;
    },
  };
}

export default defineConfig({
  plugins: [markdownRawPlugin()],
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

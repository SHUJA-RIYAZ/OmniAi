import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

/**
 * Bundles the three extension entry points into dist/. Workspace packages
 * (@ai-context-bridge/shared, provider-sdk) are inlined, so the unpacked
 * extension stays self-contained.
 */
const entries = [
  { in: "src/background/index.ts", out: "background" },
  { in: "src/content/index.ts", out: "content" },
  { in: "src/popup/index.ts", out: "popup" },
];

await Promise.all(
  entries.map(({ in: entry, out }) =>
    build({
      entryPoints: [join(__dirname, entry)],
      outfile: join(dist, `${out}.js`),
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "es2022",
      loader: { ".md": "text" },
      logLevel: "info",
    }),
  ),
);

copyFileSync(join(__dirname, "src/popup/popup.html"), join(dist, "popup.html"));
copyFileSync(join(__dirname, "src/popup/popup.css"), join(dist, "popup.css"));

const manifest = JSON.parse(readFileSync(join(__dirname, "manifest.json"), "utf8"));
writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log("Built browser extension → packages/browser-extension/dist");

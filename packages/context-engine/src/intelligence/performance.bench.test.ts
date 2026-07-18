import { describe, expect, it } from "vitest";
import type { FileAnalysis } from "@ai-context-bridge/shared";
import { StaticFeatureFlags } from "@ai-context-bridge/shared";
import type { ILanguageAnalyzer } from "./interfaces";
import { CachedAnalyzer } from "./cache/analysisCache";
import { DependencyGraphBuilder } from "./dependency/graphBuilder";
import { PythonModuleResolver } from "./dependency/pythonModuleResolver";
import { IntelligenceContextBuilder } from "./services/intelligenceBuilder";
import { HeuristicTokenEstimator } from "./services/tokenEstimator";
import { ManifestWorkspaceSummarizer } from "./summarizer/workspaceSummarizer";
import { makeFunction } from "./testing/fakes";
import { InMemoryFileSystem } from "./testing/inMemoryFileSystem";

/**
 * Performance benchmarks over a synthetic 200-file workspace:
 * 10 packages × 20 modules, each importing the next module in its package
 * (chains) plus a shared `core/util.py` (fan-in), with a cycle inside each
 * package. The analyzer parses `import`-lines for real, so traversal cost
 * is representative; only the Python AST hop is simulated.
 *
 * Thresholds are deliberately loose (CI machines vary); the numbers logged
 * to the console are the actual benchmark output.
 */

const FILE_COUNT_PACKAGES = 10;
const MODULES_PER_PACKAGE = 20;

function buildWorkspace(): Record<string, string> {
  const files: Record<string, string> = { "core/util.py": "def helper():\n    pass\n" };
  for (let p = 0; p < FILE_COUNT_PACKAGES; p++) {
    for (let m = 0; m < MODULES_PER_PACKAGE; m++) {
      const lines = ["from core import util"];
      if (m + 1 < MODULES_PER_PACKAGE) lines.push(`from pkg${p} import mod${m + 1}`);
      if (m === MODULES_PER_PACKAGE - 1) lines.push(`from pkg${p} import mod0`); // cycle
      lines.push(`def fn_${p}_${m}():`, "    util.helper()");
      files[`pkg${p}/mod${m}.py`] = lines.join("\n");
    }
  }
  return files;
}

/** Line-based import parser standing in for the bridge AST analyzer. */
class SyntheticAnalyzer implements ILanguageAnalyzer {
  supports = (languageId: string) => languageId === "python";

  async analyze(source: string, _lang: string, path?: string): Promise<FileAnalysis> {
    const imports = [];
    const functions = [];
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const from = /^from (\S+) import (\S+)/.exec(line);
      if (from) {
        imports.push({
          module: from[1] as string,
          names: [{ name: from[2] as string }],
          isRelative: false,
          level: 0,
          line: i + 1,
        });
      }
      const def = /^def (\w+)\(/.exec(line);
      if (def) {
        functions.push(
          makeFunction({
            name: def[1] as string,
            startLine: i + 1,
            endLine: i + 2,
            ...(path ? { id: `python://${path}/${def[1]}` } : {}),
          }),
        );
      }
    }
    return { language: "python", imports, functions, classes: [] };
  }
}

function makeBuilder(fs: InMemoryFileSystem, analyzer: ILanguageAnalyzer) {
  return new IntelligenceContextBuilder(
    {
      analyzer,
      resolver: new PythonModuleResolver(fs),
      fs,
      summarizer: new ManifestWorkspaceSummarizer(fs),
      estimator: new HeuristicTokenEstimator(),
      flags: new StaticFeatureFlags({
        "engine.astParsing": true,
        "engine.dependencyGraph": true,
        "engine.tokenEstimation": true,
      }),
    },
    { maxDepth: 25, maxRelatedFiles: 5 },
  );
}

const input = (files: Record<string, string>) => ({
  filePath: "pkg0/mod0.py",
  languageId: "python",
  source: files["pkg0/mod0.py"] as string,
  cursorLine: 3,
  workspaceLanguages: ["python"],
  estimateTarget: "x".repeat(20_000),
});

describe("performance benchmarks (200-file workspace)", () => {
  const files = buildWorkspace();

  it("cold build traverses a 20-module chain within budget", async () => {
    const fs = new InMemoryFileSystem(files);
    const analyzer = new CachedAnalyzer(new SyntheticAnalyzer());
    const builder = makeBuilder(fs, analyzer);

    const start = Date.now();
    const context = await builder.build(input(files));
    const coldMs = Date.now() - start;

    expect(context.dependencyGraph?.files.length).toBe(MODULES_PER_PACKAGE + 1); // chain + core/util
    expect(context.dependencyGraph?.hasCycles).toBe(true);
    expect(context.warnings).toContainEqual(
      expect.objectContaining({ code: "cyclic-dependency" }),
    );
    expect(coldMs).toBeLessThan(2_000);

    console.log(
      `[bench] cold build: ${coldMs}ms · files in graph: ${context.dependencyGraph?.files.length}` +
        ` · parsed: ${context.metrics?.filesParsed} · cached: ${context.metrics?.filesCached}`,
    );
  });

  it("warm build serves parses from cache (hit rate > 0.9)", async () => {
    const fs = new InMemoryFileSystem(files);
    const analyzer = new CachedAnalyzer(new SyntheticAnalyzer());
    const builder = makeBuilder(fs, analyzer);

    await builder.build(input(files)); // cold
    const start = Date.now();
    const warm = await builder.build(input(files));
    const warmMs = Date.now() - start;

    expect(warm.metrics?.cacheHitRate).toBeGreaterThan(0.9);
    expect(warm.metrics?.filesParsed).toBe(0);
    expect(warmMs).toBeLessThan(1_000);

    console.log(
      `[bench] warm build: ${warmMs}ms · cacheHitRate: ${warm.metrics?.cacheHitRate.toFixed(2)}`,
    );
  });

  it("editing one file re-parses only that file", async () => {
    const fs = new InMemoryFileSystem(files);
    const analyzer = new CachedAnalyzer(new SyntheticAnalyzer());
    const builder = makeBuilder(fs, analyzer);
    await builder.build(input(files));

    // Simulate an edit to the active file only.
    const edited = { ...input(files), source: (files["pkg0/mod0.py"] as string) + "\n# edited" };
    const context = await builder.build(edited);

    expect(context.metrics?.filesParsed).toBe(1);
    console.log(
      `[bench] incremental: parsed ${context.metrics?.filesParsed}, cached ${context.metrics?.filesCached}`,
    );
  });
});

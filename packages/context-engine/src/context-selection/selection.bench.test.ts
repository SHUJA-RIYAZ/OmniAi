import { describe, expect, it } from "vitest";
import type { ContextSnapshot, DependencyEdge } from "@ai-context-bridge/shared";
import { InMemoryFileSystem } from "../intelligence/testing/inMemoryFileSystem";
import { HeuristicTokenEstimator } from "../intelligence/services/tokenEstimator";
import { ContextSelectionService } from "./services/contextSelectionService";
import { ContextScorer } from "./scoring/contextScorer";
import { PriorityRanker } from "./ranking/priorityRanker";
import { LineAnalyzer } from "./testing/fixtures";

/**
 * Scale benchmarks (Features 13–14): a 10,000-file dependency graph with
 * nested packages and cycles. Selection must stay fast because scoring is
 * O(graph) and file content is only read for the handful of files that
 * survive ranking (lazy loading).
 */

const FILE_COUNT = 10_000;

function buildLargeSnapshot(): { snapshot: ContextSnapshot; fs: InMemoryFileSystem } {
  const files: string[] = [];
  const edges: DependencyEdge[] = [];
  const sources: Record<string, string> = {};

  for (let i = 0; i < FILE_COUNT; i++) {
    const path = `pkg${Math.floor(i / 100)}/mod${i % 100}.py`;
    files.push(path);
    sources[path] = `def fn${i}():\n    pass\n`;
    if (i > 0) {
      const parent = `pkg${Math.floor((i - 1) / 100)}/mod${(i - 1) % 100}.py`;
      edges.push({ from: parent, to: path, type: "import" });
    }
  }
  // Cycles between package heads.
  for (let p = 0; p < 100; p += 10) {
    edges.push({ from: `pkg${p}/mod50.py`, to: `pkg${p}/mod0.py`, type: "import" });
  }

  const root = "pkg0/mod0.py";
  const snapshot: ContextSnapshot = {
    id: "bench-10k",
    createdAt: "2026-07-16T00:00:00Z",
    schemaVersion: 2,
    workspace: { name: "large", rootPath: "/large", languages: ["python"], manifests: [] },
    activeFile: {
      filePath: root,
      languageId: "python",
      content: sources[root] as string,
      truncated: false,
      lineCount: 2,
    },
    diagnostics: [
      { filePath: "pkg3/mod3.py", line: 1, column: 1, severity: "error", message: "x" },
    ],
    intelligence: {
      relatedFiles: [{ filePath: root, reason: "current", priority: 100, depth: 0 }],
      dependencyGraph: { rootFile: root, files, edges, maxDepth: 999, truncated: false },
    },
  };
  return { snapshot, fs: new InMemoryFileSystem(sources) };
}

describe("selection at scale (10,000 files)", () => {
  const { snapshot, fs } = buildLargeSnapshot();

  it("scores and ranks 10k files within budget", () => {
    const start = Date.now();
    const scored = new ContextScorer().scoreFiles({ snapshot });
    const ranked = new PriorityRanker().rankFiles(scored);
    const elapsed = Date.now() - start;

    expect(scored.length).toBe(FILE_COUNT);
    expect(ranked[0]?.filePath).toBe("pkg0/mod0.py");
    expect(elapsed).toBeLessThan(3_000);
    console.log(`[bench] scored+ranked ${FILE_COUNT} files in ${elapsed}ms`);
  });

  it("full selection stays fast because loading is lazy", async () => {
    const service = new ContextSelectionService({
      fs,
      estimator: new HeuristicTokenEstimator(),
      analyzer: new LineAnalyzer(),
    });

    const start = Date.now();
    const { selection } = await service.select({ snapshot }, { maxTokens: 4_000, maxFiles: 10 });
    const elapsed = Date.now() - start;

    expect(selection.items.length).toBeGreaterThan(0);
    expect(selection.items.length).toBeLessThanOrEqual(10);
    expect(elapsed).toBeLessThan(3_000);
    console.log(
      `[bench] full selection over ${FILE_COUNT} files: ${elapsed}ms · selected ${selection.items.length} · ratio ${selection.report.compressionRatio.toFixed(2)}`,
    );
  });

  it("selection is deterministic at scale", async () => {
    const service = new ContextSelectionService({
      fs,
      estimator: new HeuristicTokenEstimator(),
      analyzer: new LineAnalyzer(),
    });
    const a = await service.select({ snapshot }, { maxTokens: 2_000 });
    const b = await service.select({ snapshot }, { maxTokens: 2_000 });
    expect(a.prompt.finalPrompt).toBe(b.prompt.finalPrompt);
  });
});

import { describe, expect, it } from "vitest";
import { HeuristicTokenEstimator } from "../../intelligence/services/tokenEstimator";
import { TokenBudgetManager } from "./tokenBudgetManager";
import { CodeCompressor } from "../compression/codeCompressor";
import { StructuralCompressor } from "../compression/structuralCompressor";
import { ContextScorer } from "../scoring/contextScorer";
import { PriorityRanker } from "../ranking/priorityRanker";
import { DEFAULT_SELECTION_OPTIONS, type SelectionOptions } from "../models";
import { LineAnalyzer, makeFileSystem, makeInput } from "../testing/fixtures";

function makeManager() {
  return new TokenBudgetManager(
    makeFileSystem(),
    new HeuristicTokenEstimator(),
    new CodeCompressor(),
    new StructuralCompressor(),
    new LineAnalyzer(),
  );
}

function rankedFiles() {
  return new PriorityRanker().rankFiles(new ContextScorer().scoreFiles(makeInput()));
}

function options(overrides: Partial<SelectionOptions>): SelectionOptions {
  return { ...DEFAULT_SELECTION_OPTIONS, ...overrides };
}

describe("TokenBudgetManager", () => {
  it("selects everything under a generous budget", async () => {
    const result = await makeManager().fill(makeInput(), rankedFiles(), options({ maxTokens: 8000 }));

    expect(result.items.map((i) => i.filePath)).toContain("main.py");
    expect(result.items.map((i) => i.filePath)).toContain("jwt.py");
    expect(result.removedFiles).toEqual([]);
    expect(result.remainingTokens).toBeGreaterThan(0);
    expect(result.items.every((i) => i.tokens > 0)).toBe(true);
  });

  it("zero budget selects nothing and reports all candidates removed", async () => {
    const result = await makeManager().fill(makeInput(), rankedFiles(), options({ maxTokens: 0 }));
    expect(result.items).toEqual([]);
    expect(result.removedFiles.length).toBeGreaterThan(0);
    expect(result.remainingTokens).toBe(0);
  });

  it("tiny budget degrades to cheaper representations instead of dropping everything", async () => {
    const result = await makeManager().fill(makeInput(), rankedFiles(), options({ maxTokens: 60 }));
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.filePath).toBe("main.py");
    expect(["snippet", "structural", "compressed"]).toContain(result.items[0]?.representation);
    expect(result.remainingTokens).toBeGreaterThanOrEqual(0);
  });

  it("level none uses full sources only", async () => {
    const result = await makeManager().fill(
      makeInput(),
      rankedFiles(),
      options({ maxTokens: 8000, compressionLevel: "none" }),
    );
    expect(result.items.every((i) => i.representation === "full")).toBe(true);
  });

  it("unreadable files are removed, not fatal", async () => {
    const ranked = [
      ...rankedFiles(),
      {
        filePath: "ghost.py",
        score: 99,
        signals: { isCurrent: false, calledFromCurrent: true, diagnosticCount: 0, inGitDiff: false },
      },
    ];
    const result = await makeManager().fill(makeInput(), ranked, options({ maxTokens: 8000 }));
    expect(result.removedFiles).toContain("ghost.py");
  });

  it("respects maxFiles", async () => {
    const result = await makeManager().fill(
      makeInput(),
      rankedFiles(),
      options({ maxTokens: 100_000, maxFiles: 2 }),
    );
    expect(result.items).toHaveLength(2);
  });

  it("never exceeds the budget", async () => {
    for (const maxTokens of [30, 100, 250, 1000]) {
      const result = await makeManager().fill(makeInput(), rankedFiles(), options({ maxTokens }));
      const used = result.items.reduce((sum, i) => sum + i.tokens, 0);
      expect(used).toBeLessThanOrEqual(maxTokens);
      expect(result.remainingTokens).toBe(maxTokens - used);
    }
  });
});

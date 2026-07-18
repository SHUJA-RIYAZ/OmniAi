import { describe, expect, it } from "vitest";
import { HeuristicTokenEstimator } from "../../intelligence/services/tokenEstimator";
import { TokenBudgetManager } from "../budget/tokenBudgetManager";
import { CodeCompressor } from "../compression/codeCompressor";
import { StructuralCompressor } from "../compression/structuralCompressor";
import { StrategyRegistry } from "./strategies";
import { DEFAULT_SELECTION_OPTIONS } from "../models";
import { LineAnalyzer, makeFileSystem, makeInput } from "../testing/fixtures";

function registry() {
  return new StrategyRegistry(
    new TokenBudgetManager(
      makeFileSystem(),
      new HeuristicTokenEstimator(),
      new CodeCompressor(),
      new StructuralCompressor(),
      new LineAnalyzer(),
    ),
  );
}

const options = { ...DEFAULT_SELECTION_OPTIONS, maxTokens: 8000 };

describe("selection strategies", () => {
  it("registry exposes all five strategies and falls back to hybrid", () => {
    const r = registry();
    expect(r.names().sort()).toEqual(["current-file", "dependency", "diagnostics", "git", "hybrid"]);
    expect(r.get("nope").name).toBe("hybrid");
  });

  it("current-file strategy selects only the current file", async () => {
    const selection = await registry().get("current-file").select(makeInput(), options);
    expect(selection.items.map((i) => i.filePath)).toEqual(["main.py"]);
  });

  it("git strategy ranks diff-only files above unrelated imports", async () => {
    const selection = await registry().get("git").select(makeInput(), options);
    const order = selection.rankedFiles.map((f) => f.filePath);
    expect(order.indexOf("changed.py")).toBeLessThan(order.indexOf("models.py"));
  });

  it("diagnostics strategy boosts files with diagnostics", async () => {
    const selection = await registry().get("diagnostics").select(makeInput(), options);
    const utils = selection.rankedFiles.find((f) => f.filePath === "utils.py");
    expect(utils?.score).toBe(30); // 1 diagnostic × 30 boost
    const order = selection.rankedFiles.map((f) => f.filePath);
    expect(order.indexOf("utils.py")).toBeLessThan(order.indexOf("changed.py"));
  });

  it("hybrid produces a complete report", async () => {
    const selection = await registry().get("hybrid").select(makeInput(), options);
    const report = selection.report;

    expect(report.filesSelected).toBe(selection.items.length);
    expect(report.filesRemoved).toBe(selection.removedFiles.length);
    expect(report.compressedTokens).toBeLessThanOrEqual(report.originalTokens);
    expect(report.compressionRatio).toBeGreaterThan(0);
    expect(report.compressionRatio).toBeLessThanOrEqual(1);
    expect(report.budgetRemaining).toBe(
      options.maxTokens - selection.items.reduce((s, i) => s + i.tokens, 0),
    );
    expect(report.symbolsSelected).toBeGreaterThan(0);
  });

  it("selections are deterministic", async () => {
    const a = await registry().get("hybrid").select(makeInput(), options);
    const b = await registry().get("hybrid").select(makeInput(), options);
    expect(a.items).toEqual(b.items);
    expect(a.rankedFiles).toEqual(b.rankedFiles);
  });
});

import { describe, expect, it } from "vitest";
import { HeuristicTokenEstimator } from "../../intelligence/services/tokenEstimator";
import { ContextSelectionService } from "./contextSelectionService";
import { LineAnalyzer, makeFileSystem, makeInput } from "../testing/fixtures";

function service() {
  return new ContextSelectionService({
    fs: makeFileSystem(),
    estimator: new HeuristicTokenEstimator(),
    analyzer: new LineAnalyzer(),
  });
}

describe("ContextSelectionService (end to end)", () => {
  it("produces a selection and a versioned prompt document", async () => {
    const { selection, prompt } = await service().select(makeInput("Fix the login bug"), {
      maxTokens: 8000,
      strategy: "hybrid",
    });

    expect(selection.strategy).toBe("hybrid");
    expect(prompt.promptSchemaVersion).toBe(1);
    expect(prompt.currentTask).toBe("Fix the login bug");
    expect(prompt.currentFunction?.qualifiedName).toBe("login");
    expect(prompt.dependencySummary).toContain("main.py → jwt.py (call)");
    expect(prompt.diagnostics).toHaveLength(2);
    expect(prompt.gitDiff).toContain("diff --git");
    expect(prompt.files.map((f) => f.filePath)).toContain("main.py");
    expect(prompt.report).toEqual(selection.report);
  });

  it("finalPrompt renders every section and is byte-deterministic", async () => {
    const first = await service().select(makeInput("task"), { maxTokens: 8000 });
    const second = await service().select(makeInput("task"), { maxTokens: 8000 });

    expect(first.prompt.finalPrompt).toBe(second.prompt.finalPrompt);
    expect(first.prompt.finalPrompt).toContain("## Workspace: demo-app");
    expect(first.prompt.finalPrompt).toContain("## Current task");
    expect(first.prompt.finalPrompt).toContain("## Current function");
    expect(first.prompt.finalPrompt).toContain("## Diagnostics");
    expect(first.prompt.finalPrompt).toContain("### `main.py`");
  });

  it("prompt document is JSON-serializable and round-trips", async () => {
    const { prompt } = await service().select(makeInput(), { maxTokens: 4000 });
    const roundTripped = JSON.parse(JSON.stringify(prompt));
    expect(roundTripped).toEqual(prompt);
  });

  it("small budgets shrink the prompt but keep the current file", async () => {
    const large = await service().select(makeInput(), { maxTokens: 16_000 });
    const small = await service().select(makeInput(), { maxTokens: 200 });

    expect(small.prompt.files.length).toBeLessThanOrEqual(large.prompt.files.length);
    expect(small.prompt.files[0]?.filePath).toBe("main.py");
    expect(small.selection.report.budgetRemaining).toBeGreaterThanOrEqual(0);
  });

  it("unknown strategy falls back to hybrid", async () => {
    const { selection } = await service().select(makeInput(), { strategy: "bogus" });
    expect(selection.strategy).toBe("hybrid");
  });
});

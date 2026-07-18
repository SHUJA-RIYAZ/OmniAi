import { describe, expect, it } from "vitest";
import { ContextScorer, graphDepths, parseDiffFiles } from "./contextScorer";
import { makeInput } from "../testing/fixtures";

function scoresByFile() {
  const scored = new ContextScorer().scoreFiles(makeInput());
  return new Map(scored.map((s) => [s.filePath, s]));
}

describe("ContextScorer (hybrid weights)", () => {
  it("scores the current file 100 (clamped despite boosts)", () => {
    const main = scoresByFile().get("main.py");
    expect(main?.score).toBe(100);
    expect(main?.signals).toMatchObject({ isCurrent: true, inGitDiff: true, diagnosticCount: 1 });
  });

  it("scores call targets above plain imports, with depth decay", () => {
    const scores = scoresByFile();
    expect(scores.get("jwt.py")?.score).toBe(90); // called
    expect(scores.get("database.py")?.score).toBe(90); // called
    expect(scores.get("models.py")?.score).toBe(75); // depth 1 import
    expect(scores.get("config.py")?.score).toBe(60); // depth 2: 75 - 15
  });

  it("scores diagnostic-only and git-only files by their boosts", () => {
    const scores = scoresByFile();
    expect(scores.get("utils.py")?.score).toBe(5); // 1 diagnostic × 5
    expect(scores.get("changed.py")?.score).toBe(10); // git boost
  });

  it("is deterministic", () => {
    const a = new ContextScorer().scoreFiles(makeInput());
    const b = new ContextScorer().scoreFiles(makeInput());
    expect(a).toEqual(b);
  });
});

describe("graph helpers", () => {
  it("computes BFS depths over import edges only", () => {
    const depths = graphDepths(makeInput().snapshot.intelligence?.dependencyGraph, "main.py");
    expect(depths.get("main.py")).toBe(0);
    expect(depths.get("jwt.py")).toBe(1);
    expect(depths.get("config.py")).toBe(2);
  });

  it("parses b-side paths out of a unified diff", () => {
    const files = parseDiffFiles("diff --git a/x.py b/x.py\n+++\ndiff --git a/y.py b/y.py\n");
    expect([...files].sort()).toEqual(["x.py", "y.py"]);
    expect(parseDiffFiles(undefined).size).toBe(0);
  });
});

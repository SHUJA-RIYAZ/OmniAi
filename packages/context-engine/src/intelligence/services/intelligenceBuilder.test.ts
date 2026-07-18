import { describe, expect, it } from "vitest";
import { StaticFeatureFlags } from "@ai-context-bridge/shared";
import { IntelligenceContextBuilder } from "./intelligenceBuilder";
import { HeuristicTokenEstimator } from "./tokenEstimator";
import { PythonModuleResolver } from "../dependency/pythonModuleResolver";
import { ManifestWorkspaceSummarizer } from "../summarizer/workspaceSummarizer";
import { FakeAnalyzer, makeAnalysis, makeCall, makeFunction } from "../testing/fakes";
import { InMemoryFileSystem } from "../testing/inMemoryFileSystem";

const MAIN_SOURCE = "import repo\n\ndef create_user():\n    repo.create()\n";

function makeBuilder(flagOverrides: Record<string, boolean>) {
  const fs = new InMemoryFileSystem({
    "main.py": MAIN_SOURCE,
    "repo.py": "repo-source",
    "pyproject.toml": 'dependencies = ["fastapi"]',
  });
  const analyzer = new FakeAnalyzer(
    new Map([
      [
        MAIN_SOURCE,
        makeAnalysis({
          imports: [{ module: "repo", names: [], isRelative: false, level: 0, line: 1 }],
          functions: [
            makeFunction({
              name: "create_user",
              startLine: 3,
              endLine: 4,
              calls: [makeCall("repo.create", { module: "repo" })],
            }),
          ],
        }),
      ],
      ["repo-source", makeAnalysis({ functions: [makeFunction({ name: "create" })] })],
    ]),
  );
  return new IntelligenceContextBuilder(
    {
      analyzer,
      resolver: new PythonModuleResolver(fs),
      fs,
      summarizer: new ManifestWorkspaceSummarizer(fs),
      estimator: new HeuristicTokenEstimator(),
      flags: new StaticFeatureFlags(flagOverrides),
    },
    { maxDepth: 2, maxRelatedFiles: 5 },
  );
}

const input = {
  filePath: "main.py",
  languageId: "python",
  source: MAIN_SOURCE,
  cursorLine: 4,
  workspaceLanguages: ["python"],
  estimateTarget: "x".repeat(4000),
};

describe("IntelligenceContextBuilder", () => {
  it("produces a full context when all flags are on", async () => {
    const builder = makeBuilder({
      "engine.astParsing": true,
      "engine.dependencyGraph": true,
      "engine.tokenEstimation": true,
    });

    const context = await builder.build(input);

    expect(context.currentFunction?.name).toBe("create_user");
    expect(context.fileAnalysis?.imports).toHaveLength(1);
    expect(context.dependencyGraph?.files.sort()).toEqual(["main.py", "repo.py"]);
    expect(context.relatedFiles).toHaveLength(2);
    expect(context.relatedFiles[0]).toMatchObject({ filePath: "main.py", reason: "current" });
    expect(context.relatedFiles[1]).toMatchObject({ filePath: "repo.py", reason: "calls" });
    expect(context.workspaceSummary?.frameworks.backend).toBe("FastAPI");
    expect(context.tokenEstimate?.estimatedTokens).toBe(1000);
    expect(context.collectionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("skips analysis when astParsing is off but still summarizes", async () => {
    const builder = makeBuilder({
      "engine.astParsing": false,
      "engine.dependencyGraph": true,
      "engine.tokenEstimation": false,
    });

    const context = await builder.build(input);

    expect(context.fileAnalysis).toBeUndefined();
    expect(context.currentFunction).toBeUndefined();
    expect(context.dependencyGraph).toBeUndefined(); // depends on analysis
    expect(context.tokenEstimate).toBeUndefined();
    expect(context.workspaceSummary?.projectType).toBe("backend");
  });

  it("skips graph and related files when dependencyGraph is off", async () => {
    const builder = makeBuilder({
      "engine.astParsing": true,
      "engine.dependencyGraph": false,
    });

    const context = await builder.build(input);

    expect(context.fileAnalysis).toBeDefined();
    expect(context.dependencyGraph).toBeUndefined();
    expect(context.relatedFiles).toEqual([]);
  });

  it("degrades gracefully for unsupported languages with a warning", async () => {
    const builder = makeBuilder({
      "engine.astParsing": true,
      "engine.dependencyGraph": true,
    });

    const context = await builder.build({ ...input, languageId: "rust" });

    expect(context.fileAnalysis).toBeUndefined();
    expect(context.workspaceSummary).toBeDefined();
    expect(context.warnings).toContainEqual(
      expect.objectContaining({ code: "unsupported-language" }),
    );
  });

  it("reports parse failures as warnings instead of throwing", async () => {
    const builder = makeBuilder({ "engine.astParsing": true });

    const context = await builder.build({ ...input, source: "not-in-fake-analyzer" });

    expect(context.fileAnalysis).toBeUndefined();
    expect(context.warnings).toContainEqual(expect.objectContaining({ code: "parse-failed" }));
  });

  it("collects cursor context alongside the current function", async () => {
    const builder = makeBuilder({ "engine.astParsing": true });

    const context = await builder.build({ ...input, cursorColumn: 7, selectionLength: 3 });

    expect(context.cursor).toEqual({
      line: 4,
      column: 7,
      symbol: "create_user",
      scope: "function",
      selectionLength: 3,
    });
  });

  it("produces per-phase performance metrics", async () => {
    const builder = makeBuilder({
      "engine.astParsing": true,
      "engine.dependencyGraph": true,
      "engine.tokenEstimation": true,
    });

    const context = await builder.build(input);
    const metrics = context.metrics;

    expect(metrics).toBeDefined();
    expect(metrics!.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(metrics!.parseTimeMs + metrics!.dependencyTimeMs + metrics!.contextBuildTimeMs).toBe(
      metrics!.totalTimeMs,
    );
    expect(metrics!.cacheHitRate).toBeGreaterThanOrEqual(0);
  });
});

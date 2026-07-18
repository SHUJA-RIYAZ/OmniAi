import { describe, expect, it } from "vitest";
import type { FileAnalysis } from "@ai-context-bridge/shared";
import type { ILanguageAnalyzer } from "../interfaces";
import { LanguageIntelligence } from "./languageIntelligence";
import { PythonModuleResolver } from "../dependency/pythonModuleResolver";
import { makeAnalysis, makeFunction } from "../testing/fakes";
import { InMemoryFileSystem } from "../testing/inMemoryFileSystem";

const MAIN = "import repo\n...";

const analysis = makeAnalysis({
  imports: [{ module: "repo", names: [], isRelative: false, level: 0, line: 1 }],
  functions: [makeFunction({ name: "create_user", startLine: 3, endLine: 9 })],
  classes: [
    {
      name: "Service",
      baseClasses: [],
      decorators: [],
      startLine: 11,
      endLine: 20,
      properties: [],
      visibility: "public",
      methods: [
        makeFunction({
          name: "run",
          qualifiedName: "Service.run",
          startLine: 12,
          endLine: 15,
          isMethod: true,
        }),
      ],
    },
  ],
});

/** Counts parses so the memo behavior is observable. */
class CountingAnalyzer implements ILanguageAnalyzer {
  parseCount = 0;
  supports = (languageId: string) => languageId === "python";
  async analyze(source: string, _lang: string): Promise<FileAnalysis> {
    this.parseCount++;
    if (source === MAIN) return analysis;
    return makeAnalysis();
  }
}

function make() {
  const fs = new InMemoryFileSystem({ "main.py": MAIN, "repo.py": "" });
  const analyzer = new CountingAnalyzer();
  return {
    analyzer,
    intelligence: new LanguageIntelligence(analyzer, new PythonModuleResolver(fs), fs),
  };
}

describe("LanguageIntelligence", () => {
  it("answers all single-file questions from one analysis", async () => {
    const { analyzer, intelligence } = make();

    expect((await intelligence.extractImports(MAIN, "python"))[0]?.module).toBe("repo");
    expect((await intelligence.extractClasses(MAIN, "python"))[0]?.name).toBe("Service");
    const functions = await intelligence.extractFunctions(MAIN, "python");
    expect(functions.map((f) => f.qualifiedName)).toEqual(["create_user", "Service.run"]);
    expect((await intelligence.detectCurrentFunction(MAIN, "python", 13))?.qualifiedName).toBe(
      "Service.run",
    );

    expect(analyzer.parseCount).toBe(1); // memoized across all four calls
  });

  it("re-parses when the source changes", async () => {
    const { analyzer, intelligence } = make();
    await intelligence.extractImports(MAIN, "python");
    await intelligence.extractImports("changed", "python");
    expect(analyzer.parseCount).toBe(2);
  });

  it("returns undefined for a cursor outside any function", async () => {
    const { intelligence } = make();
    expect(await intelligence.detectCurrentFunction(MAIN, "python", 10)).toBeUndefined();
  });

  it("builds the dependency graph through the same analyzer", async () => {
    const { intelligence } = make();
    const graph = await intelligence.buildDependencyGraph("main.py", "python", 2);
    expect(graph.files.sort()).toEqual(["main.py", "repo.py"]);
    expect(graph.edges).toEqual([{ from: "main.py", to: "repo.py", type: "import" }]);
  });
});

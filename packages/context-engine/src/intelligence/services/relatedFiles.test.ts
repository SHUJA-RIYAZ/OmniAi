import { describe, expect, it } from "vitest";
import { RelatedFileDiscovery } from "./relatedFiles";
import { PythonModuleResolver } from "../dependency/pythonModuleResolver";
import { FakeAnalyzer, makeAnalysis, makeFunction } from "../testing/fakes";
import { InMemoryFileSystem } from "../testing/inMemoryFileSystem";

function imp(module: string) {
  return { module, names: [], isRelative: false, level: 0, line: 1 };
}

const SOURCES = {
  "main.py": "main",
  "repo.py": "repo",
  "config.py": "config",
  "log.py": "log",
};

const currentAnalysis = makeAnalysis({
  imports: [imp("config"), imp("repo"), imp("log")],
});

const currentFunction = makeFunction({
  name: "create_user",
  startLine: 1,
  endLine: 10,
  calls: ["UserRepository.create", "validate"],
});

function makeDiscovery() {
  const fs = new InMemoryFileSystem(SOURCES);
  const analyzer = new FakeAnalyzer(
    new Map([
      ["repo", makeAnalysis({ functions: [makeFunction({ name: "create" })] })],
      ["config", makeAnalysis()],
      ["log", makeAnalysis()],
    ]),
  );
  return new RelatedFileDiscovery(analyzer, new PythonModuleResolver(fs), fs);
}

describe("RelatedFileDiscovery", () => {
  it("puts the current file first and ranks call-defining files before plain imports", async () => {
    const related = await makeDiscovery().discover(
      "main.py",
      "python",
      currentAnalysis,
      currentFunction,
      5,
    );

    expect(related[0]).toEqual({ filePath: "main.py", reason: "current" });
    expect(related[1]).toEqual({ filePath: "repo.py", reason: "calls" });
    expect(related.slice(2).map((r) => r.reason)).toEqual(["imported", "imported"]);
  });

  it("respects the maximum", async () => {
    const related = await makeDiscovery().discover(
      "main.py",
      "python",
      currentAnalysis,
      currentFunction,
      2,
    );
    expect(related).toHaveLength(2);
    expect(related.map((r) => r.filePath)).toEqual(["main.py", "repo.py"]);
  });

  it("works without a current function", async () => {
    const related = await makeDiscovery().discover(
      "main.py",
      "python",
      currentAnalysis,
      undefined,
      5,
    );
    expect(related[0]?.reason).toBe("current");
    expect(related.slice(1).every((r) => r.reason === "imported")).toBe(true);
  });
});

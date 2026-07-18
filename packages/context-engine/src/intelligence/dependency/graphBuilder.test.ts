import { describe, expect, it } from "vitest";
import { DependencyGraphBuilder } from "./graphBuilder";
import { PythonModuleResolver } from "./pythonModuleResolver";
import { FakeAnalyzer, makeAnalysis } from "../testing/fakes";
import { InMemoryFileSystem } from "../testing/inMemoryFileSystem";

// a → b → c → d, plus a cycle b → a.
const SOURCES = {
  "a.py": "import b",
  "b.py": "import c\nimport a",
  "c.py": "import d",
  "d.py": "",
};

function makeBuilder() {
  const fs = new InMemoryFileSystem(SOURCES);
  const analyzer = new FakeAnalyzer(
    new Map([
      [SOURCES["a.py"], makeAnalysis({ imports: [imp("b")] })],
      [SOURCES["b.py"], makeAnalysis({ imports: [imp("c"), imp("a")] })],
      [SOURCES["c.py"], makeAnalysis({ imports: [imp("d")] })],
      [SOURCES["d.py"], makeAnalysis()],
    ]),
  );
  return new DependencyGraphBuilder(analyzer, new PythonModuleResolver(fs), fs);
}

function imp(module: string) {
  return { module, names: [], isRelative: false, level: 0, line: 1 };
}

describe("DependencyGraphBuilder", () => {
  it("walks imports transitively up to maxDepth", async () => {
    const graph = await makeBuilder().build("a.py", "python", 3);
    expect(graph.files.sort()).toEqual(["a.py", "b.py", "c.py", "d.py"]);
    expect(graph.edges).toContainEqual({ from: "a.py", to: "b.py", type: "import" });
    expect(graph.edges).toContainEqual({ from: "c.py", to: "d.py", type: "import" });
    expect(graph.truncated).toBe(false);
  });

  it("stops at maxDepth and reports truncation", async () => {
    const graph = await makeBuilder().build("a.py", "python", 1);
    expect(graph.files.sort()).toEqual(["a.py", "b.py"]);
    expect(graph.truncated).toBe(true);
  });

  it("emits typed nodes for visualization", async () => {
    const graph = await makeBuilder().build("a.py", "python", 3);
    expect(graph.nodes).toContainEqual({ id: "a.py", filePath: "a.py", kind: "file" });
    expect(graph.nodes).toHaveLength(graph.files.length);
  });

  it("flags cyclic graphs without looping", async () => {
    const graph = await makeBuilder().build("a.py", "python", 5);
    expect(graph.hasCycles).toBe(true); // a → b → a

    const acyclic = await makeBuilder().build("c.py", "python", 5);
    expect(acyclic.hasCycles).toBe(false); // c → d only
  });

  it("handles cycles without looping", async () => {
    const graph = await makeBuilder().build("b.py", "python", 10);
    expect(graph.files.sort()).toEqual(["a.py", "b.py", "c.py", "d.py"]);
    // b→a and a→b both present, no duplicates, no self-edges.
    const keys = graph.edges.map((e) => `${e.from}→${e.to}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("b.py→a.py");
    expect(keys).toContain("a.py→b.py");
  });

  it("treats unreadable or unparseable files as leaves", async () => {
    const fs = new InMemoryFileSystem({ "a.py": "import b", "b.py": "garbage" });
    const analyzer = new FakeAnalyzer(
      new Map([["import b", makeAnalysis({ imports: [imp("b")] })]]),
    );
    const builder = new DependencyGraphBuilder(analyzer, new PythonModuleResolver(fs), fs);

    const graph = await builder.build("a.py", "python", 5);
    expect(graph.files.sort()).toEqual(["a.py", "b.py"]);
    expect(graph.truncated).toBe(false);
  });
});

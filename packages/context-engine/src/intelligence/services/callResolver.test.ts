import { describe, expect, it } from "vitest";
import { CallResolver } from "./callResolver";
import { PythonModuleResolver } from "../dependency/pythonModuleResolver";
import { makeAnalysis, makeCall, makeFunction } from "../testing/fakes";
import { InMemoryFileSystem } from "../testing/inMemoryFileSystem";

const fs = new InMemoryFileSystem({
  "main.py": "",
  "database.py": "",
  "models/base.py": "",
  "models/__init__.py": "",
});

function analysisFixture() {
  return makeAnalysis({
    imports: [
      { module: "database", names: [{ name: "get_db" }], isRelative: false, level: 0, line: 1 },
      { module: "models.base", names: [{ name: "BaseModel" }], isRelative: false, level: 0, line: 2 },
      { module: "requests", names: [], isRelative: false, level: 0, line: 3 },
    ],
    functions: [
      makeFunction({
        name: "handler",
        calls: [
          makeCall("database.get_db", { module: "database" }),
          makeCall("requests.get", { module: "requests" }),
          makeCall("helper", { type: "local", resolved: true }),
        ],
      }),
    ],
    classes: [
      {
        name: "User",
        baseClasses: ["BaseModel"],
        decorators: [],
        startLine: 10,
        endLine: 20,
        methods: [],
        properties: [],
        visibility: "public",
      },
    ],
  });
}

describe("CallResolver", () => {
  it("upgrades workspace-resolvable calls and demotes the rest to thirdparty", async () => {
    const analysis = analysisFixture();
    const resolver = new CallResolver(new PythonModuleResolver(fs));

    await resolver.resolve(analysis, "main.py");

    const calls = analysis.functions[0]!.calls;
    const byName = new Map(calls.map((c) => [c.name, c]));
    expect(byName.get("get_db")).toMatchObject({ type: "workspace", resolved: true });
    expect(byName.get("get")).toMatchObject({ type: "thirdparty", resolved: false });
    expect(byName.get("helper")).toMatchObject({ type: "local", resolved: true }); // untouched
  });

  it("emits call and inherits edges toward workspace files", async () => {
    const analysis = analysisFixture();
    const resolver = new CallResolver(new PythonModuleResolver(fs));

    const { edges } = await resolver.resolve(analysis, "main.py");

    expect(edges).toContainEqual({ from: "main.py", to: "database.py", type: "call" });
    expect(edges).toContainEqual({ from: "main.py", to: "models/base.py", type: "inherits" });
    // Third-party imports produce no edges.
    expect(edges.every((e) => e.to !== "requests")).toBe(true);
  });
});

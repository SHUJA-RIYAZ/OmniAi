import { describe, expect, it } from "vitest";
import { StructuralCompressor } from "./structuralCompressor";
import { makeAnalysis, makeFunction } from "../../intelligence/testing/fakes";

describe("StructuralCompressor", () => {
  it("renders imports, function signatures, and class skeletons", () => {
    const analysis = makeAnalysis({
      imports: [
        { module: "os", names: [], isRelative: false, level: 0, line: 1 },
        { module: "db", names: [{ name: "get_db" }], isRelative: false, level: 0, line: 2 },
      ],
      functions: [
        makeFunction({
          name: "login",
          args: [
            { name: "user", type: "str" },
            { name: "admin", type: "bool", default: "False" },
          ],
          returnType: "dict",
          docstring: "Log a user in.\nSecond line ignored.",
          decorators: ["app.post('/login')"],
        }),
      ],
      classes: [
        {
          name: "User",
          baseClasses: ["Base"],
          decorators: [],
          docstring: "A user.",
          startLine: 10,
          endLine: 40,
          properties: [{ name: "name", type: "str", visibility: "public", line: 12 }],
          methods: [makeFunction({ name: "save", isMethod: true, qualifiedName: "User.save" })],
          visibility: "public",
        },
      ],
    });

    const out = new StructuralCompressor().render("app/main.py", analysis);

    expect(out).toContain("# app/main.py — structural summary");
    expect(out).toContain("# imports: os, db");
    expect(out).toContain("@app.post('/login')");
    expect(out).toContain("def login(user: str, admin: bool = False) -> dict:");
    expect(out).toContain('"""Log a user in."""');
    expect(out).not.toContain("Second line");
    expect(out).toContain("class User(Base):");
    expect(out).toContain("    name: str");
    expect(out).toContain("    def save(");
  });

  it("is much smaller than a real body would be and deterministic", () => {
    const analysis = makeAnalysis({
      functions: Array.from({ length: 30 }, (_, i) => makeFunction({ name: `fn${i}` })),
    });
    const compressor = new StructuralCompressor();
    const once = compressor.render("big.py", analysis);
    expect(once).toBe(compressor.render("big.py", analysis));
    expect(once.split("\n").length).toBeLessThan(40);
  });
});

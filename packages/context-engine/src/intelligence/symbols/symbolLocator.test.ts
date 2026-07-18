import { describe, expect, it } from "vitest";
import { buildCursorContext, findEnclosingClass, findEnclosingFunction } from "./symbolLocator";
import { makeAnalysis, makeFunction } from "../testing/fakes";

const analysis = makeAnalysis({
  functions: [
    makeFunction({ name: "outer", startLine: 1, endLine: 20, nestedFunctions: ["inner"] }),
    makeFunction({ name: "inner", startLine: 5, endLine: 8 }),
  ],
  classes: [
    {
      name: "Repo",
      baseClasses: [],
      decorators: [],
      startLine: 30,
      endLine: 50,
      properties: [],
      visibility: "public",
      methods: [
        makeFunction({
          name: "create",
          qualifiedName: "Repo.create",
          startLine: 35,
          endLine: 40,
          isMethod: true,
        }),
      ],
    },
  ],
});

describe("findEnclosingFunction", () => {
  it("returns the innermost function containing the cursor", () => {
    expect(findEnclosingFunction(analysis, 6)?.name).toBe("inner");
    expect(findEnclosingFunction(analysis, 15)?.name).toBe("outer");
  });

  it("finds class methods", () => {
    expect(findEnclosingFunction(analysis, 37)?.qualifiedName).toBe("Repo.create");
  });

  it("returns undefined at module level", () => {
    expect(findEnclosingFunction(analysis, 25)).toBeUndefined();
    expect(findEnclosingFunction(analysis, 32)).toBeUndefined(); // in class, outside methods
  });

  it("includes boundary lines", () => {
    expect(findEnclosingFunction(analysis, 1)?.name).toBe("outer");
    expect(findEnclosingFunction(analysis, 20)?.name).toBe("outer");
  });
});

describe("buildCursorContext", () => {
  it("reports function scope with enclosing class", () => {
    expect(buildCursorContext(analysis, 37, 8, 12)).toEqual({
      line: 37,
      column: 8,
      symbol: "create",
      className: "Repo",
      scope: "function",
      selectionLength: 12,
    });
  });

  it("reports class scope between methods", () => {
    const ctx = buildCursorContext(analysis, 32, 1, 0);
    expect(ctx.scope).toBe("class");
    expect(ctx.className).toBe("Repo");
    expect(ctx.symbol).toBeUndefined();
  });

  it("reports module scope outside everything", () => {
    expect(buildCursorContext(analysis, 25, 1, 0)).toEqual({
      line: 25,
      column: 1,
      scope: "module",
      selectionLength: 0,
    });
  });

  it("findEnclosingClass picks the innermost class", () => {
    expect(findEnclosingClass(analysis, 40)?.name).toBe("Repo");
    expect(findEnclosingClass(analysis, 5)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { findEnclosingFunction } from "./symbolLocator";
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

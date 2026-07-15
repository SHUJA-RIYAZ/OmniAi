import { describe, expect, it } from "vitest";
import type { ContextSnapshot } from "@ai-context-bridge/shared";
import { buildStatusReport, renderStatusHtml } from "./statusReport";

const snapshot: ContextSnapshot = {
  id: "snap-9",
  createdAt: "2026-07-15T00:00:00Z",
  schemaVersion: 1,
  workspace: { name: "demo", rootPath: "/d", languages: ["python"], manifests: [] },
  diagnostics: [],
  intelligence: {
    currentFunction: {
      name: "create_user",
      qualifiedName: "UserService.create_user",
      args: [],
      decorators: [],
      startLine: 1,
      endLine: 5,
      calls: [],
      raises: [],
      nestedFunctions: [],
      isMethod: true,
    },
    relatedFiles: [
      { filePath: "main.py", reason: "current" },
      { filePath: "repo.py", reason: "calls" },
    ],
    workspaceSummary: {
      projectType: "backend",
      frameworks: { backend: "FastAPI" },
      languages: ["python"],
    },
    tokenEstimate: { characters: 12_000, estimatedTokens: 3_000, level: "ok" },
    collectionTimeMs: 42,
  },
};

describe("buildStatusReport", () => {
  it("extracts intelligence fields into the view model", () => {
    const report = buildStatusReport(snapshot, [{ collectorId: "gitDiff", status: "ok" }]);
    expect(report.estimatedTokens).toBe(3000);
    expect(report.currentFunction).toBe("UserService.create_user");
    expect(report.projectType).toBe("backend");
    expect(report.backend).toBe("FastAPI");
    expect(report.collectionTimeMs).toBe(42);
    expect(report.relatedFiles).toHaveLength(2);
  });

  it("works without intelligence (base snapshot only)", () => {
    const plain: ContextSnapshot = { ...snapshot };
    delete plain.intelligence;
    const report = buildStatusReport(plain, []);
    expect(report.estimatedTokens).toBeUndefined();
    expect(report.characters).toBeGreaterThan(0);
    expect(report.relatedFiles).toEqual([]);
  });
});

describe("renderStatusHtml", () => {
  it("renders all sections and escapes HTML", () => {
    const report = buildStatusReport(snapshot, [
      { collectorId: "terminal", status: "failed", error: "<script>alert(1)</script>" },
    ]);
    const html = renderStatusHtml(report);
    expect(html).toContain("UserService.create_user");
    expect(html).toContain("repo.py");
    expect(html).toContain("backend (FastAPI)");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

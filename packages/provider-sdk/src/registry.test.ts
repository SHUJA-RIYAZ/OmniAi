import { describe, expect, it } from "vitest";
import type { ContextSnapshot } from "@ai-context-bridge/shared";
import { ProviderRegistry } from "./registry";
import { builtInAdapters, claudeAdapter } from "./adapters";
import { formatSnapshotAsMarkdown } from "./markdownFormatter";

const snapshot: ContextSnapshot = {
  id: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  schemaVersion: 1,
  workspace: { name: "demo", rootPath: "/demo", languages: ["python"], manifests: [] },
  diagnostics: [
    { filePath: "app.py", line: 10, column: 5, severity: "error", message: "undefined name" },
  ],
  selection: { filePath: "app.py", startLine: 8, endLine: 12, text: "def f():\n    pass" },
};

describe("ProviderRegistry", () => {
  it("resolves adapters by URL", () => {
    const registry = new ProviderRegistry();
    builtInAdapters.forEach((a) => registry.register(a));

    expect(registry.forUrl("https://claude.ai/chat/abc")?.id).toBe("claude");
    expect(registry.forUrl("https://chatgpt.com/")?.id).toBe("chatgpt");
    expect(registry.forUrl("https://example.com/")).toBeUndefined();
    expect(registry.forUrl("not a url")).toBeUndefined();
  });

  it("rejects duplicate registration", () => {
    const registry = new ProviderRegistry();
    registry.register(claudeAdapter);
    expect(() => registry.register(claudeAdapter)).toThrow(/already registered/);
  });

  it("does not match lookalike hostnames", () => {
    const registry = new ProviderRegistry();
    registry.register(claudeAdapter);
    expect(registry.forUrl("https://evilclaude.ai/")).toBeUndefined();
    expect(registry.forUrl("https://claude.ai.evil.com/")).toBeUndefined();
  });
});

describe("formatSnapshotAsMarkdown", () => {
  it("includes populated sections and omits empty ones", () => {
    const md = formatSnapshotAsMarkdown(snapshot);
    expect(md).toContain("# Project context: demo");
    expect(md).toContain("## Selection");
    expect(md).toContain("undefined name");
    expect(md).not.toContain("## Git diff");
    expect(md).not.toContain("## Terminal");
  });
});

import { describe, expect, it } from "vitest";
import { StaticFeatureFlags, type WorkspaceMetadata } from "@ai-context-bridge/shared";
import { ContextAssembler, type IdGenerator } from "./assembler";
import type { ContextCollector } from "./collector";

const workspace: WorkspaceMetadata = {
  name: "demo",
  rootPath: "/demo",
  languages: ["typescript"],
  manifests: ["package.json"],
};

const fixedIds: IdGenerator = { next: () => "snap-1" };

function collector(
  id: string,
  flag: ContextCollector["flag"],
  collect: ContextCollector["collect"],
): ContextCollector {
  return { id, flag, collect };
}

describe("ContextAssembler", () => {
  it("merges collector output into the snapshot", async () => {
    const assembler = new ContextAssembler(
      [
        collector("selection", "collect.selection", async () => ({
          selection: { filePath: "a.ts", startLine: 1, endLine: 2, text: "x" },
        })),
        collector("diagnostics", "collect.diagnostics", async () => ({
          diagnostics: [
            { filePath: "a.ts", line: 1, column: 1, severity: "error", message: "boom" },
          ],
        })),
      ],
      new StaticFeatureFlags(),
      fixedIds,
      () => new Date("2026-01-01T00:00:00Z"),
    );

    const { snapshot, results } = await assembler.assemble(workspace);

    expect(snapshot.id).toBe("snap-1");
    expect(snapshot.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(snapshot.selection?.text).toBe("x");
    expect(snapshot.diagnostics).toHaveLength(1);
    expect(results.every((r) => r.status === "ok")).toBe(true);
  });

  it("skips collectors whose feature flag is disabled", async () => {
    let ran = false;
    const assembler = new ContextAssembler(
      [
        collector("terminal", "collect.terminal", async () => {
          ran = true;
          return {};
        }),
      ],
      new StaticFeatureFlags(), // collect.terminal defaults to false
      fixedIds,
    );

    const { results } = await assembler.assemble(workspace);

    expect(ran).toBe(false);
    expect(results[0]).toMatchObject({ collectorId: "terminal", status: "skipped" });
  });

  it("records a failure without failing the snapshot", async () => {
    const assembler = new ContextAssembler(
      [
        collector("gitDiff", "collect.gitDiff", async () => {
          throw new Error("git not found");
        }),
        collector("selection", "collect.selection", async () => ({
          selection: { filePath: "b.ts", startLine: 3, endLine: 3, text: "y" },
        })),
      ],
      new StaticFeatureFlags(),
      fixedIds,
    );

    const { snapshot, results } = await assembler.assemble(workspace);

    expect(results[0]).toMatchObject({ status: "failed", error: "git not found" });
    expect(snapshot.selection?.text).toBe("y");
  });
});

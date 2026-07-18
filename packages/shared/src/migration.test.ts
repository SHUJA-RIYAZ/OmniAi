import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, migrateSnapshot } from "./migration";
import type { ContextSnapshot } from "./types";

function v1Snapshot(): ContextSnapshot {
  return {
    id: "old",
    createdAt: "2026-07-01T00:00:00Z",
    schemaVersion: 1,
    workspace: { name: "demo", rootPath: "/d", languages: [], manifests: [] },
    diagnostics: [],
    intelligence: {
      relatedFiles: [],
      currentFunction: {
        name: "login",
        qualifiedName: "login",
        args: [],
        decorators: [],
        startLine: 1,
        endLine: 9,
        // v1 stored bare strings.
        calls: ["jwt.create_token", "get_db"] as never,
        raises: [],
        nestedFunctions: [],
        isMethod: false,
      },
    },
  };
}

describe("migrateSnapshot", () => {
  it("upgrades v1 call strings to CallInfo objects", () => {
    const migrated = migrateSnapshot(v1Snapshot());

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const calls = migrated.intelligence?.currentFunction?.calls ?? [];
    expect(calls[0]).toEqual({
      name: "create_token",
      qualifiedName: "jwt.create_token",
      line: 0,
      resolved: false,
      type: "unknown",
    });
    expect(calls[1]?.name).toBe("get_db");
  });

  it("does not mutate the input snapshot", () => {
    const original = v1Snapshot();
    migrateSnapshot(original);
    expect(original.schemaVersion).toBe(1);
    expect(typeof original.intelligence?.currentFunction?.calls[0]).toBe("string");
  });

  it("returns current-version snapshots unchanged by reference", () => {
    const current: ContextSnapshot = { ...v1Snapshot(), schemaVersion: 2 };
    delete current.intelligence;
    expect(migrateSnapshot(current)).toBe(current);
  });

  it("handles v1 snapshots without intelligence", () => {
    const plain = v1Snapshot();
    delete plain.intelligence;
    const migrated = migrateSnapshot(plain);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.intelligence).toBeUndefined();
  });
});

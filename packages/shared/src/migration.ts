import type { ContextSnapshot } from "./types";
import type { CallInfo, FunctionInfo } from "./intelligence";

/**
 * Snapshot schema versioning.
 *
 * Rules:
 * - Producers always emit {@link CURRENT_SCHEMA_VERSION}.
 * - Consumers call {@link migrateSnapshot} before reading, so every version
 *   ever shipped stays loadable.
 * - Migrations are pure, additive, and chained v1→v2→…; never edit an old
 *   migration, add a new one.
 */
export const CURRENT_SCHEMA_VERSION = 2 as const;

/** v1 stored calls as bare dotted strings. */
type V1Call = string;

function migrateCall(call: V1Call | CallInfo): CallInfo {
  if (typeof call !== "string") return call;
  const segments = call.split(".");
  return {
    name: segments[segments.length - 1] as string,
    qualifiedName: call,
    line: 0,
    resolved: false,
    type: "unknown",
  };
}

function migrateFunction(fn: FunctionInfo): FunctionInfo {
  return {
    ...fn,
    calls: (fn.calls as Array<V1Call | CallInfo>).map(migrateCall),
  };
}

/**
 * Upgrades a snapshot of any known schema version to the current one.
 * Already-current snapshots are returned unchanged (same reference).
 */
export function migrateSnapshot(snapshot: ContextSnapshot): ContextSnapshot {
  if (snapshot.schemaVersion >= CURRENT_SCHEMA_VERSION) return snapshot;

  // v1 → v2: call strings become CallInfo objects; all other v2 fields are
  // optional additions and need no defaults.
  const intel = snapshot.intelligence;
  return {
    ...snapshot,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...(intel
      ? {
          intelligence: {
            ...intel,
            ...(intel.currentFunction
              ? { currentFunction: migrateFunction(intel.currentFunction) }
              : {}),
            ...(intel.fileAnalysis
              ? {
                  fileAnalysis: {
                    ...intel.fileAnalysis,
                    functions: intel.fileAnalysis.functions.map(migrateFunction),
                    classes: intel.fileAnalysis.classes.map((cls) => ({
                      ...cls,
                      methods: cls.methods.map(migrateFunction),
                    })),
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

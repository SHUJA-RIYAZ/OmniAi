import type { ContextSnapshot, FeatureFlagName } from "@ai-context-bridge/shared";

/**
 * A collector gathers one slice of a {@link ContextSnapshot}. Collectors are
 * host-specific (the VS Code extension implements them against the VS Code
 * API), while the assembly pipeline in this package is host-agnostic.
 *
 * Contract:
 * - `collect` must never throw for expected conditions (no active editor,
 *   no git repo); return an empty object instead.
 * - Each collector owns disjoint keys of the snapshot, so merging is a
 *   simple shallow spread.
 */
export interface ContextCollector {
  /** Stable identifier, used in logs and error reports. */
  readonly id: string;
  /** The feature flag gating this collector. */
  readonly flag: FeatureFlagName;
  collect(): Promise<Partial<ContextSnapshot>>;
}

/** Result of running one collector, kept for diagnostics/telemetry. */
export interface CollectorResult {
  collectorId: string;
  status: "ok" | "skipped" | "failed";
  error?: string;
}

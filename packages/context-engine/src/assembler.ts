import {
  CURRENT_SCHEMA_VERSION,
  type ContextSnapshot,
  type FeatureFlagReader,
  type WorkspaceMetadata,
} from "@ai-context-bridge/shared";
import type { CollectorResult, ContextCollector } from "./collector";

export interface AssembleOutcome {
  snapshot: ContextSnapshot;
  results: CollectorResult[];
}

/** Minimal ID source so the assembler stays testable and host-agnostic. */
export interface IdGenerator {
  next(): string;
}

export class RandomIdGenerator implements IdGenerator {
  next(): string {
    // crypto.randomUUID exists in Node >= 19 and all modern browsers.
    return globalThis.crypto.randomUUID();
  }
}

/**
 * Runs all registered collectors (respecting feature flags), merges their
 * partial outputs into a complete {@link ContextSnapshot}, and reports
 * per-collector status. A failing collector never fails the snapshot.
 */
export class ContextAssembler {
  constructor(
    private readonly collectors: ContextCollector[],
    private readonly flags: FeatureFlagReader,
    private readonly ids: IdGenerator = new RandomIdGenerator(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async assemble(workspace: WorkspaceMetadata): Promise<AssembleOutcome> {
    const snapshot: ContextSnapshot = {
      id: this.ids.next(),
      createdAt: this.now().toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      workspace,
      diagnostics: [],
    };
    const results: CollectorResult[] = [];

    for (const collector of this.collectors) {
      if (!this.flags.isEnabled(collector.flag)) {
        results.push({ collectorId: collector.id, status: "skipped" });
        continue;
      }
      try {
        Object.assign(snapshot, await collector.collect());
        results.push({ collectorId: collector.id, status: "ok" });
      } catch (err) {
        results.push({
          collectorId: collector.id,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { snapshot, results };
  }
}

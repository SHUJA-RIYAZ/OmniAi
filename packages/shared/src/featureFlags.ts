/**
 * Feature flags gate every capability so features can ship incrementally
 * and be disabled without code changes. The VS Code extension maps these
 * to workspace configuration; other components read them from their own
 * config sources but share the canonical names defined here.
 */

export const FEATURE_FLAGS = {
  // MVP flags
  collectActiveFile: "collect.activeFile",
  collectSelection: "collect.selection",
  collectDiagnostics: "collect.diagnostics",
  collectTerminal: "collect.terminal",
  collectGitDiff: "collect.gitDiff",
  // Post-MVP flags — declared now so config surfaces stay stable, default off.
  astParsing: "engine.astParsing",
  dependencyGraph: "engine.dependencyGraph",
  semanticSearch: "engine.semanticSearch",
  embeddings: "engine.embeddings",
  contextCompression: "engine.compression",
  projectMemory: "engine.projectMemory",
  providerRouting: "providers.routing",
  browserAutomation: "browser.automation",
  tokenEstimation: "engine.tokenEstimation",
  conversationHandoff: "providers.conversationHandoff",
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const DEFAULT_FLAG_VALUES: Record<FeatureFlagName, boolean> = {
  "collect.activeFile": true,
  "collect.selection": true,
  "collect.diagnostics": true,
  "collect.terminal": false, // reads terminal buffer; opt-in for privacy
  "collect.gitDiff": true,
  "engine.astParsing": false,
  "engine.dependencyGraph": false,
  "engine.semanticSearch": false,
  "engine.embeddings": false,
  "engine.compression": false,
  "engine.projectMemory": false,
  "providers.routing": false,
  "browser.automation": false,
  "engine.tokenEstimation": false,
  "providers.conversationHandoff": false,
};

/** Read-only view of flag state; implementations decide the storage. */
export interface FeatureFlagReader {
  isEnabled(flag: FeatureFlagName): boolean;
}

/** In-memory implementation, useful for tests and as a default. */
export class StaticFeatureFlags implements FeatureFlagReader {
  private readonly values: Record<FeatureFlagName, boolean>;

  constructor(overrides: Partial<Record<FeatureFlagName, boolean>> = {}) {
    this.values = { ...DEFAULT_FLAG_VALUES, ...overrides };
  }

  isEnabled(flag: FeatureFlagName): boolean {
    return this.values[flag] ?? false;
  }
}

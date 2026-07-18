/**
 * Browser-extension feature flags that gate future Phase 4+ capabilities.
 * All default to false — architecture is ready; behavior is not enabled yet.
 */

export const BROWSER_FEATURE_FLAGS = {
  browserAutomation: "browserAutomation",
  replyReading: "replyReading",
  conversationSync: "conversationSync",
  automaticFileUpload: "automaticFileUpload",
  semanticSearch: "semanticSearch",
  workflowAutomation: "workflowAutomation",
} as const;

export type BrowserFeatureFlag =
  (typeof BROWSER_FEATURE_FLAGS)[keyof typeof BROWSER_FEATURE_FLAGS];

export type BrowserFeatureFlagState = Record<BrowserFeatureFlag, boolean>;

export const DEFAULT_BROWSER_FLAGS: BrowserFeatureFlagState = {
  browserAutomation: false,
  replyReading: false,
  conversationSync: false,
  automaticFileUpload: false,
  semanticSearch: false,
  workflowAutomation: false,
};

/** Read-only flag surface injected into managers/commands. */
export interface FeatureFlagService {
  isEnabled(flag: BrowserFeatureFlag): boolean;
  getAll(): BrowserFeatureFlagState;
}

export class InMemoryFeatureFlags implements FeatureFlagService {
  private readonly values: BrowserFeatureFlagState;

  constructor(overrides: Partial<BrowserFeatureFlagState> = {}) {
    this.values = { ...DEFAULT_BROWSER_FLAGS, ...overrides };
  }

  isEnabled(flag: BrowserFeatureFlag): boolean {
    return this.values[flag] ?? false;
  }

  getAll(): BrowserFeatureFlagState {
    return { ...this.values };
  }

  set(flag: BrowserFeatureFlag, enabled: boolean): void {
    this.values[flag] = enabled;
  }
}

/** Process-wide defaults for the extension (all future features off). */
export const featureFlags: FeatureFlagService = new InMemoryFeatureFlags();

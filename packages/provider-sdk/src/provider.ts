import type { ContextSnapshot } from "@ai-context-bridge/shared";

/**
 * Describes one AI provider surface (a web chat UI in the MVP; later also
 * APIs). Adapters are pure descriptions plus formatting logic — actual DOM
 * insertion lives in the browser extension, which consumes these adapters.
 */
export interface ProviderAdapter {
  /** Stable identifier, e.g. "claude", "chatgpt". */
  readonly id: string;
  readonly displayName: string;
  /** Returns true if this adapter handles the given page URL. */
  matchesUrl(url: string): boolean;
  /**
   * Render a snapshot into the text this provider should receive.
   * MVP: markdown. Later milestones add token-budgeted compression.
   */
  formatContext(snapshot: ContextSnapshot): string;
  /**
   * CSS selectors for the provider's input element, tried in order.
   * Kept as data (not code) so the browser extension can use them
   * without executing adapter logic in the page context.
   */
  readonly inputSelectors: string[];
}

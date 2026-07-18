import type { ProviderCapabilities } from "../adapters/capabilities";

/** Lightweight provider identity exposed outside adapter internals. */
export interface ProviderInfo {
  id: string;
  displayName: string;
  url: string;
  isChatPage: boolean;
  /** @deprecated Prefer `capabilities.fileUpload`. */
  supportsFileUpload: boolean;
  /** Full capability matrix when available (Phase 3.1+). */
  capabilities?: ProviderCapabilities;
}

export type ProviderId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "deepseek"
  | "kimi"
  | "perplexity"
  | "zai";

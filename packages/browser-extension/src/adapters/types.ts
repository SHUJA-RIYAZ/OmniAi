import type { ProviderCapabilities } from "./capabilities";

/**
 * Provider-specific DOM contract. Adapters contain ONLY DOM logic —
 * no bridge calls, no prompt formatting, no business rules.
 */
export interface AIAdapter {
  id(): string;
  displayName(): string;
  matches(url: string): boolean;
  isChatPage(): boolean;
  getPromptElement(): HTMLElement | null;
  getSendButton(): HTMLElement | null;
  /** Declared feature surface — prefer this over ad-hoc provider checks. */
  capabilities(): ProviderCapabilities;
  /**
   * @deprecated Use `capabilities().fileUpload`.
   * Kept for Phase 3 API compatibility.
   */
  supportsFileUpload(): boolean;
  getUploadButton(): HTMLElement | null;
  insertPrompt(text: string): Promise<void>;
  uploadFiles(files: File[]): Promise<void>;
  send(): Promise<void>;
  readLatestResponse(): Promise<string | null>;
  observeConversation(callback: ConversationObserverCallback): () => void;
  waitUntilReady(timeoutMs?: number): Promise<void>;
}

export type ConversationObserverCallback = (event: ConversationDomEvent) => void;

export interface ConversationDomEvent {
  type: "message_added" | "message_updated" | "ready" | "dom_changed";
  detail?: string;
}

/** Descriptor used by the registry for lazy construction. */
export interface AdapterDescriptor {
  id: string;
  displayName: string;
  /** Hostnames this adapter owns (exact or parent domain). */
  hosts: readonly string[];
  /** Declared capabilities (no DOM required). */
  capabilities: ProviderCapabilities;
  /**
   * @deprecated Use `capabilities.fileUpload`.
   * Mirrored for Phase 3 callers (background URL detection).
   */
  supportsFileUpload: boolean;
  /** Factory — called only when this adapter is selected. */
  create: () => AIAdapter;
}

/** Registry abstraction for DI — managers depend on this, not concrete adapters. */
export interface IAdapterRegistry {
  register(descriptor: AdapterDescriptor): void;
  ids(): string[];
  list(): readonly AdapterDescriptor[];
  getById(id: string): AIAdapter | null;
  describeForUrl(url: string): AdapterDescriptor | null;
  forUrl(url: string): AIAdapter | null;
  isSupportedUrl(url: string): boolean;
  matchPatterns(): string[];
}

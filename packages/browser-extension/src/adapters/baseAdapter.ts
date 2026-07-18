import { ExtensionError } from "../types/errors";
import {
  clickElement,
  hostMatches,
  insertTextIntoElement,
  queryFirst,
  waitForElement,
} from "../utils/dom";
import { rootLogger } from "../utils/logger";
import {
  DEFAULT_CAPABILITIES,
  type ProviderCapabilities,
} from "./capabilities";
import type {
  AIAdapter,
  ConversationDomEvent,
  ConversationObserverCallback,
} from "./types";

export interface BaseAdapterOptions {
  id: string;
  displayName: string;
  hosts: readonly string[];
  promptSelectors: readonly string[];
  sendButtonSelectors: readonly string[];
  uploadButtonSelectors?: readonly string[];
  capabilities?: Partial<ProviderCapabilities>;
  /** @deprecated Prefer `capabilities.fileUpload`. */
  supportsFileUpload?: boolean;
  chatPathPattern?: RegExp;
}

/**
 * Shared DOM scaffolding. Subclasses override selectors / page heuristics only.
 */
export abstract class BaseAdapter implements AIAdapter {
  protected readonly log = rootLogger.child("DOM");
  protected cachedPrompt: HTMLElement | null = null;
  protected cachedSend: HTMLElement | null = null;
  protected cachedUpload: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private readonly listeners = new Set<ConversationObserverCallback>();

  constructor(protected readonly options: BaseAdapterOptions) {}

  id(): string {
    return this.options.id;
  }

  displayName(): string {
    return this.options.displayName;
  }

  matches(url: string): boolean {
    try {
      return hostMatches(new URL(url).hostname, this.options.hosts);
    } catch {
      return false;
    }
  }

  isChatPage(): boolean {
    if (!this.matches(location.href)) return false;
    const pattern = this.options.chatPathPattern;
    if (pattern && !pattern.test(location.pathname + location.search)) {
      return false;
    }
    return this.getPromptElement() != null || document.body != null;
  }

  getPromptElement(): HTMLElement | null {
    if (this.cachedPrompt && document.contains(this.cachedPrompt)) {
      return this.cachedPrompt;
    }
    this.cachedPrompt = queryFirst<HTMLElement>(this.options.promptSelectors);
    return this.cachedPrompt;
  }

  getSendButton(): HTMLElement | null {
    if (this.cachedSend && document.contains(this.cachedSend)) {
      return this.cachedSend;
    }
    this.cachedSend = queryFirst<HTMLElement>(this.options.sendButtonSelectors);
    return this.cachedSend;
  }

  capabilities(): ProviderCapabilities {
    const fromPartial = this.options.capabilities ?? {};
    const fileUpload =
      fromPartial.fileUpload ?? this.options.supportsFileUpload ?? false;
    return {
      ...DEFAULT_CAPABILITIES,
      ...fromPartial,
      fileUpload,
    };
  }

  /** @deprecated Use `capabilities().fileUpload`. */
  supportsFileUpload(): boolean {
    return this.capabilities().fileUpload;
  }

  getUploadButton(): HTMLElement | null {
    const selectors = this.options.uploadButtonSelectors;
    if (!selectors || selectors.length === 0) return null;
    if (this.cachedUpload && document.contains(this.cachedUpload)) {
      return this.cachedUpload;
    }
    this.cachedUpload = queryFirst<HTMLElement>(selectors);
    return this.cachedUpload;
  }

  async insertPrompt(text: string): Promise<void> {
    try {
      await this.waitUntilReady();
    } catch (err) {
      if (err instanceof ExtensionError && err.code === "TIMEOUT") {
        throw new ExtensionError(
          "PROMPT_NOT_FOUND",
          `Could not find the chat input for ${this.displayName()}.`,
          { providerId: this.id() },
        );
      }
      throw err;
    }
    const el = this.getPromptElement();
    if (!el) {
      throw new ExtensionError(
        "PROMPT_NOT_FOUND",
        `Could not find the chat input for ${this.displayName()}.`,
        { providerId: this.id() },
      );
    }
    this.log.debug("Inserting prompt", { providerId: this.id(), length: text.length });
    insertTextIntoElement(el, text);
  }

  async uploadFiles(_files: File[]): Promise<void> {
    if (!this.capabilities().fileUpload) {
      throw new ExtensionError(
        "UPLOAD_UNSUPPORTED",
        `${this.displayName()} does not support file uploads in this phase.`,
        { providerId: this.id() },
      );
    }
    // Phase 4: automate upload. Capability + button discovery only for now.
    throw new ExtensionError(
      "UPLOAD_UNSUPPORTED",
      "Automatic file upload is deferred to Phase 4.",
      { providerId: this.id() },
    );
  }

  async send(): Promise<void> {
    const btn = this.getSendButton();
    if (!clickElement(btn)) {
      throw new ExtensionError(
        "SEND_FAILED",
        `Could not click send for ${this.displayName()}.`,
        { providerId: this.id() },
      );
    }
    this.log.debug("Send clicked", { providerId: this.id() });
  }

  /** Stub — real response reading lands in Phase 4. */
  async readLatestResponse(): Promise<string | null> {
    return null;
  }

  observeConversation(callback: ConversationObserverCallback): () => void {
    this.listeners.add(callback);
    this.ensureObserver();
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.observer?.disconnect();
        this.observer = null;
      }
    };
  }

  async waitUntilReady(timeoutMs = 10_000): Promise<void> {
    try {
      await waitForElement(() => this.getPromptElement(), { timeoutMs });
    } catch {
      throw new ExtensionError(
        "TIMEOUT",
        `${this.displayName()} chat input did not become ready in time.`,
        { providerId: this.id(), timeoutMs },
      );
    }
  }

  /** Invalidate cached nodes when the DOM mutates under us. */
  protected invalidateCache(): void {
    const promptGone = this.cachedPrompt != null && !document.contains(this.cachedPrompt);
    const sendGone = this.cachedSend != null && !document.contains(this.cachedSend);
    if (promptGone || sendGone) {
      this.cachedPrompt = null;
      this.cachedSend = null;
      this.cachedUpload = null;
      this.emit({ type: "dom_changed" });
    }
  }

  protected emit(event: ConversationDomEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Observer callbacks must not break the adapter.
      }
    }
  }

  private ensureObserver(): void {
    if (this.observer || typeof MutationObserver === "undefined") return;
    this.observer = new MutationObserver(() => {
      this.invalidateCache();
      this.emit({ type: "message_updated" });
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

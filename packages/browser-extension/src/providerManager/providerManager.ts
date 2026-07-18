import type { ContextSnapshot } from "@ai-context-bridge/shared";
import type { AIAdapter, IAdapterRegistry } from "../adapters/types";
import type { EventBus } from "../events/interfaces";
import { ExtensionEvents } from "../events/events";
import type { PromptManager } from "../prompt/promptManager";
import type { ResponseObserver } from "../services/responseObserver";
import type { UploadManager } from "../upload/uploadManager";
import { ExtensionError } from "../types/errors";
import type { ProviderInfo } from "../types/provider";
import { rootLogger } from "../utils/logger";
import type { BrowserOrchestrator } from "./browserOrchestrator";

export interface ProviderManagerOptions {
  /** Injected registry abstraction — never a concrete adapter class. */
  registry: IAdapterRegistry;
  promptManager: PromptManager;
  uploadManager: UploadManager;
  responseObserver: ResponseObserver;
  events?: EventBus;
  /** Current page URL supplier (injectable for tests). */
  getUrl?: () => string;
  /** Optional preferred provider id when auto-detect is disabled. */
  getPreferredProviderId?: () => string | null;
  autoDetect?: () => boolean;
  /** When true, sendPrompt also clicks the send button. */
  autoSend?: () => boolean;
}

/**
 * Content-side orchestrator. Selects adapters via the registry and is the
 * only module allowed to call AIAdapter methods.
 */
export class ProviderManager implements BrowserOrchestrator {
  private readonly log = rootLogger.child("Provider");
  private active: AIAdapter | null = null;
  private lastProviderId: string | null = null;

  constructor(private readonly options: ProviderManagerOptions) {}

  detectProvider(): ProviderInfo | null {
    const adapter = this.resolveAdapter();
    if (!adapter) return null;
    return this.toInfo(adapter);
  }

  async sendContext(context: ContextSnapshot): Promise<void> {
    const { prompt } = this.options.promptManager.build(context);
    await this.sendPrompt(prompt);
  }

  async sendPrompt(
    prompt: string,
    options?: { autoSend?: boolean },
  ): Promise<{ providerId: string; sent: boolean }> {
    const adapter = this.requireAdapter();
    const autoSend = options?.autoSend ?? this.options.autoSend?.() ?? false;
    this.log.info("Sending prompt", {
      providerId: adapter.id(),
      length: prompt.length,
      autoSend,
    });
    await adapter.waitUntilReady();
    await adapter.insertPrompt(prompt);
    let sent = false;
    if (autoSend) {
      await adapter.send();
      sent = true;
    }
    return { providerId: adapter.id(), sent };
  }

  async waitUntilReady(): Promise<void> {
    await this.requireAdapter().waitUntilReady();
  }

  async uploadFiles(files: File[]): Promise<void> {
    const adapter = this.requireAdapter();
    await this.options.uploadManager.uploadFiles(adapter, files);
  }

  async readLatestResponse(): Promise<string | null> {
    const adapter = this.requireAdapter();
    return this.options.responseObserver.readLatestResponse(adapter);
  }

  /**
   * Phase 3: ensures the provider is ready for a follow-up turn.
   * Does not read or sync prior replies (Phase 4).
   */
  async continueConversation(): Promise<void> {
    const adapter = this.requireAdapter();
    await adapter.waitUntilReady();
    this.log.debug("Conversation ready to continue", { providerId: adapter.id() });
  }

  /** Whether the active adapter advertises file upload support. */
  supportsUpload(): boolean {
    const adapter = this.resolveAdapter();
    if (!adapter) return false;
    return this.options.uploadManager.getCapability(adapter).supported;
  }

  isReady(): boolean {
    const adapter = this.resolveAdapter();
    return adapter?.getPromptElement() != null;
  }

  private resolveAdapter(): AIAdapter | null {
    const url = (this.options.getUrl ?? (() => location.href))();
    const autoDetect = this.options.autoDetect?.() ?? true;
    const preferred = this.options.getPreferredProviderId?.() ?? null;

    let adapter: AIAdapter | null = null;
    if (!autoDetect && preferred) {
      adapter = this.options.registry.getById(preferred);
      if (adapter && !adapter.matches(url)) {
        this.log.warn("Preferred provider does not match URL", {
          preferred,
          url,
        });
        adapter = null;
      }
    }
    adapter ??= this.options.registry.forUrl(url);

    if (adapter && this.lastProviderId && this.lastProviderId !== adapter.id()) {
      this.log.warn("Provider changed", {
        from: this.lastProviderId,
        to: adapter.id(),
      });
      this.options.events?.emit(ExtensionEvents.PROVIDER_CHANGED, {
        tabId: -1,
        from: this.lastProviderId,
        to: adapter.id(),
      });
    }

    this.active = adapter;
    this.lastProviderId = adapter?.id() ?? this.lastProviderId;
    return adapter;
  }

  private requireAdapter(): AIAdapter {
    const adapter = this.resolveAdapter();
    if (!adapter) {
      throw new ExtensionError(
        "UNSUPPORTED_WEBSITE",
        "This page is not a supported AI chat website.",
        { url: (this.options.getUrl ?? (() => location.href))() },
      );
    }
    return adapter;
  }

  private toInfo(adapter: AIAdapter): ProviderInfo {
    const caps = adapter.capabilities();
    return {
      id: adapter.id(),
      displayName: adapter.displayName(),
      url: (this.options.getUrl ?? (() => location.href))(),
      isChatPage: adapter.isChatPage(),
      supportsFileUpload: caps.fileUpload,
      capabilities: caps,
    };
  }
}

import type { AIAdapter, ConversationObserverCallback } from "../adapters/types";
import { rootLogger } from "../utils/logger";

/**
 * Phase 3: interface + stubs only.
 * Real AI reply observation belongs to Phase 4.
 */
export interface ResponseObserver {
  observeConversation(adapter: AIAdapter, callback: ConversationObserverCallback): () => void;
  readLatestResponse(adapter: AIAdapter): Promise<string | null>;
}

export class StubResponseObserver implements ResponseObserver {
  private readonly log = rootLogger.child("Provider");

  observeConversation(
    adapter: AIAdapter,
    callback: ConversationObserverCallback,
  ): () => void {
    this.log.debug("observeConversation stub attached", { providerId: adapter.id() });
    return adapter.observeConversation(callback);
  }

  async readLatestResponse(adapter: AIAdapter): Promise<string | null> {
    this.log.debug("readLatestResponse stub", { providerId: adapter.id() });
    return adapter.readLatestResponse();
  }
}

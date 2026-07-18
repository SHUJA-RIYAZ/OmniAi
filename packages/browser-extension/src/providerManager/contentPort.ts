import type {
  ContentProviderResult,
  InsertPromptResult,
  MessageResult,
} from "../types/messages";
import { ExtensionError, toErrorCode, toErrorMessage } from "../types/errors";
import { rootLogger } from "../utils/logger";

/**
 * Background-side port to the content-script ProviderManager.
 * Keeps adapter DOM access isolated inside the content script.
 */
export class ContentOrchestratorPort {
  private readonly log = rootLogger.child("Background");

  constructor(
    private readonly sendToTab: (
      tabId: number,
      message: unknown,
    ) => Promise<unknown> = (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  ) {}

  async detectProvider(tabId: number): Promise<ContentProviderResult> {
    return this.request<ContentProviderResult>(tabId, { type: "CONTENT_DETECT_PROVIDER" });
  }

  async waitUntilReady(tabId: number): Promise<void> {
    await this.request<{ ready: boolean }>(tabId, { type: "CONTENT_WAIT_READY" });
  }

  async insertPrompt(
    tabId: number,
    prompt: string,
    autoSend: boolean,
  ): Promise<InsertPromptResult> {
    return this.request<InsertPromptResult>(tabId, {
      type: "CONTENT_INSERT_PROMPT",
      prompt,
      autoSend,
    });
  }

  async readLatestResponse(tabId: number): Promise<string | null> {
    const result = await this.request<{ response: string | null }>(tabId, {
      type: "CONTENT_READ_RESPONSE",
    });
    return result.response;
  }

  async uploadCapability(tabId: number): Promise<{ supported: boolean }> {
    return this.request<{ supported: boolean }>(tabId, {
      type: "CONTENT_UPLOAD_CAPABILITY",
    });
  }

  private async request<T>(tabId: number, message: unknown): Promise<T> {
    this.log.debug("Content port request", {
      tabId,
      type: (message as { type?: string }).type,
    });

    let raw: unknown;
    try {
      raw = await this.sendToTab(tabId, message);
    } catch (err) {
      throw new ExtensionError(
        "DOM_CHANGED",
        `Content script not reachable on this tab (${toErrorMessage(err)}). Reload the AI page and try again.`,
        { tabId },
      );
    }

    const response = raw as MessageResult<T> | undefined;
    if (!response) {
      throw new ExtensionError("DOM_CHANGED", "Empty response from content script.", { tabId });
    }
    if (!response.ok) {
      throw new ExtensionError(
        (response.code as ExtensionError["code"]) ?? toErrorCode(response),
        response.error,
        { tabId },
      );
    }
    return response.data;
  }
}

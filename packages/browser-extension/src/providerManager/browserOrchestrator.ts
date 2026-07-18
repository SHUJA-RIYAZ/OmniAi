import type { ContextSnapshot } from "@ai-context-bridge/shared";
import type { ProviderInfo } from "../types/provider";

/**
 * Single public API for page-level AI orchestration.
 * Callers must never touch adapters directly.
 */
export interface SendPromptResult {
  providerId: string;
  sent: boolean;
}

export interface BrowserOrchestrator {
  sendContext(context: ContextSnapshot): Promise<void>;
  sendPrompt(
    prompt: string,
    options?: { autoSend?: boolean },
  ): Promise<SendPromptResult>;
  uploadFiles(files: File[]): Promise<void>;
  readLatestResponse(): Promise<string | null>;
  continueConversation(): Promise<void>;
  detectProvider(): ProviderInfo | null;
}

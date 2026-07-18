import type { BridgeClient } from "../bridge/bridgeClient";
import type { ConversationManager } from "../conversation/conversationManager";
import type { PromptManager } from "../prompt/promptManager";
import type { ContentOrchestratorPort } from "../providerManager/contentPort";
import type { CopyContextResult, SendContextResult } from "../types/messages";
import type { ExtensionSettings } from "../types/settings";
import { createWorkflowEngine } from "../workflow/createEngine";
import type { WorkflowEngine } from "../workflow/types";

export interface SendContextWorkflowDeps {
  bridge: BridgeClient;
  promptManager: PromptManager;
  contentPort: ContentOrchestratorPort;
  conversations: ConversationManager;
  getSettings: () => ExtensionSettings;
  /** Optional pre-built engine (for tests / custom command sets). */
  engine?: WorkflowEngine;
}

/**
 * Backward-compatible facade over {@link WorkflowEngine}.
 * Prefer `workflow.execute("sendContext")` for new call sites.
 */
export class SendContextWorkflow {
  private readonly engine: WorkflowEngine;

  constructor(private readonly deps: SendContextWorkflowDeps) {
    this.engine =
      deps.engine ??
      createWorkflowEngine({
        get bridge() {
          return deps.bridge;
        },
        promptManager: deps.promptManager,
        contentPort: deps.contentPort,
        conversations: deps.conversations,
        getSettings: deps.getSettings,
      });
  }

  async sendContext(tabId: number, tabUrl: string): Promise<SendContextResult> {
    const ctx = await this.engine.execute("sendContext", { tabId, tabUrl });
    return ctx.result as SendContextResult;
  }

  async copyContext(): Promise<CopyContextResult> {
    const ctx = await this.engine.execute("copyContext");
    return ctx.result as CopyContextResult;
  }
}

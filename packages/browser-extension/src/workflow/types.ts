import type { BridgeClient } from "../bridge/bridgeClient";
import type { ConversationManager } from "../conversation/conversationManager";
import type { EventBus } from "../events/interfaces";
import type { FeatureFlagService } from "../features/featureFlags";
import type { PromptManager } from "../prompt/promptManager";
import type { ContentOrchestratorPort } from "../providerManager/contentPort";
import type { Telemetry } from "../telemetry/telemetry";
import type { ExtensionSettings } from "../types/settings";

/** Mutable execution bag passed into every workflow command. */
export interface WorkflowContext {
  /** Active tab id when the command targets a page. */
  tabId?: number;
  tabUrl?: string;
  /** Command-specific result written by execute(). */
  result?: unknown;
  /** Shared dependencies (injected by the engine / composition root). */
  deps: WorkflowDependencies;
}

export interface WorkflowDependencies {
  bridge: BridgeClient;
  promptManager: PromptManager;
  contentPort: ContentOrchestratorPort;
  conversations: ConversationManager;
  getSettings: () => ExtensionSettings;
  events: EventBus;
  telemetry: Telemetry;
  features: FeatureFlagService;
}

export interface WorkflowCommand {
  readonly id: string;
  execute(context: WorkflowContext): Promise<void>;
}

export interface WorkflowRegistry {
  register(command: WorkflowCommand): void;
  get(id: string): WorkflowCommand | undefined;
  ids(): string[];
}

export interface WorkflowEngine {
  execute(commandId: string, context?: Partial<Omit<WorkflowContext, "deps">>): Promise<WorkflowContext>;
  register(command: WorkflowCommand): void;
}

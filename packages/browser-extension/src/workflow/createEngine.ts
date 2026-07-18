import type { BridgeClient } from "../bridge/bridgeClient";
import type { ConversationManager } from "../conversation/conversationManager";
import type { EventBus } from "../events/interfaces";
import { eventBus as defaultEventBus } from "../events/eventBus";
import type { FeatureFlagService } from "../features/featureFlags";
import { featureFlags as defaultFlags } from "../features/featureFlags";
import type { PromptManager } from "../prompt/promptManager";
import type { ContentOrchestratorPort } from "../providerManager/contentPort";
import type { Telemetry } from "../telemetry/telemetry";
import { telemetry as defaultTelemetry } from "../telemetry/telemetry";
import type { ExtensionSettings } from "../types/settings";
import { CopyContextCommand } from "./commands/copyContext";
import { RefreshContextCommand } from "./commands/refreshContext";
import { SendContextCommand } from "./commands/sendContext";
import type { WorkflowDependencies, WorkflowEngine } from "./types";
import { DefaultWorkflowEngine } from "./workflowEngine";

export interface CreateWorkflowEngineOptions {
  bridge: BridgeClient;
  promptManager: PromptManager;
  contentPort: ContentOrchestratorPort;
  conversations: ConversationManager;
  getSettings: () => ExtensionSettings;
  events?: EventBus;
  telemetry?: Telemetry;
  features?: FeatureFlagService;
}

/** Composition helper: wires built-in commands into a WorkflowEngine. */
export function createWorkflowEngine(
  options: CreateWorkflowEngineOptions,
): WorkflowEngine {
  const deps: WorkflowDependencies = {
    get bridge() {
      return options.bridge;
    },
    promptManager: options.promptManager,
    contentPort: options.contentPort,
    conversations: options.conversations,
    getSettings: options.getSettings,
    events: options.events ?? defaultEventBus,
    telemetry: options.telemetry ?? defaultTelemetry,
    features: options.features ?? defaultFlags,
  };

  const engine = new DefaultWorkflowEngine(deps);
  engine.register(new SendContextCommand());
  engine.register(new CopyContextCommand());
  engine.register(new RefreshContextCommand());
  return engine;
}

import { describe, expect, it, vi } from "vitest";
import type { BridgeClient } from "../bridge/bridgeClient";
import {
  ConversationManager,
  InMemoryConversationStore,
} from "../conversation/conversationManager";
import { InProcessEventBus } from "../events/eventBus";
import { ExtensionEvents } from "../events/events";
import { InMemoryFeatureFlags } from "../features/featureFlags";
import { PromptManager } from "../prompt/promptManager";
import type { ContentOrchestratorPort } from "../providerManager/contentPort";
import { LocalTelemetry } from "../telemetry/telemetry";
import { DEFAULT_SETTINGS } from "../types/settings";
import { createWorkflowEngine } from "./createEngine";
import type { WorkflowCommand, WorkflowContext } from "./types";
import { DefaultWorkflowEngine } from "./workflowEngine";
import { DefaultWorkflowRegistry } from "./workflowRegistry";

describe("WorkflowEngine", () => {
  it("executes registered commands by id", async () => {
    const seen: string[] = [];
    const command: WorkflowCommand = {
      id: "ping",
      async execute(ctx: WorkflowContext) {
        seen.push("ping");
        ctx.result = { ok: true };
      },
    };

    const events = new InProcessEventBus();
    const telemetry = new LocalTelemetry();
    const deps = {
      bridge: {} as BridgeClient,
      promptManager: new PromptManager(),
      contentPort: {} as ContentOrchestratorPort,
      conversations: new ConversationManager(new InMemoryConversationStore()),
      getSettings: () => DEFAULT_SETTINGS,
      events,
      telemetry,
      features: new InMemoryFeatureFlags(),
    };

    const engine = new DefaultWorkflowEngine(deps, new DefaultWorkflowRegistry());
    engine.register(command);

    const started = vi.fn();
    const completed = vi.fn();
    events.on(ExtensionEvents.WORKFLOW_STARTED, started);
    events.on(ExtensionEvents.WORKFLOW_COMPLETED, completed);

    const ctx = await engine.execute("ping");
    expect(seen).toEqual(["ping"]);
    expect(ctx.result).toEqual({ ok: true });
    expect(started).toHaveBeenCalledWith({ commandId: "ping" });
    expect(completed).toHaveBeenCalled();
  });

  it("runs sendContext via createWorkflowEngine", async () => {
    const bridge: BridgeClient = {
      health: async () => ({ status: "healthy", version: "0.1.0" }),
      isHealthy: async () => true,
      getLatestContext: async () => ({
        id: "s1",
        createdAt: "2026-01-01T00:00:00.000Z",
        schemaVersion: 2,
        workspace: {
          name: "demo",
          rootPath: "/demo",
          languages: ["ts"],
          manifests: [],
        },
        diagnostics: [],
      }),
      getSnapshot: async () => {
        throw new Error("unused");
      },
    };

    const contentPort = {
      detectProvider: vi.fn().mockResolvedValue({
        provider: {
          id: "chatgpt",
          displayName: "ChatGPT",
          url: "https://chatgpt.com/",
          isChatPage: true,
          supportsFileUpload: true,
        },
        supportsUpload: true,
        ready: true,
      }),
      waitUntilReady: vi.fn().mockResolvedValue(undefined),
      insertPrompt: vi.fn().mockResolvedValue({
        inserted: true,
        sent: false,
        providerId: "chatgpt",
      }),
      readLatestResponse: vi.fn(),
      uploadCapability: vi.fn(),
    } as unknown as ContentOrchestratorPort;

    const engine = createWorkflowEngine({
      bridge,
      promptManager: new PromptManager((s) => `P:${s.workspace.name}`),
      contentPort,
      conversations: new ConversationManager(new InMemoryConversationStore()),
      getSettings: () => ({ ...DEFAULT_SETTINGS, autoSend: false }),
      events: new InProcessEventBus(),
      telemetry: new LocalTelemetry(),
      features: new InMemoryFeatureFlags(),
    });

    const ctx = await engine.execute("sendContext", {
      tabId: 3,
      tabUrl: "https://chatgpt.com/",
    });

    expect(ctx.result).toMatchObject({
      ok: true,
      providerId: "chatgpt",
      projectName: "demo",
    });
  });

  it("rejects unknown command ids", async () => {
    const engine = createWorkflowEngine({
      bridge: {} as BridgeClient,
      promptManager: new PromptManager(),
      contentPort: {} as ContentOrchestratorPort,
      conversations: new ConversationManager(new InMemoryConversationStore()),
      getSettings: () => DEFAULT_SETTINGS,
    });
    await expect(engine.execute("doesNotExist")).rejects.toThrow(/Unknown workflow/);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { BridgeClient } from "../bridge/bridgeClient";
import {
  ConversationManager,
  InMemoryConversationStore,
} from "../conversation/conversationManager";
import { PromptManager } from "../prompt/promptManager";
import type { ContentOrchestratorPort } from "../providerManager/contentPort";
import { DEFAULT_SETTINGS } from "../types/settings";
import { SendContextWorkflow } from "./sendContextWorkflow";

describe("SendContextWorkflow", () => {
  it("runs Bridge → Prompt → Content insert asynchronously", async () => {
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

    const workflow = new SendContextWorkflow({
      bridge,
      promptManager: new PromptManager((s) => `P:${s.workspace.name}`),
      contentPort,
      conversations: new ConversationManager(new InMemoryConversationStore()),
      getSettings: () => ({ ...DEFAULT_SETTINGS, autoSend: false }),
    });

    const result = await workflow.sendContext(7, "https://chatgpt.com/");
    expect(result).toMatchObject({
      ok: true,
      providerId: "chatgpt",
      projectName: "demo",
      sent: false,
    });
    expect(contentPort.insertPrompt).toHaveBeenCalledWith(7, "P:demo", false);
  });

  it("copyContext returns markdown without touching the tab", async () => {
    const bridge: BridgeClient = {
      health: async () => ({ status: "healthy", version: "0.1.0" }),
      isHealthy: async () => true,
      getLatestContext: async () => ({
        id: "s1",
        createdAt: "2026-01-01T00:00:00.000Z",
        schemaVersion: 2,
        workspace: {
          name: "copy-me",
          rootPath: "/demo",
          languages: [],
          manifests: [],
        },
        diagnostics: [],
      }),
      getSnapshot: async () => {
        throw new Error("unused");
      },
    };

    const workflow = new SendContextWorkflow({
      bridge,
      promptManager: new PromptManager((s) => `COPY:${s.workspace.name}`),
      contentPort: {} as ContentOrchestratorPort,
      conversations: new ConversationManager(new InMemoryConversationStore()),
      getSettings: () => DEFAULT_SETTINGS,
    });

    await expect(workflow.copyContext()).resolves.toEqual({
      ok: true,
      markdown: "COPY:copy-me",
      projectName: "copy-me",
    });
  });
});

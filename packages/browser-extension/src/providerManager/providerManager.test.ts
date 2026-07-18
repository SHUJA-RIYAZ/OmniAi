import type { ContextSnapshot } from "@ai-context-bridge/shared";
import { describe, expect, it, vi } from "vitest";
import { CHAT_UPLOAD_CAPABILITIES } from "../adapters/capabilities";
import { AdapterRegistry } from "../adapters/registry";
import type { AdapterDescriptor, AIAdapter } from "../adapters/types";
import { PromptManager } from "../prompt/promptManager";
import { StubResponseObserver } from "../services/responseObserver";
import { UploadManager } from "../upload/uploadManager";
import { ProviderManager } from "./providerManager";

function makeSnapshot(): ContextSnapshot {
  return {
    id: "snap-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    schemaVersion: 2,
    workspace: {
      name: "ai-context-bridge",
      rootPath: "/repo",
      languages: ["typescript"],
      manifests: ["package.json"],
    },
    diagnostics: [],
  };
}

function createMockAdapter(id: string, host: string): AIAdapter & {
  inserted: string[];
  sent: number;
} {
  const inserted: string[] = [];
  let sent = 0;
  const adapter: AIAdapter & { inserted: string[]; sent: number } = {
    inserted,
    get sent() {
      return sent;
    },
    id: () => id,
    displayName: () => id,
    matches: (url) => url.includes(host),
    isChatPage: () => true,
    getPromptElement: () => ({ tagName: "TEXTAREA" }) as HTMLElement,
    getSendButton: () => ({ click: () => undefined }) as unknown as HTMLElement,
    capabilities: () => CHAT_UPLOAD_CAPABILITIES,
    supportsFileUpload: () => true,
    getUploadButton: () => null,
    insertPrompt: async (text) => {
      inserted.push(text);
    },
    uploadFiles: async () => undefined,
    send: async () => {
      sent += 1;
    },
    readLatestResponse: async () => null,
    observeConversation: () => () => undefined,
    waitUntilReady: async () => undefined,
  };
  return adapter;
}

describe("ProviderManager", () => {
  it("detects provider from URL via registry", () => {
    const adapter = createMockAdapter("chatgpt", "chatgpt.com");
    const registry = new AdapterRegistry([
      {
        id: "chatgpt",
        displayName: "ChatGPT",
        hosts: ["chatgpt.com"],
        capabilities: CHAT_UPLOAD_CAPABILITIES,
        supportsFileUpload: true,
        create: () => adapter,
      },
    ]);
    const manager = new ProviderManager({
      registry,
      promptManager: new PromptManager(),
      uploadManager: new UploadManager(),
      responseObserver: new StubResponseObserver(),
      getUrl: () => "https://chatgpt.com/",
    });

    expect(manager.detectProvider()).toMatchObject({
      id: "chatgpt",
      displayName: "chatgpt",
      supportsFileUpload: true,
      capabilities: CHAT_UPLOAD_CAPABILITIES,
    });
  });

  it("injects formatted context through sendContext", async () => {
    const adapter = createMockAdapter("claude", "claude.ai");
    const descriptor: AdapterDescriptor = {
      id: "claude",
      displayName: "Claude",
      hosts: ["claude.ai"],
      capabilities: CHAT_UPLOAD_CAPABILITIES,
      supportsFileUpload: true,
      create: () => adapter,
    };
    const manager = new ProviderManager({
      registry: new AdapterRegistry([descriptor]),
      promptManager: new PromptManager((s) => `FORMATTED:${s.workspace.name}`),
      uploadManager: new UploadManager(),
      responseObserver: new StubResponseObserver(),
      getUrl: () => "https://claude.ai/new",
    });

    await manager.sendContext(makeSnapshot());
    expect(adapter.inserted).toEqual(["FORMATTED:ai-context-bridge"]);
  });

  it("optionally auto-sends after prompt injection", async () => {
    const adapter = createMockAdapter("gemini", "gemini.google.com");
    const manager = new ProviderManager({
      registry: new AdapterRegistry([
        {
          id: "gemini",
          displayName: "Gemini",
          hosts: ["gemini.google.com"],
          capabilities: CHAT_UPLOAD_CAPABILITIES,
          supportsFileUpload: true,
          create: () => adapter,
        },
      ]),
      promptManager: new PromptManager(),
      uploadManager: new UploadManager(),
      responseObserver: new StubResponseObserver(),
      getUrl: () => "https://gemini.google.com/app",
    });

    const result = await manager.sendPrompt("hello", { autoSend: true });
    expect(result).toEqual({ providerId: "gemini", sent: true });
    expect(adapter.inserted).toEqual(["hello"]);
    expect(adapter.sent).toBe(1);
  });

  it("throws UNSUPPORTED_WEBSITE on unknown pages", async () => {
    const manager = new ProviderManager({
      registry: new AdapterRegistry([]),
      promptManager: new PromptManager(),
      uploadManager: new UploadManager(),
      responseObserver: new StubResponseObserver(),
      getUrl: () => "https://example.com",
    });

    await expect(manager.sendPrompt("x")).rejects.toMatchObject({
      code: "UNSUPPORTED_WEBSITE",
    });
  });

  it("readLatestResponse returns stub null", async () => {
    const adapter = createMockAdapter("kimi", "kimi.com");
    const spy = vi.spyOn(adapter, "readLatestResponse");
    const manager = new ProviderManager({
      registry: new AdapterRegistry([
        {
          id: "kimi",
          displayName: "Kimi",
          hosts: ["kimi.com"],
          capabilities: CHAT_UPLOAD_CAPABILITIES,
          supportsFileUpload: true,
          create: () => adapter,
        },
      ]),
      promptManager: new PromptManager(),
      uploadManager: new UploadManager(),
      responseObserver: new StubResponseObserver(),
      getUrl: () => "https://kimi.com/",
    });

    await expect(manager.readLatestResponse()).resolves.toBeNull();
    expect(spy).toHaveBeenCalled();
  });
});

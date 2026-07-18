import { describe, expect, it } from "vitest";
import { DEFAULT_CAPABILITIES } from "./capabilities";
import { AdapterRegistry, BUILTIN_ADAPTERS } from "./registry";
import type { AdapterDescriptor, AIAdapter } from "./types";

function stubAdapter(id: string, hosts: string[]): AIAdapter {
  return {
    id: () => id,
    displayName: () => id,
    matches: (url) => hosts.some((h) => url.includes(h)),
    isChatPage: () => true,
    getPromptElement: () => null,
    getSendButton: () => null,
    capabilities: () => DEFAULT_CAPABILITIES,
    supportsFileUpload: () => false,
    getUploadButton: () => null,
    insertPrompt: async () => undefined,
    uploadFiles: async () => undefined,
    send: async () => undefined,
    readLatestResponse: async () => null,
    observeConversation: () => () => undefined,
    waitUntilReady: async () => undefined,
  };
}

describe("AdapterRegistry", () => {
  it("registers built-in providers", () => {
    const registry = new AdapterRegistry();
    expect(registry.ids()).toEqual([
      "chatgpt",
      "claude",
      "gemini",
      "deepseek",
      "kimi",
      "perplexity",
      "zai",
    ]);
    expect(BUILTIN_ADAPTERS).toHaveLength(7);
  });

  it("detects provider from URL without constructing when describing", () => {
    const registry = new AdapterRegistry();
    const cases: Array<[string, string]> = [
      ["https://chatgpt.com/", "chatgpt"],
      ["https://chat.openai.com/c/abc", "chatgpt"],
      ["https://claude.ai/chat/xyz", "claude"],
      ["https://gemini.google.com/app", "gemini"],
      ["https://chat.deepseek.com/", "deepseek"],
      ["https://kimi.moonshot.cn/chat", "kimi"],
      ["https://www.perplexity.ai/", "perplexity"],
      ["https://chat.z.ai/", "zai"],
    ];

    for (const [url, id] of cases) {
      const descriptor = registry.describeForUrl(url);
      expect(descriptor?.id, url).toBe(id);
    }
  });

  it("returns null for unsupported websites", () => {
    const registry = new AdapterRegistry();
    expect(registry.describeForUrl("https://example.com")).toBeNull();
    expect(registry.isSupportedUrl("https://github.com")).toBe(false);
  });

  it("lazy-loads adapters only when getById/forUrl is used", () => {
    let created = 0;
    const descriptor: AdapterDescriptor = {
      id: "custom",
      displayName: "Custom",
      hosts: ["custom.ai"],
      capabilities: DEFAULT_CAPABILITIES,
      supportsFileUpload: false,
      create: () => {
        created += 1;
        return stubAdapter("custom", ["custom.ai"]);
      },
    };
    const registry = new AdapterRegistry([descriptor]);
    expect(created).toBe(0);
    expect(registry.describeForUrl("https://custom.ai/chat")).not.toBeNull();
    expect(created).toBe(0);
    const adapter = registry.forUrl("https://custom.ai/chat");
    expect(adapter?.id()).toBe("custom");
    expect(created).toBe(1);
    registry.forUrl("https://custom.ai/other");
    expect(created).toBe(1);
  });

  it("rejects duplicate registration", () => {
    const registry = new AdapterRegistry([]);
    const descriptor: AdapterDescriptor = {
      id: "x",
      displayName: "X",
      hosts: ["x.com"],
      capabilities: DEFAULT_CAPABILITIES,
      supportsFileUpload: false,
      create: () => stubAdapter("x", ["x.com"]),
    };
    registry.register(descriptor);
    expect(() => registry.register(descriptor)).toThrow(/already registered/);
  });
});

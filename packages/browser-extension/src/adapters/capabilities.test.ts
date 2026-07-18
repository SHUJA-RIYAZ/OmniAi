import { describe, expect, it } from "vitest";
import { ChatGptAdapter } from "./chatgptAdapter";
import {
  CHAT_UPLOAD_CAPABILITIES,
  DEFAULT_CAPABILITIES,
  mergeCapabilities,
} from "./capabilities";
import { AdapterRegistry } from "./registry";
import { ZaiAdapter } from "./zaiAdapter";

describe("ProviderCapabilities", () => {
  it("exposes a full capability matrix from every adapter", () => {
    const chatgpt = new ChatGptAdapter();
    const zai = new ZaiAdapter();

    expect(chatgpt.capabilities()).toEqual(CHAT_UPLOAD_CAPABILITIES);
    expect(chatgpt.supportsFileUpload()).toBe(true);
    expect(zai.capabilities().fileUpload).toBe(false);
    expect(zai.supportsFileUpload()).toBe(false);
  });

  it("descriptors carry capabilities without constructing adapters", () => {
    const registry = new AdapterRegistry();
    const chatgpt = registry.describeForUrl("https://chatgpt.com/");
    const zai = registry.describeForUrl("https://chat.z.ai/");

    expect(chatgpt?.capabilities.fileUpload).toBe(true);
    expect(chatgpt?.capabilities.readConversation).toBe(false);
    expect(zai?.capabilities).toEqual(DEFAULT_CAPABILITIES);
  });

  it("mergeCapabilities fills defaults", () => {
    expect(mergeCapabilities({ images: true })).toMatchObject({
      ...DEFAULT_CAPABILITIES,
      images: true,
    });
  });
});

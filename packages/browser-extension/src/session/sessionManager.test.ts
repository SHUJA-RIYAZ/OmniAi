import { describe, expect, it, vi } from "vitest";
import { InProcessEventBus } from "../events/eventBus";
import { ExtensionEvents } from "../events/events";
import { InMemorySessionStore } from "./browserSession";
import { DefaultSessionManager } from "./sessionManager";
import {
  ConversationManager,
  InMemoryConversationStore,
} from "../conversation/conversationManager";

describe("BrowserSession / SessionManager", () => {
  it("upserts sessions keyed by tab", async () => {
    const sessions = new DefaultSessionManager(new InMemorySessionStore());
    const first = await sessions.upsert({
      tabId: 9,
      provider: "claude",
      projectId: "demo",
      snapshotId: "s1",
    });

    expect(first.tabId).toBe(9);
    expect(first.provider).toBe("claude");
    expect(first.conversationId).toBeTruthy();
    expect(first.createdAt).toBeLessThanOrEqual(first.updatedAt);

    const second = await sessions.upsert({
      tabId: 9,
      provider: "chatgpt",
      projectId: "demo",
    });
    expect(second.conversationId).toBe(first.conversationId);
    expect(second.provider).toBe("chatgpt");
  });

  it("emits session.updated", async () => {
    const bus = new InProcessEventBus();
    const handler = vi.fn();
    bus.on(ExtensionEvents.SESSION_UPDATED, handler);

    const sessions = new DefaultSessionManager(new InMemorySessionStore(), bus);
    await sessions.upsert({ tabId: 1, provider: "gemini", projectId: "p" });
    expect(handler).toHaveBeenCalledWith({
      tabId: 1,
      provider: "gemini",
      projectId: "p",
    });
  });

  it("ConversationManager uses sessions internally", async () => {
    const conversations = new ConversationManager(
      new InMemoryConversationStore(),
    );
    const state = await conversations.upsert({
      tabId: 4,
      providerId: "kimi",
      projectName: "bridge",
      snapshotId: "snap",
      status: "ready",
    });

    expect(state.providerId).toBe("kimi");
    expect(state.projectName).toBe("bridge");
    expect(await conversations.getForTab(4)).toMatchObject({
      providerId: "kimi",
      status: "ready",
    });
  });
});

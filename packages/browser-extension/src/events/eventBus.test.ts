import { describe, expect, it, vi } from "vitest";
import { InProcessEventBus } from "./eventBus";
import { ExtensionEvents } from "./events";

describe("EventBus", () => {
  it("delivers payloads to subscribers", () => {
    const bus = new InProcessEventBus();
    const handler = vi.fn();
    bus.on(ExtensionEvents.CONTEXT_SENT, handler);

    bus.emit(ExtensionEvents.CONTEXT_SENT, {
      providerId: "chatgpt",
      projectName: "demo",
      promptLength: 10,
      sent: false,
      tabId: 1,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ providerId: "chatgpt" });
  });

  it("supports once and off", () => {
    const bus = new InProcessEventBus();
    const onceHandler = vi.fn();
    const persistent = vi.fn();

    bus.once(ExtensionEvents.BRIDGE_OFFLINE, onceHandler);
    const unsub = bus.on(ExtensionEvents.BRIDGE_OFFLINE, persistent);

    bus.emit(ExtensionEvents.BRIDGE_OFFLINE, { url: "http://x", error: "down" });
    bus.emit(ExtensionEvents.BRIDGE_OFFLINE, { url: "http://x", error: "down" });

    expect(onceHandler).toHaveBeenCalledOnce();
    expect(persistent).toHaveBeenCalledTimes(2);

    unsub();
    bus.emit(ExtensionEvents.BRIDGE_OFFLINE, { url: "http://x", error: "down" });
    expect(persistent).toHaveBeenCalledTimes(2);
  });

  it("isolates subscriber errors", () => {
    const bus = new InProcessEventBus();
    bus.on(ExtensionEvents.PROVIDER_CHANGED, () => {
      throw new Error("boom");
    });
    const ok = vi.fn();
    bus.on(ExtensionEvents.PROVIDER_CHANGED, ok);

    expect(() =>
      bus.emit(ExtensionEvents.PROVIDER_CHANGED, {
        tabId: 1,
        from: "a",
        to: "b",
      }),
    ).not.toThrow();
    expect(ok).toHaveBeenCalledOnce();
  });
});

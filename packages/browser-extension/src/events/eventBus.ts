import { rootLogger } from "../utils/logger";
import type { ExtensionEventMap, ExtensionEventName } from "./events";
import type { EventBus, EventHandler } from "./interfaces";

/**
 * Lightweight in-process pub/sub. One instance per extension context
 * (background / content / popup).
 */
export class InProcessEventBus implements EventBus {
  private readonly listeners = new Map<string, Set<EventHandler<unknown>>>();
  private readonly log = rootLogger.child("Debug");

  on<K extends ExtensionEventName>(
    event: K,
    handler: EventHandler<ExtensionEventMap[K]>,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  once<K extends ExtensionEventName>(
    event: K,
    handler: EventHandler<ExtensionEventMap[K]>,
  ): () => void {
    const wrap: EventHandler<ExtensionEventMap[K]> = (payload) => {
      this.off(event, wrap);
      handler(payload);
    };
    return this.on(event, wrap);
  }

  off<K extends ExtensionEventName>(
    event: K,
    handler: EventHandler<ExtensionEventMap[K]>,
  ): void {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<K extends ExtensionEventName>(
    event: K,
    payload: ExtensionEventMap[K],
  ): void {
    this.log.debug("event", { event, payload: payload as unknown as Record<string, unknown> });
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch {
        // Subscribers must not break emitters.
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Shared bus for the current JS realm (background, content, or popup). */
export const eventBus: EventBus = new InProcessEventBus();

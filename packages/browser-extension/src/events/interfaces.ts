import type { ExtensionEventMap, ExtensionEventName } from "./events";

export type EventHandler<T> = (payload: T) => void;

export interface EventBus {
  on<K extends ExtensionEventName>(
    event: K,
    handler: EventHandler<ExtensionEventMap[K]>,
  ): () => void;
  once<K extends ExtensionEventName>(
    event: K,
    handler: EventHandler<ExtensionEventMap[K]>,
  ): () => void;
  off<K extends ExtensionEventName>(
    event: K,
    handler: EventHandler<ExtensionEventMap[K]>,
  ): void;
  emit<K extends ExtensionEventName>(
    event: K,
    payload: ExtensionEventMap[K],
  ): void;
  clear(): void;
}

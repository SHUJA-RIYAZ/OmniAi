import type { EventBus } from "../events/interfaces";
import { ExtensionEvents } from "../events/events";
import { createId } from "../utils/id";
import { rootLogger } from "../utils/logger";
import type { BrowserSession, SessionStore } from "./browserSession";
import { ChromeSessionStore } from "./browserSession";

export interface SessionManager {
  getForTab(tabId: number): Promise<BrowserSession | null>;
  upsert(input: {
    tabId: number;
    provider: string;
    projectId?: string;
    snapshotId?: string;
    conversationId?: string;
  }): Promise<BrowserSession>;
  clearTab(tabId: number): Promise<void>;
}

export class DefaultSessionManager implements SessionManager {
  private readonly log = rootLogger.child("Workflow");

  constructor(
    private readonly store: SessionStore = new ChromeSessionStore(),
    private readonly events: EventBus | null = null,
  ) {}

  async getForTab(tabId: number): Promise<BrowserSession | null> {
    const all = await this.store.getAll();
    return all.find((s) => s.tabId === tabId) ?? null;
  }

  async upsert(input: {
    tabId: number;
    provider: string;
    projectId?: string;
    snapshotId?: string;
    conversationId?: string;
  }): Promise<BrowserSession> {
    const all = await this.store.getAll();
    const existing = all.find((s) => s.tabId === input.tabId);
    const now = Date.now();

    const next: BrowserSession = existing
      ? {
          ...existing,
          provider: input.provider,
          projectId: input.projectId ?? existing.projectId,
          updatedAt: now,
        }
      : {
          projectId: input.projectId ?? "unknown",
          provider: input.provider,
          tabId: input.tabId,
          createdAt: now,
          updatedAt: now,
          conversationId: input.conversationId ?? createId("conv"),
        };

    if (input.snapshotId !== undefined) {
      next.snapshotId = input.snapshotId;
    }
    if (input.conversationId !== undefined) {
      next.conversationId = input.conversationId;
    }
    if (!next.conversationId) {
      next.conversationId = createId("conv");
    }

    const filtered = all.filter((s) => s.tabId !== input.tabId);
    filtered.push(next);
    await this.store.saveAll(filtered);

    this.events?.emit(ExtensionEvents.SESSION_UPDATED, {
      tabId: next.tabId,
      provider: next.provider,
      projectId: next.projectId,
    });

    this.log.debug("Session upserted", {
      tabId: next.tabId,
      provider: next.provider,
      projectId: next.projectId,
    });

    return next;
  }

  async clearTab(tabId: number): Promise<void> {
    const all = await this.store.getAll();
    await this.store.saveAll(all.filter((s) => s.tabId !== tabId));
  }
}

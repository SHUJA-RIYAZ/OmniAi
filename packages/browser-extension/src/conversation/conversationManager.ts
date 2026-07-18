import type { SessionManager } from "../session/sessionManager";
import { DefaultSessionManager } from "../session/sessionManager";
import {
  ChromeSessionStore,
  InMemorySessionStore,
} from "../session/browserSession";
import type { ConversationState, ConversationStatus } from "../types/conversation";
import { createId } from "../utils/id";
import { rootLogger } from "../utils/logger";

const STATUS_KEY = "ai_bridge_conversation_status";

interface ConversationMeta {
  tabId: number;
  status: ConversationStatus;
  projectName: string | null;
  lastError?: string;
}

interface MetaStore {
  getAll(): Promise<ConversationMeta[]>;
  saveAll(items: ConversationMeta[]): Promise<void>;
}

class ChromeMetaStore implements MetaStore {
  private memory: ConversationMeta[] = [];

  async getAll(): Promise<ConversationMeta[]> {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return [...this.memory];
    }
    const result = await chrome.storage.local.get(STATUS_KEY);
    const stored = result[STATUS_KEY];
    return Array.isArray(stored) ? (stored as ConversationMeta[]) : [];
  }

  async saveAll(items: ConversationMeta[]): Promise<void> {
    this.memory = [...items];
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    await chrome.storage.local.set({ [STATUS_KEY]: items });
  }
}

class InMemoryMetaStore implements MetaStore {
  private items: ConversationMeta[] = [];

  async getAll(): Promise<ConversationMeta[]> {
    return [...this.items];
  }

  async saveAll(items: ConversationMeta[]): Promise<void> {
    this.items = [...items];
  }
}

/** Legacy store interface retained for existing tests. */
export interface ConversationStore {
  getAll(): Promise<ConversationState[]>;
  saveAll(states: ConversationState[]): Promise<void>;
}

export class ChromeConversationStore implements ConversationStore {
  private memory: ConversationState[] = [];

  async getAll(): Promise<ConversationState[]> {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return [...this.memory];
    }
    const result = await chrome.storage.local.get("ai_bridge_conversations");
    const stored = result.ai_bridge_conversations;
    return Array.isArray(stored) ? (stored as ConversationState[]) : [];
  }

  async saveAll(states: ConversationState[]): Promise<void> {
    this.memory = [...states];
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    await chrome.storage.local.set({ ai_bridge_conversations: states });
  }
}

export class InMemoryConversationStore implements ConversationStore {
  private states: ConversationState[] = [];

  async getAll(): Promise<ConversationState[]> {
    return [...this.states];
  }

  async saveAll(states: ConversationState[]): Promise<void> {
    this.states = [...states];
  }
}

export interface ConversationManagerOptions {
  sessions?: SessionManager;
  meta?: MetaStore;
  legacyStore?: ConversationStore;
}

/**
 * Maintains local conversation sessions keyed by provider + tab.
 * Internally backed by {@link import("../session/browserSession").BrowserSession}.
 */
export class ConversationManager {
  private readonly log = rootLogger.child("Workflow");
  private readonly sessions: SessionManager;
  private readonly meta: MetaStore;
  private readonly legacyStore: ConversationStore | null;

  constructor(
    storeOrOptions: ConversationStore | ConversationManagerOptions = {},
  ) {
    if (isConversationStore(storeOrOptions)) {
      this.legacyStore = storeOrOptions;
      this.sessions = new DefaultSessionManager(new InMemorySessionStore());
      this.meta = new InMemoryMetaStore();
    } else {
      this.legacyStore = storeOrOptions.legacyStore ?? null;
      this.sessions =
        storeOrOptions.sessions ??
        new DefaultSessionManager(new ChromeSessionStore());
      this.meta = storeOrOptions.meta ?? new ChromeMetaStore();
    }
  }

  async getForTab(tabId: number): Promise<ConversationState | null> {
    const session = await this.sessions.getForTab(tabId);
    if (!session) {
      if (this.legacyStore) {
        const all = await this.legacyStore.getAll();
        return all.find((c) => c.tabId === tabId) ?? null;
      }
      return null;
    }
    const meta = (await this.meta.getAll()).find((m) => m.tabId === tabId);
    return sessionToConversation(session, meta);
  }

  async upsert(input: {
    tabId: number;
    providerId: string;
    projectName?: string | null;
    snapshotId?: string | null;
    status?: ConversationStatus;
    lastError?: string;
  }): Promise<ConversationState> {
    const existing = await this.sessions.getForTab(input.tabId);
    const sessionInput: {
      tabId: number;
      provider: string;
      projectId?: string;
      snapshotId?: string;
      conversationId?: string;
    } = {
      tabId: input.tabId,
      provider: input.providerId,
      conversationId: existing?.conversationId ?? createId("conv"),
    };
    if (input.projectName !== undefined && input.projectName !== null) {
      sessionInput.projectId = input.projectName;
    } else if (existing?.projectId) {
      sessionInput.projectId = existing.projectId;
    }
    if (input.snapshotId !== undefined && input.snapshotId !== null) {
      sessionInput.snapshotId = input.snapshotId;
    }

    const session = await this.sessions.upsert(sessionInput);

    const metas = await this.meta.getAll();
    const prevMeta = metas.find((m) => m.tabId === input.tabId);
    const nextMeta: ConversationMeta = {
      tabId: input.tabId,
      status: input.status ?? prevMeta?.status ?? "idle",
      projectName:
        input.projectName !== undefined
          ? input.projectName
          : (prevMeta?.projectName ?? session.projectId),
    };
    if (input.lastError !== undefined) {
      nextMeta.lastError = input.lastError;
    } else if (!(input.status && input.status !== "error") && prevMeta?.lastError) {
      nextMeta.lastError = prevMeta.lastError;
    }

    await this.meta.saveAll([
      ...metas.filter((m) => m.tabId !== input.tabId),
      nextMeta,
    ]);

    const state = sessionToConversation(session, nextMeta);

    if (this.legacyStore) {
      const all = await this.legacyStore.getAll();
      await this.legacyStore.saveAll([
        ...all.filter((c) => c.tabId !== input.tabId),
        state,
      ]);
    }

    this.log.debug("Conversation upserted", {
      id: state.id,
      tabId: state.tabId,
      providerId: state.providerId,
      status: state.status,
    });
    return state;
  }

  async setStatus(
    tabId: number,
    status: ConversationStatus,
    lastError?: string,
  ): Promise<void> {
    const current = await this.getForTab(tabId);
    if (!current) return;
    await this.upsert({
      tabId,
      providerId: current.providerId,
      status,
      ...(lastError !== undefined ? { lastError } : {}),
    });
  }

  async clearTab(tabId: number): Promise<void> {
    await this.sessions.clearTab(tabId);
    const metas = await this.meta.getAll();
    await this.meta.saveAll(metas.filter((m) => m.tabId !== tabId));
    if (this.legacyStore) {
      const all = await this.legacyStore.getAll();
      await this.legacyStore.saveAll(all.filter((c) => c.tabId !== tabId));
    }
  }
}

function sessionToConversation(
  session: {
    projectId: string;
    provider: string;
    tabId: number;
    conversationId?: string;
    snapshotId?: string;
    updatedAt: number;
  },
  meta?: ConversationMeta,
): ConversationState {
  const state: ConversationState = {
    id: session.conversationId ?? createId("conv"),
    providerId: session.provider,
    tabId: session.tabId,
    projectName: meta?.projectName ?? session.projectId,
    snapshotId: session.snapshotId ?? null,
    status: meta?.status ?? "idle",
    updatedAt: new Date(session.updatedAt).toISOString(),
  };
  if (meta?.lastError !== undefined) {
    state.lastError = meta.lastError;
  }
  return state;
}

function isConversationStore(
  value: ConversationStore | ConversationManagerOptions,
): value is ConversationStore {
  return (
    typeof value === "object" &&
    value !== null &&
    "getAll" in value &&
    "saveAll" in value &&
    typeof (value as ConversationStore).getAll === "function"
  );
}

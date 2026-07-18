/** Cross-cutting browser session linking project, provider tab, and conversation. */
export interface BrowserSession {
  projectId: string;
  provider: string;
  tabId: number;
  conversationId?: string;
  snapshotId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionStore {
  getAll(): Promise<BrowserSession[]>;
  saveAll(sessions: BrowserSession[]): Promise<void>;
}

const STORAGE_KEY = "ai_bridge_sessions";

export class ChromeSessionStore implements SessionStore {
  private memory: BrowserSession[] = [];

  async getAll(): Promise<BrowserSession[]> {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return [...this.memory];
    }
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    return Array.isArray(stored) ? (stored as BrowserSession[]) : [];
  }

  async saveAll(sessions: BrowserSession[]): Promise<void> {
    this.memory = [...sessions];
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    await chrome.storage.local.set({ [STORAGE_KEY]: sessions });
  }
}

export class InMemorySessionStore implements SessionStore {
  private sessions: BrowserSession[] = [];

  async getAll(): Promise<BrowserSession[]> {
    return [...this.sessions];
  }

  async saveAll(sessions: BrowserSession[]): Promise<void> {
    this.sessions = [...sessions];
  }
}

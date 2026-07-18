import { DEFAULT_SETTINGS, type ExtensionSettings } from "../types/settings";
import { rootLogger } from "../utils/logger";

const STORAGE_KEY = "ai_bridge_settings";

export interface SettingsStore {
  load(): Promise<Partial<ExtensionSettings>>;
  save(settings: ExtensionSettings): Promise<void>;
}

export class ChromeSettingsStore implements SettingsStore {
  private memory: ExtensionSettings = { ...DEFAULT_SETTINGS };

  async load(): Promise<Partial<ExtensionSettings>> {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return { ...this.memory };
    }
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    return stored && typeof stored === "object"
      ? (stored as Partial<ExtensionSettings>)
      : {};
  }

  async save(settings: ExtensionSettings): Promise<void> {
    this.memory = { ...settings };
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  }
}

export class InMemorySettingsStore implements SettingsStore {
  private settings: ExtensionSettings = { ...DEFAULT_SETTINGS };

  async load(): Promise<Partial<ExtensionSettings>> {
    return { ...this.settings };
  }

  async save(settings: ExtensionSettings): Promise<void> {
    this.settings = { ...settings };
  }
}

export class SettingsService {
  private cached: ExtensionSettings = { ...DEFAULT_SETTINGS };
  private readonly log = rootLogger.child("Background");

  constructor(private readonly store: SettingsStore = new ChromeSettingsStore()) {}

  async init(): Promise<ExtensionSettings> {
    const partial = await this.store.load();
    this.cached = { ...DEFAULT_SETTINGS, ...partial };
    // preferredProvider can be explicitly null
    if ("preferredProvider" in partial) {
      this.cached.preferredProvider = partial.preferredProvider ?? null;
    }
    rootLogger.setDebugMode(this.cached.debugMode);
    this.log.debug("Settings loaded", { bridgeUrl: this.cached.bridgeUrl });
    return this.get();
  }

  get(): ExtensionSettings {
    return { ...this.cached };
  }

  async update(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    this.cached = {
      ...this.cached,
      ...patch,
    };
    if ("preferredProvider" in patch) {
      this.cached.preferredProvider = patch.preferredProvider ?? null;
    }
    await this.store.save(this.cached);
    rootLogger.setDebugMode(this.cached.debugMode);
    this.log.info("Settings updated", { keys: Object.keys(patch) });
    return this.get();
  }
}

/** User-configurable extension settings (chrome.storage.local). */
export interface ExtensionSettings {
  /** Automatically select adapter from the active tab URL. */
  autoDetectProvider: boolean;
  /** Preferred provider id when auto-detect is off (e.g. "chatgpt"). */
  preferredProvider: string | null;
  /** Local FastAPI bridge base URL. */
  bridgeUrl: string;
  /** After inserting context, also click the provider send button. */
  autoSend: boolean;
  /** Emit debug-scoped structured logs. */
  debugMode: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoDetectProvider: true,
  preferredProvider: null,
  bridgeUrl: "http://127.0.0.1:8765",
  autoSend: false,
  debugMode: false,
};

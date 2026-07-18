import type { ContextSnapshot } from "@ai-context-bridge/shared";
import type { ConversationState } from "./conversation";
import type { ExtensionSettings } from "./settings";
import type { ProviderInfo } from "./provider";

/** Messages exchanged between popup, background, and content script. */
export type ExtensionMessage =
  | { type: "GET_STATUS" }
  | { type: "GET_SETTINGS" }
  | { type: "UPDATE_SETTINGS"; settings: Partial<ExtensionSettings> }
  | { type: "SEND_CONTEXT"; autoSend?: boolean }
  | { type: "COPY_CONTEXT" }
  | { type: "REFRESH_STATUS" }
  | { type: "DETECT_PROVIDER" }
  | { type: "CONTENT_INSERT_PROMPT"; prompt: string; autoSend: boolean }
  | { type: "CONTENT_READ_RESPONSE" }
  | { type: "CONTENT_DETECT_PROVIDER" }
  | { type: "CONTENT_WAIT_READY" }
  | { type: "CONTENT_UPLOAD_CAPABILITY" }
  | { type: "TAB_PROVIDER_CHANGED"; tabId: number; provider: ProviderInfo | null };

export interface BridgeStatus {
  online: boolean;
  version?: string;
  error?: string;
}

export interface ExtensionStatus {
  bridge: BridgeStatus;
  provider: ProviderInfo | null;
  projectName: string | null;
  snapshotId: string | null;
  conversation: ConversationState | null;
  settings: ExtensionSettings;
  tabUrl: string | null;
}

export interface SendContextResult {
  ok: true;
  providerId: string;
  projectName: string;
  promptLength: number;
  sent: boolean;
}

export interface CopyContextResult {
  ok: true;
  markdown: string;
  projectName: string;
}

export type MessageResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export interface InsertPromptResult {
  inserted: boolean;
  sent: boolean;
  providerId: string;
}

export interface ContentProviderResult {
  provider: ProviderInfo | null;
  supportsUpload: boolean;
  ready: boolean;
}

/** Snapshot payload returned by bridge fetch helpers (internal). */
export type LatestSnapshot = ContextSnapshot;

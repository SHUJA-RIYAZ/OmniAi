/** Canonical event names for cross-module pub/sub. */
export const ExtensionEvents = {
  CONTEXT_SENT: "context.sent",
  CONTEXT_COPIED: "context.copied",
  CONTEXT_REFRESHED: "context.refreshed",
  PROVIDER_CHANGED: "provider.changed",
  PROVIDER_DETECTED: "provider.detected",
  BRIDGE_OFFLINE: "bridge.offline",
  BRIDGE_ONLINE: "bridge.online",
  SESSION_UPDATED: "session.updated",
  WORKFLOW_STARTED: "workflow.started",
  WORKFLOW_COMPLETED: "workflow.completed",
  WORKFLOW_FAILED: "workflow.failed",
} as const;

export type ExtensionEventName =
  (typeof ExtensionEvents)[keyof typeof ExtensionEvents];

export interface ContextSentPayload {
  providerId: string;
  projectName: string;
  promptLength: number;
  sent: boolean;
  tabId: number;
}

export interface ContextCopiedPayload {
  projectName: string;
  promptLength: number;
}

export interface ProviderChangedPayload {
  tabId: number;
  from: string | null;
  to: string | null;
}

export interface BridgeStatusPayload {
  url: string;
  error?: string;
  version?: string;
}

export interface WorkflowLifecyclePayload {
  commandId: string;
  tabId?: number;
  error?: string;
}

export interface SessionUpdatedPayload {
  tabId: number;
  provider: string;
  projectId: string;
}

export interface ExtensionEventMap {
  "context.sent": ContextSentPayload;
  "context.copied": ContextCopiedPayload;
  "context.refreshed": { projectName: string | null; snapshotId: string | null };
  "provider.changed": ProviderChangedPayload;
  "provider.detected": { tabId: number; providerId: string };
  "bridge.offline": BridgeStatusPayload;
  "bridge.online": BridgeStatusPayload;
  "session.updated": SessionUpdatedPayload;
  "workflow.started": WorkflowLifecyclePayload;
  "workflow.completed": WorkflowLifecyclePayload;
  "workflow.failed": WorkflowLifecyclePayload;
}

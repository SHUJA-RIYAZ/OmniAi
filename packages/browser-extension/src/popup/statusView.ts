import type { ExtensionStatus } from "../types/messages";

export interface StatusLabels {
  bridge: { text: string; kind: "ok" | "err" };
  provider: { text: string; kind: "ok" | "warn" };
  project: { text: string; kind: "ok" | "muted" };
  connection: { text: string; kind: "ok" | "warn" };
  currentAi: { text: string; kind: "ok" | "muted" };
  sendEnabled: boolean;
}

/** Pure view-model for the popup status grid (unit-testable). */
export function deriveStatusLabels(status: ExtensionStatus): StatusLabels {
  const bridge = status.bridge.online
    ? {
        text: status.bridge.version
          ? `Online (v${status.bridge.version})`
          : "Online",
        kind: "ok" as const,
      }
    : { text: "Offline", kind: "err" as const };

  const provider = status.provider
    ? { text: status.provider.displayName, kind: "ok" as const }
    : { text: "Unsupported page", kind: "warn" as const };

  const project = status.projectName
    ? { text: status.projectName, kind: "ok" as const }
    : { text: "No snapshot", kind: "muted" as const };

  const connected = status.bridge.online && status.provider != null;
  const connection = connected
    ? { text: "Ready", kind: "ok" as const }
    : { text: "Not ready", kind: "warn" as const };

  const currentAi = status.provider
    ? { text: status.provider.displayName, kind: "ok" as const }
    : { text: "—", kind: "muted" as const };

  return {
    bridge,
    provider,
    project,
    connection,
    currentAi,
    sendEnabled: status.provider != null,
  };
}

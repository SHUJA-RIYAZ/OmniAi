import { ExtensionEvents } from "../../events/events";
import type { WorkflowCommand, WorkflowContext } from "../types";

export interface RefreshContextResult {
  ok: true;
  projectName: string | null;
  snapshotId: string | null;
  bridgeOnline: boolean;
}

export class RefreshContextCommand implements WorkflowCommand {
  readonly id = "refreshContext";

  async execute(context: WorkflowContext): Promise<void> {
    const { deps } = context;
    let projectName: string | null = null;
    let snapshotId: string | null = null;
    let bridgeOnline = false;

    try {
      const health = await deps.bridge.health();
      bridgeOnline = true;
      deps.events.emit(ExtensionEvents.BRIDGE_ONLINE, {
        url: deps.getSettings().bridgeUrl,
        version: health.version,
      });
      deps.telemetry.trackBridge("online", { version: health.version });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      deps.events.emit(ExtensionEvents.BRIDGE_OFFLINE, {
        url: deps.getSettings().bridgeUrl,
        error: message,
      });
      deps.telemetry.trackBridge("offline", { error: message });
    }

    if (bridgeOnline) {
      try {
        const snapshot = await deps.bridge.getLatestContext();
        projectName = snapshot.workspace.name;
        snapshotId = snapshot.id;
      } catch {
        // No snapshot yet is fine for refresh.
      }
    }

    const result: RefreshContextResult = {
      ok: true,
      projectName,
      snapshotId,
      bridgeOnline,
    };
    context.result = result;

    deps.events.emit(ExtensionEvents.CONTEXT_REFRESHED, {
      projectName,
      snapshotId,
    });
  }
}

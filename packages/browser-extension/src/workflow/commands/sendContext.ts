import { ExtensionEvents } from "../../events/events";
import { ExtensionError } from "../../types/errors";
import type { SendContextResult } from "../../types/messages";
import type { WorkflowCommand, WorkflowContext } from "../types";

export class SendContextCommand implements WorkflowCommand {
  readonly id = "sendContext";

  async execute(context: WorkflowContext): Promise<void> {
    const { deps, tabId, tabUrl } = context;
    if (tabId == null || !tabUrl) {
      throw new ExtensionError("UNSUPPORTED_WEBSITE", "No active tab.");
    }

    const settings = deps.getSettings();
    const detection = await deps.contentPort.detectProvider(tabId);
    if (!detection.provider) {
      throw new ExtensionError(
        "UNSUPPORTED_WEBSITE",
        "This page is not a supported AI chat website.",
        { tabUrl },
      );
    }

    deps.telemetry.trackProvider(detection.provider.id, { action: "sendContext" });
    deps.events.emit(ExtensionEvents.PROVIDER_DETECTED, {
      tabId,
      providerId: detection.provider.id,
    });

    await deps.conversations.upsert({
      tabId,
      providerId: detection.provider.id,
      status: "sending",
    });

    try {
      const snapshot = await deps.bridge.getLatestContext();
      const built = deps.promptManager.build(snapshot, "sendContext");

      await deps.contentPort.waitUntilReady(tabId);
      const insert = await deps.contentPort.insertPrompt(
        tabId,
        built.prompt,
        settings.autoSend,
      );

      await deps.conversations.upsert({
        tabId,
        providerId: detection.provider.id,
        projectName: built.projectName,
        snapshotId: built.snapshotId,
        status: insert.sent ? "waiting" : "ready",
      });

      const result: SendContextResult = {
        ok: true,
        providerId: detection.provider.id,
        projectName: built.projectName,
        promptLength: built.prompt.length,
        sent: insert.sent,
      };
      context.result = result;

      deps.events.emit(ExtensionEvents.CONTEXT_SENT, {
        providerId: result.providerId,
        projectName: result.projectName,
        promptLength: result.promptLength,
        sent: result.sent,
        tabId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deps.conversations.upsert({
        tabId,
        providerId: detection.provider.id,
        status: "error",
        lastError: message,
      });
      throw err;
    }
  }
}

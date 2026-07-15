import * as vscode from "vscode";
import { ContextAssembler } from "@ai-context-bridge/context-engine";
import { HttpBridgeClient } from "./bridgeClient";
import { VsCodeFeatureFlags } from "./featureFlags";
import { collectWorkspaceMetadata } from "./workspaceMetadata";
import { ActiveFileCollector } from "./collectors/activeFileCollector";
import { SelectionCollector } from "./collectors/selectionCollector";
import { DiagnosticsCollector } from "./collectors/diagnosticsCollector";
import { GitDiffCollector } from "./collectors/gitDiffCollector";
import { TerminalCollector } from "./collectors/terminalCollector";

function bridgeUrl(): string {
  return vscode.workspace
    .getConfiguration("aiContextBridge")
    .get<string>("bridgeUrl", "http://127.0.0.1:8765");
}

export function activate(context: vscode.ExtensionContext): void {
  const terminalCollector = new TerminalCollector();
  context.subscriptions.push(terminalCollector);

  const assembler = new ContextAssembler(
    [
      new ActiveFileCollector(),
      new SelectionCollector(),
      new DiagnosticsCollector(),
      new GitDiffCollector(),
      terminalCollector,
    ],
    new VsCodeFeatureFlags(),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aiContextBridge.sendContext", async () => {
      const client = new HttpBridgeClient(bridgeUrl());

      if (!(await client.isHealthy())) {
        void vscode.window.showErrorMessage(
          `AI Context Bridge: local bridge is not reachable at ${bridgeUrl()}. ` +
            "Start it with: uvicorn bridge.main:app --port 8765",
        );
        return;
      }

      const { snapshot, results } = await assembler.assemble(await collectWorkspaceMetadata());
      const failures = results.filter((r) => r.status === "failed");

      try {
        await client.pushSnapshot(snapshot);
      } catch (err) {
        void vscode.window.showErrorMessage(
          `AI Context Bridge: failed to send context — ${err instanceof Error ? err.message : err}`,
        );
        return;
      }

      const suffix =
        failures.length > 0
          ? ` (${failures.map((f) => f.collectorId).join(", ")} unavailable)`
          : "";
      void vscode.window.setStatusBarMessage(
        `$(check) Context sent to bridge${suffix}`,
        4_000,
      );
    }),

    vscode.commands.registerCommand("aiContextBridge.previewContext", async () => {
      const { snapshot } = await assembler.assemble(await collectWorkspaceMetadata());
      const doc = await vscode.workspace.openTextDocument({
        language: "json",
        content: JSON.stringify(snapshot, null, 2),
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    }),
  );
}

export function deactivate(): void {
  // Disposables are handled via context.subscriptions.
}

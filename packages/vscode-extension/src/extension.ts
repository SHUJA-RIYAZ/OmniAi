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
import { IntelligenceService } from "./intelligence/intelligenceService";
import { StatusPanel } from "./status/statusPanel";
import { buildStatusReport } from "./status/statusReport";
import { ContextInspectorPanel } from "./inspector/contextInspectorPanel";
import type { InspectorData } from "./inspector/inspectorView";
import { readSelectionOptions, SelectionServiceFactory } from "./selection/selectionWiring";

function bridgeUrl(): string {
  return vscode.workspace
    .getConfiguration("aiContextBridge")
    .get<string>("bridgeUrl", "http://127.0.0.1:8765");
}

export function activate(context: vscode.ExtensionContext): void {
  const terminalCollector = new TerminalCollector();
  const statusPanel = new StatusPanel();
  context.subscriptions.push(terminalCollector, statusPanel);

  const flags = new VsCodeFeatureFlags();
  const assembler = new ContextAssembler(
    [
      new ActiveFileCollector(),
      new SelectionCollector(),
      new DiagnosticsCollector(),
      new GitDiffCollector(),
      terminalCollector,
    ],
    flags,
  );
  const intelligence = new IntelligenceService(flags, bridgeUrl);

  /** Collect base context, enrich with intelligence, report status. */
  async function collect() {
    const outcome = await assembler.assemble(await collectWorkspaceMetadata());
    try {
      await intelligence.enrich(outcome.snapshot);
    } catch {
      // Intelligence is enrichment; the base snapshot always survives.
    }
    statusPanel.update(buildStatusReport(outcome.snapshot, outcome.results));
    return outcome;
  }

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

      const { snapshot, results } = await collect();
      const failures = results.filter((r) => r.status === "failed");

      try {
        await client.pushSnapshot(snapshot);
      } catch (err) {
        void vscode.window.showErrorMessage(
          `AI Context Bridge: failed to send context — ${err instanceof Error ? err.message : err}`,
        );
        return;
      }

      const tokens = snapshot.intelligence?.tokenEstimate;
      const tokenSuffix = tokens ? ` · ~${tokens.estimatedTokens.toLocaleString()} tokens` : "";
      const failureSuffix =
        failures.length > 0
          ? ` (${failures.map((f) => f.collectorId).join(", ")} unavailable)`
          : "";
      void vscode.window.setStatusBarMessage(
        `$(check) Context sent to bridge${tokenSuffix}${failureSuffix}`,
        4_000,
      );
    }),

    vscode.commands.registerCommand("aiContextBridge.previewContext", async () => {
      const { snapshot } = await collect();
      const doc = await vscode.workspace.openTextDocument({
        language: "json",
        content: JSON.stringify(snapshot, null, 2),
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    }),

    vscode.commands.registerCommand("aiContextBridge.showStatus", () => {
      statusPanel.show();
    }),

    vscode.commands.registerCommand("aiContextBridge.openContextInspector", async () => {
      if (!flags.isEnabled("engine.compression")) {
        void vscode.window.showInformationMessage(
          "AI Context Bridge: enable the aiContextBridge.flags.contextSelection setting to use the Context Inspector.",
        );
        return;
      }
      try {
        await inspector.show(await buildInspectorData());
      } catch (err) {
        void vscode.window.showErrorMessage(
          `AI Context Bridge: could not build context — ${err instanceof Error ? err.message : err}`,
        );
      }
    }),
  );

  const selectionFactory = new SelectionServiceFactory(bridgeUrl);

  async function buildInspectorData(): Promise<InspectorData> {
    const service = selectionFactory.create();
    if (!service) throw new Error("Open a workspace folder first.");

    const { snapshot } = await collect();
    const { selection, prompt } = await service.select({ snapshot }, readSelectionOptions());
    const collectionTimeMs = snapshot.intelligence?.collectionTimeMs;
    return {
      selection,
      prompt,
      ...(collectionTimeMs !== undefined ? { collectionTimeMs } : {}),
    };
  }

  const inspector = new ContextInspectorPanel({ refresh: buildInspectorData });
  context.subscriptions.push(inspector);
}

export function deactivate(): void {
  // Disposables are handled via context.subscriptions.
}

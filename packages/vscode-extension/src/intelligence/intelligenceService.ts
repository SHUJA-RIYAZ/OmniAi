import * as vscode from "vscode";
import {
  BridgeAnalyzerClient,
  HeuristicTokenEstimator,
  IntelligenceContextBuilder,
  ManifestWorkspaceSummarizer,
  PythonModuleResolver,
} from "@ai-context-bridge/context-engine";
import type { ContextSnapshot, FeatureFlagReader } from "@ai-context-bridge/shared";
import { VsCodeFileSystem } from "./vsCodeFileSystem";

/**
 * Composition root for Phase 2 intelligence inside VS Code: builds the
 * dependency graph of collaborators from configuration and enriches
 * snapshots in place. Contains wiring only — all logic lives in
 * `@ai-context-bridge/context-engine`.
 */
export class IntelligenceService {
  constructor(
    private readonly flags: FeatureFlagReader,
    private readonly bridgeUrl: () => string,
  ) {}

  /**
   * Attaches an `intelligence` section to the snapshot. Returns quietly
   * when there is no workspace or no active editor — the base snapshot
   * is always preserved.
   */
  async enrich(snapshot: ContextSnapshot): Promise<void> {
    const fs = VsCodeFileSystem.forActiveWorkspace();
    const editor = vscode.window.activeTextEditor;
    if (!fs || !editor || editor.document.uri.scheme !== "file") return;

    const config = vscode.workspace.getConfiguration("aiContextBridge.intelligence");
    const builder = new IntelligenceContextBuilder(
      {
        analyzer: new BridgeAnalyzerClient(this.bridgeUrl()),
        resolver: new PythonModuleResolver(fs),
        fs,
        summarizer: new ManifestWorkspaceSummarizer(fs),
        estimator: new HeuristicTokenEstimator(),
        flags: this.flags,
      },
      {
        maxDepth: config.get<number>("maxDepth", 2),
        maxRelatedFiles: config.get<number>("maxRelatedFiles", 5),
      },
    );

    snapshot.intelligence = await builder.build({
      filePath: vscode.workspace.asRelativePath(editor.document.uri).replace(/\\/g, "/"),
      languageId: editor.document.languageId,
      source: editor.document.getText(),
      cursorLine: editor.selection.active.line + 1,
      workspaceLanguages: snapshot.workspace.languages,
      estimateTarget: JSON.stringify(snapshot),
    });
  }
}

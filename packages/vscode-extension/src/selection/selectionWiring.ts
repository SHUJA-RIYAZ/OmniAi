import * as vscode from "vscode";
import {
  BridgeAnalyzerClient,
  CachedAnalyzer,
  ContextSelectionService,
  HeuristicTokenEstimator,
  InMemoryAnalysisCache,
  type SelectionOptions,
} from "@ai-context-bridge/context-engine";
import { VsCodeFileSystem } from "../intelligence/vsCodeFileSystem";

/** Maps `aiContextBridge.selection.*` settings to engine options (Feature 12). */
export function readSelectionOptions(): Partial<SelectionOptions> {
  const config = vscode.workspace.getConfiguration("aiContextBridge.selection");
  return {
    maxTokens: config.get<number>("maxTokens", 8_000),
    strategy: config.get<string>("strategy", "hybrid"),
    compressionLevel: config.get<SelectionOptions["compressionLevel"]>(
      "compressionLevel",
      "light",
    ),
    removeComments: config.get<boolean>("removeComments", true),
    compressWhitespace: config.get<boolean>("compressWhitespace", true),
    maxFiles: config.get<number>("maxFiles", 12),
  };
}

/**
 * Composition root for selection inside VS Code. Shares one analysis cache
 * across invocations so inspector refreshes reuse parses from context
 * collection.
 */
export class SelectionServiceFactory {
  private readonly cache = new InMemoryAnalysisCache();

  constructor(private readonly bridgeUrl: () => string) {}

  create(): ContextSelectionService | undefined {
    const fs = VsCodeFileSystem.forActiveWorkspace();
    if (!fs) return undefined;
    return new ContextSelectionService({
      fs,
      estimator: new HeuristicTokenEstimator(),
      analyzer: new CachedAnalyzer(new BridgeAnalyzerClient(this.bridgeUrl()), this.cache),
    });
  }
}

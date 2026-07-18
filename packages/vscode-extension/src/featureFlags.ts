import * as vscode from "vscode";
import {
  DEFAULT_FLAG_VALUES,
  type FeatureFlagName,
  type FeatureFlagReader,
} from "@ai-context-bridge/shared";

/** Maps canonical flag names to VS Code settings keys under `aiContextBridge.flags.*`. */
const SETTING_KEYS: Partial<Record<FeatureFlagName, string>> = {
  "collect.activeFile": "collectActiveFile",
  "collect.selection": "collectSelection",
  "collect.diagnostics": "collectDiagnostics",
  "collect.terminal": "collectTerminal",
  "collect.gitDiff": "collectGitDiff",
  "engine.astParsing": "astParsing",
  "engine.dependencyGraph": "dependencyGraph",
  "engine.tokenEstimation": "tokenEstimation",
  "engine.compression": "contextSelection",
};

/** Reads flags from workspace configuration; unexposed flags use library defaults. */
export class VsCodeFeatureFlags implements FeatureFlagReader {
  isEnabled(flag: FeatureFlagName): boolean {
    const key = SETTING_KEYS[flag];
    if (!key) return DEFAULT_FLAG_VALUES[flag];
    return vscode.workspace
      .getConfiguration("aiContextBridge.flags")
      .get<boolean>(key, DEFAULT_FLAG_VALUES[flag]);
  }
}

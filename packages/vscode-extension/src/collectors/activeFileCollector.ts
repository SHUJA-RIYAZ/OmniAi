import * as vscode from "vscode";
import type { ContextCollector } from "@ai-context-bridge/context-engine";
import { LIMITS, type ContextSnapshot } from "@ai-context-bridge/shared";

export class ActiveFileCollector implements ContextCollector {
  readonly id = "activeFile";
  readonly flag = "collect.activeFile" as const;

  async collect(): Promise<Partial<ContextSnapshot>> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== "file") return {};

    const doc = editor.document;
    const full = doc.getText();
    const truncated = full.length > LIMITS.activeFileMaxChars;

    return {
      activeFile: {
        filePath: vscode.workspace.asRelativePath(doc.uri),
        languageId: doc.languageId,
        content: truncated ? full.slice(0, LIMITS.activeFileMaxChars) : full,
        truncated,
        lineCount: doc.lineCount,
      },
    };
  }
}

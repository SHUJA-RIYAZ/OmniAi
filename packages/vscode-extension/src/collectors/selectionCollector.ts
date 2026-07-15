import * as vscode from "vscode";
import type { ContextCollector } from "@ai-context-bridge/context-engine";
import type { ContextSnapshot } from "@ai-context-bridge/shared";

export class SelectionCollector implements ContextCollector {
  readonly id = "selection";
  readonly flag = "collect.selection" as const;

  async collect(): Promise<Partial<ContextSnapshot>> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) return {};

    const sel = editor.selection;
    return {
      selection: {
        filePath: vscode.workspace.asRelativePath(editor.document.uri),
        startLine: sel.start.line + 1,
        endLine: sel.end.line + 1,
        text: editor.document.getText(sel),
      },
    };
  }
}

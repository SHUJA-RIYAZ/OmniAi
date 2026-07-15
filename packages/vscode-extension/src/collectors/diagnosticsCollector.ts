import * as vscode from "vscode";
import type { ContextCollector } from "@ai-context-bridge/context-engine";
import {
  LIMITS,
  type ContextSnapshot,
  type DiagnosticItem,
  type DiagnosticSeverity,
} from "@ai-context-bridge/shared";

const SEVERITY_MAP: Record<vscode.DiagnosticSeverity, DiagnosticSeverity> = {
  [vscode.DiagnosticSeverity.Error]: "error",
  [vscode.DiagnosticSeverity.Warning]: "warning",
  [vscode.DiagnosticSeverity.Information]: "information",
  [vscode.DiagnosticSeverity.Hint]: "hint",
};

export class DiagnosticsCollector implements ContextCollector {
  readonly id = "diagnostics";
  readonly flag = "collect.diagnostics" as const;

  async collect(): Promise<Partial<ContextSnapshot>> {
    const items: DiagnosticItem[] = [];

    for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
      if (uri.scheme !== "file") continue;
      for (const d of diagnostics) {
        items.push({
          filePath: vscode.workspace.asRelativePath(uri),
          line: d.range.start.line + 1,
          column: d.range.start.character + 1,
          severity: SEVERITY_MAP[d.severity],
          message: d.message,
          ...(d.source !== undefined ? { source: d.source } : {}),
          ...(d.code !== undefined
            ? { code: typeof d.code === "object" ? String(d.code.value) : String(d.code) }
            : {}),
        });
      }
    }

    // Errors first, then warnings, so truncation drops the least useful items.
    const order: DiagnosticSeverity[] = ["error", "warning", "information", "hint"];
    items.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

    return { diagnostics: items.slice(0, LIMITS.maxDiagnostics) };
  }
}

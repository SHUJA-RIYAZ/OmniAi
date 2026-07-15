import * as vscode from "vscode";
import type { ContextCollector } from "@ai-context-bridge/context-engine";
import { LIMITS, type ContextSnapshot } from "@ai-context-bridge/shared";

/**
 * Captures recent terminal output. VS Code's stable API does not expose the
 * terminal buffer directly, so we accumulate output via the
 * `onDidWriteTerminalData` shell-integration events registered at activation.
 * Off by default (terminal buffers may contain secrets).
 */
export class TerminalCollector implements ContextCollector, vscode.Disposable {
  readonly id = "terminal";
  readonly flag = "collect.terminal" as const;

  private readonly buffers = new Map<vscode.Terminal, string[]>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.window.onDidCloseTerminal((t) => this.buffers.delete(t)),
      vscode.window.onDidEndTerminalShellExecution(async (event) => {
        try {
          const lines: string[] = [];
          for await (const chunk of event.execution.read()) {
            lines.push(...chunk.split(/\r?\n/));
          }
          const buf = this.buffers.get(event.terminal) ?? [];
          buf.push(...lines);
          this.buffers.set(event.terminal, buf.slice(-LIMITS.terminalMaxLines));
        } catch {
          // Shell integration may be unavailable; degrade silently.
        }
      }),
    );
  }

  async collect(): Promise<Partial<ContextSnapshot>> {
    const terminal = vscode.window.activeTerminal;
    if (!terminal) return {};
    const lines = this.buffers.get(terminal);
    if (!lines || lines.length === 0) return {};
    return { terminal: { name: terminal.name, lines } };
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

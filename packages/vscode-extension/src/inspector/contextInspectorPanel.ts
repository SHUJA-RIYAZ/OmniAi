import * as vscode from "vscode";
import { renderInspectorHtml, type InspectorData } from "./inspectorView";

export interface InspectorCallbacks {
  /** Rebuild the selection; the panel re-renders with the result. */
  refresh(): Promise<InspectorData>;
}

/**
 * Webview host for the Context Inspector. Holds no business logic:
 * rendering is `renderInspectorHtml`, data production is the injected
 * `refresh` callback, copy/export act on the last received data.
 */
export class ContextInspectorPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private lastData: InspectorData | undefined;

  constructor(private readonly callbacks: InspectorCallbacks) {}

  async show(data?: InspectorData): Promise<void> {
    if (data) this.lastData = data;
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "aiContextBridge.inspector",
        "AI Context Inspector",
        vscode.ViewColumn.Beside,
        { enableScripts: true },
      );
      this.panel.onDidDispose(() => (this.panel = undefined));
      this.panel.webview.onDidReceiveMessage((message: { command: string }) =>
        this.onMessage(message.command),
      );
    }
    this.render();
    this.panel.reveal();
  }

  private render(): void {
    if (!this.panel) return;
    this.panel.webview.html = this.lastData
      ? renderInspectorHtml(this.lastData)
      : "<html><body><p>Building context…</p></body></html>";
  }

  private async onMessage(command: string): Promise<void> {
    switch (command) {
      case "refresh": {
        this.lastData = await this.callbacks.refresh();
        this.render();
        break;
      }
      case "copy": {
        if (!this.lastData) return;
        await vscode.env.clipboard.writeText(this.lastData.prompt.finalPrompt);
        void vscode.window.setStatusBarMessage("$(check) Prompt copied to clipboard", 3_000);
        break;
      }
      case "export": {
        if (!this.lastData) return;
        const target = await vscode.window.showSaveDialog({
          filters: { JSON: ["json"] },
          defaultUri: vscode.Uri.file("ai-context-prompt.json"),
        });
        if (target) {
          await vscode.workspace.fs.writeFile(
            target,
            new TextEncoder().encode(JSON.stringify(this.lastData.prompt, null, 2)),
          );
          void vscode.window.setStatusBarMessage(`$(check) Exported ${target.fsPath}`, 3_000);
        }
        break;
      }
    }
  }

  dispose(): void {
    this.panel?.dispose();
  }
}

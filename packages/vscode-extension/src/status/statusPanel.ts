import * as vscode from "vscode";
import { renderStatusHtml, type StatusReport } from "./statusReport";

/**
 * Thin webview wrapper around {@link renderStatusHtml}. Holds no business
 * logic: it stores the last report and re-renders on demand.
 */
export class StatusPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private lastReport: StatusReport | undefined;

  update(report: StatusReport): void {
    this.lastReport = report;
    if (this.panel) {
      this.panel.webview.html = renderStatusHtml(report);
    }
  }

  show(): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "aiContextBridge.status",
        "AI Context Bridge Status",
        vscode.ViewColumn.Beside,
        { enableScripts: false },
      );
      this.panel.onDidDispose(() => (this.panel = undefined));
    }
    this.panel.webview.html = this.lastReport
      ? renderStatusHtml(this.lastReport)
      : "<html><body><p>No context has been collected yet. Run <b>AI Context Bridge: Send Context to Bridge</b> first.</p></body></html>";
    this.panel.reveal();
  }

  dispose(): void {
    this.panel?.dispose();
  }
}

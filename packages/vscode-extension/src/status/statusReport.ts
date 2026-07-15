import type { CollectorResult } from "@ai-context-bridge/context-engine";
import type { ContextSnapshot } from "@ai-context-bridge/shared";

/**
 * Pure view-model + renderer for the status panel. No VS Code imports:
 * everything here is unit-testable, and the webview class only displays
 * the produced HTML.
 */

export interface StatusReport {
  snapshotId: string;
  createdAt: string;
  characters: number;
  estimatedTokens?: number;
  tokenLevel?: string;
  relatedFiles: Array<{ filePath: string; reason: string }>;
  collectors: CollectorResult[];
  collectionTimeMs?: number;
  currentFunction?: string;
  projectType?: string;
  backend?: string;
  frontend?: string;
}

export function buildStatusReport(
  snapshot: ContextSnapshot,
  collectors: CollectorResult[],
): StatusReport {
  const intel = snapshot.intelligence;
  const summary = intel?.workspaceSummary;
  return {
    snapshotId: snapshot.id,
    createdAt: snapshot.createdAt,
    characters: intel?.tokenEstimate?.characters ?? JSON.stringify(snapshot).length,
    ...(intel?.tokenEstimate
      ? {
          estimatedTokens: intel.tokenEstimate.estimatedTokens,
          tokenLevel: intel.tokenEstimate.level,
        }
      : {}),
    relatedFiles: intel?.relatedFiles ?? [],
    collectors,
    ...(intel?.collectionTimeMs !== undefined
      ? { collectionTimeMs: intel.collectionTimeMs }
      : {}),
    ...(intel?.currentFunction ? { currentFunction: intel.currentFunction.qualifiedName } : {}),
    ...(summary
      ? {
          projectType: summary.projectType,
          ...(summary.frameworks.backend ? { backend: summary.frameworks.backend } : {}),
          ...(summary.frameworks.frontend ? { frontend: summary.frameworks.frontend } : {}),
        }
      : {}),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LEVEL_COLORS: Record<string, string> = {
  ok: "#3fb950",
  warning: "#d29922",
  compressionRecommended: "#f85149",
};

export function renderStatusHtml(report: StatusReport): string {
  const rows: string[] = [];
  const row = (label: string, value: string) =>
    rows.push(
      `<tr><td class="label">${escapeHtml(label)}</td><td>${value}</td></tr>`,
    );

  row("Snapshot", escapeHtml(report.snapshotId));
  row("Context size", `${report.characters.toLocaleString()} chars`);
  if (report.estimatedTokens !== undefined) {
    const color = LEVEL_COLORS[report.tokenLevel ?? "ok"] ?? "inherit";
    row(
      "Estimated tokens",
      `<span style="color:${color}">${report.estimatedTokens.toLocaleString()} (${escapeHtml(report.tokenLevel ?? "")})</span>`,
    );
  }
  if (report.currentFunction) row("Current function", `<code>${escapeHtml(report.currentFunction)}</code>`);
  if (report.projectType) {
    const stack = [report.backend, report.frontend].filter(Boolean).join(" + ");
    row("Project", escapeHtml(stack ? `${report.projectType} (${stack})` : report.projectType));
  }
  if (report.collectionTimeMs !== undefined) row("Intelligence time", `${report.collectionTimeMs} ms`);

  const relatedItems = report.relatedFiles
    .map((f) => `<li><code>${escapeHtml(f.filePath)}</code> <em>${escapeHtml(f.reason)}</em></li>`)
    .join("");

  const collectorItems = report.collectors
    .map(
      (c) =>
        `<li>${escapeHtml(c.collectorId)}: <strong>${escapeHtml(c.status)}</strong>${
          c.error ? ` — ${escapeHtml(c.error)}` : ""
        }</li>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: var(--vscode-font-family); padding: 12px; }
  table { border-collapse: collapse; margin-bottom: 12px; }
  td { padding: 3px 10px 3px 0; vertical-align: top; }
  td.label { opacity: 0.7; white-space: nowrap; }
  code { font-family: var(--vscode-editor-font-family); }
  ul { margin: 4px 0; padding-left: 18px; }
  h3 { margin: 12px 0 4px; }
</style></head>
<body>
  <h2>AI Context Bridge — Last Snapshot</h2>
  <table>${rows.join("")}</table>
  <h3>Related files (${report.relatedFiles.length})</h3>
  <ul>${relatedItems || "<li><em>none</em></li>"}</ul>
  <h3>Collectors</h3>
  <ul>${collectorItems || "<li><em>none</em></li>"}</ul>
</body>
</html>`;
}

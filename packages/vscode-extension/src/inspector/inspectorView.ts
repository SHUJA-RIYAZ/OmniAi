import type { ContextSelection, PromptDocument } from "@ai-context-bridge/context-engine";

/**
 * Pure view-model + renderer for the Context Inspector (Feature 11).
 * No VS Code imports — fully unit-testable; the panel class only hosts
 * the produced HTML and relays button messages.
 */

export interface InspectorData {
  selection: ContextSelection;
  prompt: PromptDocument;
  /** Time spent collecting the snapshot (Phase 2), if known. */
  collectionTimeMs?: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderInspectorHtml(data: InspectorData): string {
  const { selection, prompt } = data;
  const report = selection.report;

  const fileRows = selection.items
    .map(
      (item) =>
        `<tr><td><code>${escapeHtml(item.filePath)}</code></td>` +
        `<td>${escapeHtml(item.representation)}</td>` +
        `<td class="num">${item.score}</td>` +
        `<td class="num">${item.tokens.toLocaleString()}</td></tr>`,
    )
    .join("");

  const removedRows = selection.removedFiles
    .map((f) => `<li><code>${escapeHtml(f)}</code></li>`)
    .join("");

  const symbolRows = selection.rankedSymbols
    .slice(0, 15)
    .map(
      (s) =>
        `<tr><td><code>${escapeHtml(s.name)}</code></td><td>${escapeHtml(s.kind)}</td>` +
        `<td><code>${escapeHtml(s.filePath)}</code></td><td class="num">${s.score}</td></tr>`,
    )
    .join("");

  const usedTokens = report.compressedTokens;
  const pct = selection.maxTokens > 0 ? Math.round((usedTokens / selection.maxTokens) * 100) : 0;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: var(--vscode-font-family); padding: 12px; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 14px; }
  th, td { text-align: left; padding: 3px 10px 3px 0; border-bottom: 1px solid var(--vscode-widget-border, #444); }
  td.num, th.num { text-align: right; }
  code { font-family: var(--vscode-editor-font-family); }
  .bar { height: 8px; background: var(--vscode-progressBar-background, #06c); width: ${Math.min(pct, 100)}%; }
  .track { background: var(--vscode-widget-border, #333); margin: 4px 0 12px; }
  .stats { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 8px; }
  .stats div span { display: block; opacity: 0.7; font-size: 0.85em; }
  button { margin-right: 8px; padding: 4px 12px; }
  h3 { margin: 14px 0 2px; }
</style></head>
<body>
  <h2>Context Inspector — ${escapeHtml(selection.strategy)} strategy</h2>
  <div>
    <button id="refresh">Refresh</button>
    <button id="copy">Copy Prompt</button>
    <button id="export">Export JSON</button>
  </div>

  <h3>Budget: ${usedTokens.toLocaleString()} / ${selection.maxTokens.toLocaleString()} tokens (${pct}%)</h3>
  <div class="track"><div class="bar"></div></div>

  <div class="stats">
    <div><span>Original tokens</span>${report.originalTokens.toLocaleString()}</div>
    <div><span>Compressed</span>${report.compressedTokens.toLocaleString()}</div>
    <div><span>Ratio</span>${report.compressionRatio.toFixed(2)}</div>
    <div><span>Prompt size</span>${prompt.finalPrompt.length.toLocaleString()} chars</div>
    <div><span>Selection time</span>${selection.selectionTimeMs} ms</div>
    ${data.collectionTimeMs !== undefined ? `<div><span>Collection time</span>${Math.round(data.collectionTimeMs)} ms</div>` : ""}
  </div>

  <h3>Selected files (${report.filesSelected})</h3>
  <table><tr><th>File</th><th>Representation</th><th class="num">Score</th><th class="num">Tokens</th></tr>${fileRows}</table>

  <h3>Top symbols (${Math.min(selection.rankedSymbols.length, 15)} of ${selection.rankedSymbols.length})</h3>
  <table><tr><th>Symbol</th><th>Kind</th><th>File</th><th class="num">Score</th></tr>${symbolRows}</table>

  ${report.filesRemoved > 0 ? `<h3>Removed (${report.filesRemoved})</h3><ul>${removedRows}</ul>` : ""}

  <script>
    const vscode = acquireVsCodeApi();
    for (const id of ["refresh", "copy", "export"]) {
      document.getElementById(id).addEventListener("click", () => vscode.postMessage({ command: id }));
    }
  </script>
</body>
</html>`;
}

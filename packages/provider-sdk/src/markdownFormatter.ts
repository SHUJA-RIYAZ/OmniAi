import type { ContextSnapshot } from "@ai-context-bridge/shared";

/**
 * Default markdown rendering of a snapshot, shared by adapters that don't
 * need provider-specific formatting. Sections appear only when populated.
 */
export function formatSnapshotAsMarkdown(snapshot: ContextSnapshot): string {
  const parts: string[] = [
    `# Project context: ${snapshot.workspace.name}`,
    `Languages: ${snapshot.workspace.languages.join(", ") || "unknown"}`,
  ];

  if (snapshot.activeFile) {
    const f = snapshot.activeFile;
    parts.push(
      `## Active file: \`${f.filePath}\`${f.truncated ? " (truncated)" : ""}`,
      "```" + f.languageId,
      f.content,
      "```",
    );
  }

  if (snapshot.selection) {
    const s = snapshot.selection;
    parts.push(
      `## Selection: \`${s.filePath}\` lines ${s.startLine}-${s.endLine}`,
      "```",
      s.text,
      "```",
    );
  }

  if (snapshot.diagnostics.length > 0) {
    parts.push(
      "## Diagnostics",
      ...snapshot.diagnostics.map(
        (d) => `- **${d.severity}** \`${d.filePath}:${d.line}:${d.column}\` — ${d.message}`,
      ),
    );
  }

  if (snapshot.gitDiff) {
    parts.push(
      `## Git diff (branch: ${snapshot.gitDiff.branch})${snapshot.gitDiff.truncated ? " (truncated)" : ""}`,
      "```diff",
      snapshot.gitDiff.diff,
      "```",
    );
  }

  if (snapshot.terminal) {
    parts.push(`## Terminal output (${snapshot.terminal.name})`, "```", snapshot.terminal.lines.join("\n"), "```");
  }

  return parts.join("\n\n");
}

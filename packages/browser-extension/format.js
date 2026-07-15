// Markdown formatting of a snapshot. Mirrors
// packages/provider-sdk/src/markdownFormatter.ts — once the extension gains a
// build step, this file will be generated from the provider-sdk instead.

export function formatSnapshotAsMarkdown(snapshot) {
  const parts = [
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

  if (snapshot.diagnostics && snapshot.diagnostics.length > 0) {
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
    parts.push(
      `## Terminal output (${snapshot.terminal.name})`,
      "```",
      snapshot.terminal.lines.join("\n"),
      "```",
    );
  }

  return parts.join("\n\n");
}

// Input selectors per provider host, mirroring provider-sdk adapters.
export const PROVIDER_SELECTORS = [
  { hosts: ["claude.ai"], selectors: ['div[contenteditable="true"]', "textarea"] },
  {
    hosts: ["chatgpt.com", "chat.openai.com"],
    selectors: ["#prompt-textarea", 'div[contenteditable="true"]', "textarea"],
  },
  { hosts: ["gemini.google.com"], selectors: ['div[contenteditable="true"]', "textarea"] },
];

export function selectorsForHost(hostname) {
  for (const provider of PROVIDER_SELECTORS) {
    if (provider.hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
      return provider.selectors;
    }
  }
  return [];
}

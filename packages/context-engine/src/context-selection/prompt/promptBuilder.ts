import type { IPromptBuilder } from "../interfaces";
import type { ContextSelection, PromptDocument, SelectionInput } from "../models";

const SYSTEM_CONTEXT =
  "You are assisting with the developer's current task in their code editor. " +
  "The context below was selected and compressed deterministically: files are " +
  "ranked by relevance to the cursor position, and some appear as structural " +
  "summaries (signatures only) to fit the token budget. Line numbers refer to " +
  "original files.";

/**
 * Deterministic prompt assembly (Feature 8). Produces a versioned JSON
 * document plus a `finalPrompt` markdown rendering; identical inputs give
 * byte-identical output.
 */
export class PromptBuilder implements IPromptBuilder {
  build(input: SelectionInput, selection: ContextSelection): PromptDocument {
    const snapshot = input.snapshot;
    const intel = snapshot.intelligence;

    const dependencySummary = (intel?.dependencyGraph?.edges ?? []).map(
      (e) => `${e.from} → ${e.to} (${e.type ?? "import"})`,
    );

    const document: PromptDocument = {
      promptSchemaVersion: 1,
      systemContext: SYSTEM_CONTEXT,
      ...(intel?.workspaceSummary ? { workspaceSummary: intel.workspaceSummary } : {}),
      ...(input.currentTask ? { currentTask: input.currentTask } : {}),
      ...(intel?.currentFunction
        ? {
            currentFunction: {
              name: intel.currentFunction.name,
              qualifiedName: intel.currentFunction.qualifiedName,
              startLine: intel.currentFunction.startLine,
              endLine: intel.currentFunction.endLine,
            },
          }
        : {}),
      dependencySummary,
      diagnostics: snapshot.diagnostics,
      ...(snapshot.gitDiff ? { gitDiff: snapshot.gitDiff.diff } : {}),
      files: selection.items.map(({ filePath, representation, content, tokens }) => ({
        filePath,
        representation,
        content,
        tokens,
      })),
      finalPrompt: "",
      report: selection.report,
    };
    document.finalPrompt = renderMarkdown(document, snapshot.workspace.name);
    return document;
  }
}

function renderMarkdown(doc: PromptDocument, workspaceName: string): string {
  const parts: string[] = [doc.systemContext, ""];

  if (doc.workspaceSummary) {
    const fw = doc.workspaceSummary.frameworks;
    const stack = [fw.backend, fw.frontend, fw.database].filter(Boolean).join(", ");
    parts.push(
      `## Workspace: ${workspaceName}`,
      `Type: ${doc.workspaceSummary.projectType}${stack ? ` · Stack: ${stack}` : ""}`,
      "",
    );
  }
  if (doc.currentTask) parts.push("## Current task", doc.currentTask, "");
  if (doc.currentFunction) {
    parts.push(
      "## Current function",
      `\`${doc.currentFunction.qualifiedName}\` (lines ${doc.currentFunction.startLine}–${doc.currentFunction.endLine})`,
      "",
    );
  }
  if (doc.dependencySummary.length > 0) {
    parts.push("## Dependencies", ...doc.dependencySummary.map((d) => `- ${d}`), "");
  }
  if (doc.diagnostics.length > 0) {
    parts.push(
      "## Diagnostics",
      ...doc.diagnostics.map(
        (d) => `- **${d.severity}** \`${d.filePath}:${d.line}:${d.column}\` — ${d.message}`,
      ),
      "",
    );
  }
  if (doc.gitDiff) parts.push("## Git diff", "```diff", doc.gitDiff, "```", "");

  for (const file of doc.files) {
    parts.push(`### \`${file.filePath}\` (${file.representation})`, "```", file.content, "```", "");
  }

  return parts.join("\n").trimEnd();
}

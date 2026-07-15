import * as vscode from "vscode";
import * as path from "node:path";
import type { WorkspaceMetadata } from "@ai-context-bridge/shared";

const KNOWN_MANIFESTS = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
];

const EXT_TO_LANGUAGE: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".rb": "ruby",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".c": "c",
  ".php": "php",
};

/** Cheap workspace profiling: manifests at the root, languages by sampled file extensions. */
export async function collectWorkspaceMetadata(): Promise<WorkspaceMetadata> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return { name: "no-workspace", rootPath: "", languages: [], manifests: [] };
  }

  const manifests: string[] = [];
  for (const manifest of KNOWN_MANIFESTS) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(folder.uri, manifest));
      manifests.push(manifest);
    } catch {
      // not present
    }
  }

  const files = await vscode.workspace.findFiles("**/*.*", "**/node_modules/**", 500);
  const counts = new Map<string, number>();
  for (const file of files) {
    const lang = EXT_TO_LANGUAGE[path.extname(file.fsPath).toLowerCase()];
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const languages = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  return {
    name: folder.name,
    rootPath: folder.uri.fsPath,
    languages,
    manifests,
  };
}

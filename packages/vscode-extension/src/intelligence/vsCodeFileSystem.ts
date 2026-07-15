import * as vscode from "vscode";
import type { IFileSystem } from "@ai-context-bridge/context-engine";

/**
 * `IFileSystem` over the VS Code workspace. Paths are workspace-relative
 * with forward slashes, per the interface contract; the workspace folder
 * is captured at construction so nothing else touches absolute paths.
 */
export class VsCodeFileSystem implements IFileSystem {
  constructor(private readonly root: vscode.Uri) {}

  static forActiveWorkspace(): VsCodeFileSystem | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder ? new VsCodeFileSystem(folder.uri) : undefined;
  }

  async readFile(path: string): Promise<string | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.uri(path));
      return new TextDecoder().decode(bytes);
    } catch {
      return undefined;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.uri(path));
      return true;
    } catch {
      return false;
    }
  }

  private uri(path: string): vscode.Uri {
    return vscode.Uri.joinPath(this.root, ...path.split("/"));
  }
}

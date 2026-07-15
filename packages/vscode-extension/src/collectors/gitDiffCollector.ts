import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ContextCollector } from "@ai-context-bridge/context-engine";
import { LIMITS, type ContextSnapshot } from "@ai-context-bridge/shared";

const execFileAsync = promisify(execFile);

export class GitDiffCollector implements ContextCollector {
  readonly id = "gitDiff";
  readonly flag = "collect.gitDiff" as const;

  async collect(): Promise<Partial<ContextSnapshot>> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return {};

    let diff: string;
    let branch: string;
    try {
      [diff, branch] = await Promise.all([
        this.git(root, ["diff", "HEAD"]),
        this.git(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
      ]);
    } catch {
      // Not a git repo, git missing, or empty repo — all expected; skip quietly.
      return {};
    }

    if (!diff.trim()) return {};
    const truncated = diff.length > LIMITS.gitDiffMaxChars;

    return {
      gitDiff: {
        diff: truncated ? diff.slice(0, LIMITS.gitDiffMaxChars) : diff,
        truncated,
        branch: branch.trim(),
      },
    };
  }

  private async git(cwd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }
}

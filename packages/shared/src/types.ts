/**
 * Contract types shared by every AI Context Bridge component:
 * the VS Code extension produces a {@link ContextSnapshot}, the local
 * bridge stores and serves it, and the browser extension consumes it.
 *
 * These types are the wire format (JSON over HTTP). Keep them
 * serialization-safe: no classes, no functions, no `Date` objects.
 */

/** Severity levels mirroring `vscode.DiagnosticSeverity`, stringly typed for the wire. */
export type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

export interface DiagnosticItem {
  filePath: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  code?: string;
}

export interface WorkspaceMetadata {
  name: string;
  rootPath: string;
  /** Detected languages by file count, most common first (e.g. ["typescript", "python"]). */
  languages: string[];
  /** Names of detected package manifests, e.g. ["package.json", "pyproject.toml"]. */
  manifests: string[];
}

export interface ActiveFileContext {
  filePath: string;
  languageId: string;
  /** Full text, possibly truncated by the collector; see `truncated`. */
  content: string;
  truncated: boolean;
  lineCount: number;
}

export interface SelectionContext {
  filePath: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface TerminalContext {
  /** Terminal display name. */
  name: string;
  /** Most recent output lines, oldest first. */
  lines: string[];
}

export interface GitDiffContext {
  /** Unified diff of the working tree against HEAD, possibly truncated. */
  diff: string;
  truncated: boolean;
  branch: string;
}

/**
 * One point-in-time capture of everything an AI assistant needs to know
 * about the developer's current working state.
 */
export interface ContextSnapshot {
  /** UUID assigned by the producer. */
  id: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** Schema version for forward compatibility. */
  schemaVersion: 1;
  workspace: WorkspaceMetadata;
  activeFile?: ActiveFileContext;
  selection?: SelectionContext;
  diagnostics: DiagnosticItem[];
  terminal?: TerminalContext;
  gitDiff?: GitDiffContext;
  /**
   * Structured code intelligence (Phase 2). Optional and additive:
   * consumers that predate it keep working unchanged.
   */
  intelligence?: import("./intelligence").IntelligenceContext;
}

/** Response envelope used by every bridge endpoint. */
export interface BridgeResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

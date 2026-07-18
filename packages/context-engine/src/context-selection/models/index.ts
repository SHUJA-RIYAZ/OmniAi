/**
 * Data models of the context-selection subsystem (Phase 3). These are
 * engine-local: nothing here crosses the bridge wire, so no schema
 * versioning applies (the prompt document carries its own version).
 */

import type {
  ContextSnapshot,
  DiagnosticItem,
  FunctionInfo,
  WorkspaceSummary,
} from "@ai-context-bridge/shared";

/** Why a file scored what it scored — kept for explainability in the UI. */
export interface ScoreSignals {
  isCurrent: boolean;
  /** Import-graph distance from the current file; undefined = unreachable. */
  importDepth?: number;
  /** The current function calls something defined in this file. */
  calledFromCurrent: boolean;
  diagnosticCount: number;
  inGitDiff: boolean;
}

export interface ScoredFile {
  filePath: string;
  /** 0–100, deterministic. */
  score: number;
  signals: ScoreSignals;
}

export type SymbolKind = "function" | "method" | "class";

export interface RankedSymbol {
  id?: string;
  name: string;
  kind: SymbolKind;
  filePath: string;
  score: number;
  startLine: number;
  endLine: number;
}

/** How a file's content is represented inside the selection. */
export type Representation = "full" | "compressed" | "snippet" | "structural";

export interface SelectedItem {
  filePath: string;
  representation: Representation;
  content: string;
  tokens: number;
  score: number;
}

export interface CompressionReport {
  originalTokens: number;
  compressedTokens: number;
  /** compressedTokens / originalTokens; 1 = no compression, 0 = everything dropped. */
  compressionRatio: number;
  filesSelected: number;
  filesRemoved: number;
  symbolsSelected: number;
  budgetRemaining: number;
}

export interface ContextSelection {
  strategy: string;
  maxTokens: number;
  items: SelectedItem[];
  rankedFiles: ScoredFile[];
  rankedSymbols: RankedSymbol[];
  /** Files considered but dropped (no budget or unreadable). */
  removedFiles: string[];
  report: CompressionReport;
  /** Wall-clock selection time. */
  selectionTimeMs: number;
}

export type CompressionLevel = "none" | "light" | "aggressive";

export interface SelectionOptions {
  maxTokens: number;
  strategy: string;
  compressionLevel: CompressionLevel;
  /** Overrides within the compression level. */
  removeComments: boolean;
  compressWhitespace: boolean;
  maxFiles: number;
}

export const DEFAULT_SELECTION_OPTIONS: SelectionOptions = {
  maxTokens: 8_000,
  strategy: "hybrid",
  compressionLevel: "light",
  removeComments: true,
  compressWhitespace: true,
  maxFiles: 12,
};

/** Everything selection needs; derived entirely from the Phase 2 snapshot. */
export interface SelectionInput {
  snapshot: ContextSnapshot;
  /** Optional task description supplied by the user, echoed into the prompt. */
  currentTask?: string;
}

/** Versioned, JSON-serializable prompt document (Feature 8). */
export interface PromptDocument {
  promptSchemaVersion: 1;
  systemContext: string;
  workspaceSummary?: WorkspaceSummary;
  currentTask?: string;
  currentFunction?: Pick<FunctionInfo, "name" | "qualifiedName" | "startLine" | "endLine">;
  /** Human-readable dependency edges, e.g. "auth.py → jwt.py (call)". */
  dependencySummary: string[];
  diagnostics: DiagnosticItem[];
  gitDiff?: string;
  files: Array<Pick<SelectedItem, "filePath" | "representation" | "content" | "tokens">>;
  finalPrompt: string;
  report: CompressionReport;
}

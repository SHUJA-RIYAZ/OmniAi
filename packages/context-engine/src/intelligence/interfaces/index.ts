/**
 * Ports of the intelligence subsystem. Every implementation in parser/,
 * dependency/, symbols/, summarizer/, and services/ is injected through one
 * of these interfaces — nothing depends on a concrete class.
 */

import type {
  FileAnalysis,
  ImportInfo,
  TokenEstimate,
  WorkspaceSummary,
} from "@ai-context-bridge/shared";

/** Analyzes one source file into structured symbols. Language-independent. */
export interface ILanguageAnalyzer {
  supports(languageId: string): boolean;
  /** @throws if the source cannot be parsed or the backend is unreachable. */
  analyze(source: string, languageId: string): Promise<FileAnalysis>;
}

/**
 * Minimal read-only filesystem port. Paths are workspace-relative with
 * forward slashes, so implementations decide the root (VS Code workspace,
 * in-memory map in tests) and nothing hardcodes absolute paths.
 */
export interface IFileSystem {
  /** Returns undefined when the file does not exist or cannot be read. */
  readFile(path: string): Promise<string | undefined>;
  exists(path: string): Promise<boolean>;
}

/** Resolves one import statement to existing workspace files. */
export interface IModuleResolver {
  supports(languageId: string): boolean;
  resolve(imp: ImportInfo, importerPath: string): Promise<string[]>;
}

/** Estimates token usage of arbitrary text. No AI involved. */
export interface ITokenEstimator {
  estimate(text: string): TokenEstimate;
}

/** Profiles the workspace: project type, frameworks, tooling. */
export interface IWorkspaceSummarizer {
  summarize(languages: string[]): Promise<WorkspaceSummary>;
}

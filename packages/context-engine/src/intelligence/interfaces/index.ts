/**
 * Ports of the intelligence subsystem. Every implementation in parser/,
 * dependency/, symbols/, summarizer/, and services/ is injected through one
 * of these interfaces — nothing depends on a concrete class.
 */

import type {
  FileAnalysis,
  ImportInfo,
  IntelligenceContext,
  TokenEstimate,
  WorkspaceSummary,
} from "@ai-context-bridge/shared";

/** Analyzes one source file into structured symbols. Language-independent. */
export interface ILanguageAnalyzer {
  supports(languageId: string): boolean;
  /**
   * @param path workspace-relative path, used to mint stable symbol ids.
   * @throws if the source cannot be parsed or the backend is unreachable.
   */
  analyze(source: string, languageId: string, path?: string): Promise<FileAnalysis>;
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

/** Content-addressed cache of file analyses. Implementations own eviction. */
export interface IAnalysisCache {
  get(key: string): FileAnalysis | undefined;
  set(key: string, analysis: FileAnalysis): void;
  clear(): void;
}

/** Hit/miss statistics exposed by caching analyzers for performance metrics. */
export interface CacheStats {
  hits: number;
  misses: number;
}

/** Builds a full IntelligenceContext from builder-specific input. */
export interface IContextBuilder<TInput> {
  build(input: TInput): Promise<IntelligenceContext>;
}

/*
 * Spec-facing aliases. The project convention prefixes ports with `I`;
 * these aliases let consumers use the unprefixed names from the
 * architecture documents interchangeably.
 */
export type LanguageAnalyzer = ILanguageAnalyzer;
export type WorkspaceAnalyzer = IWorkspaceSummarizer;
export type DependencyResolver = IModuleResolver;
export type TokenEstimator = ITokenEstimator;
export type ContextBuilder<TInput> = IContextBuilder<TInput>;

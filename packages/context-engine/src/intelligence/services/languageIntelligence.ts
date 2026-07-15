import type {
  ClassInfo,
  DependencyGraphData,
  FunctionInfo,
  ImportInfo,
} from "@ai-context-bridge/shared";
import type { IFileSystem, ILanguageAnalyzer, IModuleResolver } from "../interfaces";
import { DependencyGraphBuilder } from "../dependency/graphBuilder";
import { allFunctions, findEnclosingFunction } from "../symbols/symbolLocator";

/**
 * Task-oriented facade over the intelligence subsystem — the API consumers
 * call, as opposed to `ILanguageAnalyzer`, the minimal SPI language
 * backends implement (one `analyze()` producing a full `FileAnalysis`).
 *
 * Keeping the two separate means a new language backend implements exactly
 * one method and inherits all five capabilities here, and remote-backed
 * analyzers aren't forced into one parse round-trip per question.
 */
export interface ILanguageIntelligence {
  /** The innermost function enclosing the (1-based) cursor line, if any. */
  detectCurrentFunction(
    source: string,
    languageId: string,
    cursorLine: number,
  ): Promise<FunctionInfo | undefined>;
  extractImports(source: string, languageId: string): Promise<ImportInfo[]>;
  extractClasses(source: string, languageId: string): Promise<ClassInfo[]>;
  /** All functions including class methods, flattened. */
  extractFunctions(source: string, languageId: string): Promise<FunctionInfo[]>;
  /** Transitive import graph rooted at a workspace-relative file path. */
  buildDependencyGraph(
    filePath: string,
    languageId: string,
    maxDepth: number,
  ): Promise<DependencyGraphData>;
}

export class LanguageIntelligence implements ILanguageIntelligence {
  private readonly graphBuilder: DependencyGraphBuilder;
  /** Memo of the last parse, so consecutive extract* calls on the same source parse once. */
  private lastParse: { source: string; languageId: string; analysis: Promise<import("@ai-context-bridge/shared").FileAnalysis> } | undefined;

  constructor(
    private readonly analyzer: ILanguageAnalyzer,
    resolver: IModuleResolver,
    fs: IFileSystem,
  ) {
    this.graphBuilder = new DependencyGraphBuilder(analyzer, resolver, fs);
  }

  async detectCurrentFunction(
    source: string,
    languageId: string,
    cursorLine: number,
  ): Promise<FunctionInfo | undefined> {
    return findEnclosingFunction(await this.analyze(source, languageId), cursorLine);
  }

  async extractImports(source: string, languageId: string): Promise<ImportInfo[]> {
    return (await this.analyze(source, languageId)).imports;
  }

  async extractClasses(source: string, languageId: string): Promise<ClassInfo[]> {
    return (await this.analyze(source, languageId)).classes;
  }

  async extractFunctions(source: string, languageId: string): Promise<FunctionInfo[]> {
    return allFunctions(await this.analyze(source, languageId));
  }

  buildDependencyGraph(
    filePath: string,
    languageId: string,
    maxDepth: number,
  ): Promise<DependencyGraphData> {
    return this.graphBuilder.build(filePath, languageId, maxDepth);
  }

  private analyze(source: string, languageId: string) {
    if (this.lastParse?.source !== source || this.lastParse.languageId !== languageId) {
      this.lastParse = { source, languageId, analysis: this.analyzer.analyze(source, languageId) };
    }
    return this.lastParse.analysis;
  }
}

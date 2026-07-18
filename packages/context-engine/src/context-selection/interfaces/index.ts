/**
 * Ports of the context-selection subsystem. Concrete implementations only
 * depend on these (plus the intelligence ports), never on each other.
 */

import type { FileAnalysis } from "@ai-context-bridge/shared";
import type {
  CompressionLevel,
  ContextSelection,
  PromptDocument,
  RankedSymbol,
  ScoredFile,
  SelectionInput,
  SelectionOptions,
} from "../models";

/** Scores every candidate file 0–100, deterministically. */
export interface IContextScorer {
  scoreFiles(input: SelectionInput): ScoredFile[];
}

/** Orders files and symbols by relevance. */
export interface IPriorityRanker {
  rankFiles(scored: ScoredFile[]): ScoredFile[];
  rankSymbols(input: SelectionInput, rankedFiles: ScoredFile[]): RankedSymbol[];
}

/** Text-level, non-AI code compression (Feature 5). */
export interface ICodeCompressor {
  compress(
    source: string,
    languageId: string,
    level: CompressionLevel,
    options?: { removeComments?: boolean; compressWhitespace?: boolean },
  ): string;
}

/** Renders a structural skeleton from an analysis (Feature 6). */
export interface IStructuralCompressor {
  render(filePath: string, analysis: FileAnalysis): string;
}

/**
 * One selection strategy (Feature 9). Strategies must be deterministic:
 * same input → same selection, byte for byte.
 */
export interface ISelectionStrategy {
  readonly name: string;
  select(input: SelectionInput, options: SelectionOptions): Promise<ContextSelection>;
}

/** Builds the final prompt document from a selection (Feature 8). */
export interface IPromptBuilder {
  build(input: SelectionInput, selection: ContextSelection): PromptDocument;
}

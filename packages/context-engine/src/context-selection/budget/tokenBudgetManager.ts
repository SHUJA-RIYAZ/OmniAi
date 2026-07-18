import type { IFileSystem, ILanguageAnalyzer, ITokenEstimator } from "../../intelligence/interfaces";
import type { ICodeCompressor, IStructuralCompressor } from "../interfaces";
import type { ScoredFile, SelectedItem, SelectionInput, SelectionOptions } from "../models";

export interface BudgetFillResult {
  items: SelectedItem[];
  removedFiles: string[];
  /** Token cost of the full sources of every readable candidate. */
  originalTokens: number;
  remainingTokens: number;
}

/**
 * Greedy, deterministic budget allocation (Features 3, 4, 7).
 *
 * Files are visited in rank order — which encodes dependency expansion:
 * current function's file first, then called files, then imports by depth —
 * and each is admitted with the richest representation that still fits:
 *
 *   full (level "none") → compressed → snippet (current file) → structural
 *
 * Sources are read lazily, only when a file is actually considered, so
 * huge workspaces cost nothing beyond the ranked candidate list.
 */
export class TokenBudgetManager {
  constructor(
    private readonly fs: IFileSystem,
    private readonly estimator: ITokenEstimator,
    private readonly compressor: ICodeCompressor,
    private readonly structural: IStructuralCompressor,
    private readonly analyzer: ILanguageAnalyzer,
  ) {}

  async fill(
    input: SelectionInput,
    rankedFiles: ScoredFile[],
    options: SelectionOptions,
  ): Promise<BudgetFillResult> {
    const items: SelectedItem[] = [];
    const removedFiles: string[] = [];
    let remaining = options.maxTokens;
    let originalTokens = 0;

    const languageId = input.snapshot.activeFile?.languageId ?? "python";
    const candidates = rankedFiles.filter((f) => f.score > 0).slice(0, options.maxFiles);

    for (const candidate of candidates) {
      const source = await this.fs.readFile(candidate.filePath);
      if (source === undefined) {
        removedFiles.push(candidate.filePath);
        continue;
      }
      originalTokens += this.tokens(source);

      const representations = await this.representations(
        candidate,
        source,
        languageId,
        input,
        options,
      );

      const fitting = representations.find((r) => this.tokens(r.content) <= remaining);
      if (!fitting) {
        removedFiles.push(candidate.filePath);
        continue;
      }
      const tokens = this.tokens(fitting.content);
      items.push({
        filePath: candidate.filePath,
        representation: fitting.representation,
        content: fitting.content,
        tokens,
        score: candidate.score,
      });
      remaining -= tokens;
    }

    return { items, removedFiles, originalTokens, remainingTokens: remaining };
  }

  private async representations(
    candidate: ScoredFile,
    source: string,
    languageId: string,
    input: SelectionInput,
    options: SelectionOptions,
  ): Promise<Array<{ representation: SelectedItem["representation"]; content: string }>> {
    if (options.compressionLevel === "none") {
      return [{ representation: "full", content: source }];
    }

    const out: Array<{ representation: SelectedItem["representation"]; content: string }> = [
      {
        representation: "compressed",
        content: this.compressor.compress(source, languageId, options.compressionLevel, {
          removeComments: options.removeComments,
          compressWhitespace: options.compressWhitespace,
        }),
      },
    ];

    if (candidate.signals.isCurrent) {
      const snippet = this.currentFileSnippet(input, source);
      if (snippet) out.push({ representation: "snippet", content: snippet });
    }

    const skeleton = await this.structuralSkeleton(candidate.filePath, source, languageId, input);
    if (skeleton) out.push({ representation: "structural", content: skeleton });

    return out;
  }

  /**
   * Current function's full source plus a structural skeleton of the rest
   * of the file (Feature 4) — the middle ground when the whole file
   * doesn't fit.
   */
  private currentFileSnippet(input: SelectionInput, source: string): string | undefined {
    const intel = input.snapshot.intelligence;
    const fn = intel?.currentFunction;
    const analysis = intel?.fileAnalysis;
    if (!fn || !analysis) return undefined;

    const lines = source.split("\n");
    const body = lines.slice(fn.startLine - 1, fn.endLine).join("\n");
    const skeleton = this.structural.render(
      input.snapshot.activeFile?.filePath ?? "current file",
      analysis,
    );
    return `${skeleton}\n\n# Current function (full source):\n${body}`;
  }

  private async structuralSkeleton(
    filePath: string,
    source: string,
    languageId: string,
    input: SelectionInput,
  ): Promise<string | undefined> {
    const intel = input.snapshot.intelligence;
    // The current file's analysis is already in the snapshot; others parse
    // through the (cached) analyzer.
    if (intel?.fileAnalysis && intel.dependencyGraph?.rootFile === filePath) {
      return this.structural.render(filePath, intel.fileAnalysis);
    }
    if (!this.analyzer.supports(languageId)) return undefined;
    try {
      const analysis = await this.analyzer.analyze(source, languageId, filePath);
      return this.structural.render(filePath, analysis);
    } catch {
      return undefined;
    }
  }

  private tokens(text: string): number {
    return this.estimator.estimate(text).estimatedTokens;
  }
}

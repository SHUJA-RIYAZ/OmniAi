import type { ISelectionStrategy } from "../interfaces";
import type { ContextSelection, SelectionInput, SelectionOptions } from "../models";
import { ContextScorer, HYBRID_WEIGHTS, type ScoringWeights } from "../scoring/contextScorer";
import { PriorityRanker } from "../ranking/priorityRanker";
import type { TokenBudgetManager } from "../budget/tokenBudgetManager";

/**
 * All strategies (Feature 9) are weight profiles over one shared pipeline:
 * score → rank → budget-fill → report. That keeps them deterministic,
 * individually selectable, and free of duplicated logic.
 */
export const STRATEGY_WEIGHTS: Record<string, ScoringWeights> = {
  "current-file": { current: 100, called: 0, imported: 0, depthDecay: 0, diagnosticBoost: 0, gitBoost: 0 },
  dependency: { current: 100, called: 95, imported: 85, depthDecay: 12, diagnosticBoost: 0, gitBoost: 0 },
  diagnostics: { current: 100, called: 45, imported: 30, depthDecay: 10, diagnosticBoost: 30, gitBoost: 0 },
  git: { current: 100, called: 45, imported: 30, depthDecay: 10, diagnosticBoost: 0, gitBoost: 60 },
  hybrid: HYBRID_WEIGHTS,
};

class WeightedStrategy implements ISelectionStrategy {
  private readonly scorer: ContextScorer;
  private readonly ranker = new PriorityRanker();

  constructor(
    readonly name: string,
    weights: ScoringWeights,
    private readonly budget: TokenBudgetManager,
  ) {
    this.scorer = new ContextScorer(weights);
  }

  async select(input: SelectionInput, options: SelectionOptions): Promise<ContextSelection> {
    const started = Date.now();

    const scored = this.scorer.scoreFiles(input);
    const rankedFiles = this.ranker.rankFiles(scored);
    const rankedSymbols = this.ranker.rankSymbols(input, rankedFiles);

    const fill = await this.budget.fill(input, rankedFiles, options);

    const selectedPaths = new Set(fill.items.map((i) => i.filePath));
    const compressedTokens = fill.items.reduce((sum, item) => sum + item.tokens, 0);

    return {
      strategy: this.name,
      maxTokens: options.maxTokens,
      items: fill.items,
      rankedFiles,
      rankedSymbols,
      removedFiles: fill.removedFiles,
      report: {
        originalTokens: fill.originalTokens,
        compressedTokens,
        compressionRatio:
          fill.originalTokens > 0 ? compressedTokens / fill.originalTokens : 1,
        filesSelected: fill.items.length,
        filesRemoved: fill.removedFiles.length,
        symbolsSelected: rankedSymbols.filter((s) => selectedPaths.has(s.filePath)).length,
        budgetRemaining: fill.remainingTokens,
      },
      selectionTimeMs: Date.now() - started,
    };
  }
}

export class CurrentFileStrategy extends WeightedStrategy {
  constructor(budget: TokenBudgetManager) {
    super("current-file", STRATEGY_WEIGHTS["current-file"] as ScoringWeights, budget);
  }
}

export class DependencyStrategy extends WeightedStrategy {
  constructor(budget: TokenBudgetManager) {
    super("dependency", STRATEGY_WEIGHTS.dependency as ScoringWeights, budget);
  }
}

export class DiagnosticsStrategy extends WeightedStrategy {
  constructor(budget: TokenBudgetManager) {
    super("diagnostics", STRATEGY_WEIGHTS.diagnostics as ScoringWeights, budget);
  }
}

export class GitStrategy extends WeightedStrategy {
  constructor(budget: TokenBudgetManager) {
    super("git", STRATEGY_WEIGHTS.git as ScoringWeights, budget);
  }
}

export class HybridStrategy extends WeightedStrategy {
  constructor(budget: TokenBudgetManager) {
    super("hybrid", STRATEGY_WEIGHTS.hybrid as ScoringWeights, budget);
  }
}

/** Resolves strategies by name; unknown names fall back to hybrid. */
export class StrategyRegistry {
  private readonly strategies = new Map<string, ISelectionStrategy>();

  constructor(budget: TokenBudgetManager) {
    for (const strategy of [
      new CurrentFileStrategy(budget),
      new DependencyStrategy(budget),
      new DiagnosticsStrategy(budget),
      new GitStrategy(budget),
      new HybridStrategy(budget),
    ]) {
      this.strategies.set(strategy.name, strategy);
    }
  }

  register(strategy: ISelectionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  get(name: string): ISelectionStrategy {
    return this.strategies.get(name) ?? (this.strategies.get("hybrid") as ISelectionStrategy);
  }

  names(): string[] {
    return [...this.strategies.keys()];
  }
}

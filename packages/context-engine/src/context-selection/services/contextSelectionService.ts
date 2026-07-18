import type {
  IFileSystem,
  ILanguageAnalyzer,
  ITokenEstimator,
} from "../../intelligence/interfaces";
import type { IPromptBuilder } from "../interfaces";
import type { ContextSelection, PromptDocument, SelectionInput, SelectionOptions } from "../models";
import { DEFAULT_SELECTION_OPTIONS } from "../models";
import { TokenBudgetManager } from "../budget/tokenBudgetManager";
import { CodeCompressor } from "../compression/codeCompressor";
import { StructuralCompressor } from "../compression/structuralCompressor";
import { PromptBuilder } from "../prompt/promptBuilder";
import { StrategyRegistry } from "../selectors/strategies";

export interface SelectionResult {
  selection: ContextSelection;
  prompt: PromptDocument;
}

/** Ports the service needs; collaborators are composed internally but overridable. */
export interface SelectionServiceDeps {
  fs: IFileSystem;
  estimator: ITokenEstimator;
  analyzer: ILanguageAnalyzer;
  registry?: StrategyRegistry;
  promptBuilder?: IPromptBuilder;
}

/**
 * Facade of the context-selection subsystem: given a Phase 2 snapshot and
 * options, runs the configured strategy and builds the prompt document.
 * Fully deterministic; no AI involved.
 */
export class ContextSelectionService {
  private readonly registry: StrategyRegistry;
  private readonly promptBuilder: IPromptBuilder;

  constructor(deps: SelectionServiceDeps) {
    this.registry =
      deps.registry ??
      new StrategyRegistry(
        new TokenBudgetManager(
          deps.fs,
          deps.estimator,
          new CodeCompressor(),
          new StructuralCompressor(),
          deps.analyzer,
        ),
      );
    this.promptBuilder = deps.promptBuilder ?? new PromptBuilder();
  }

  availableStrategies(): string[] {
    return this.registry.names();
  }

  async select(
    input: SelectionInput,
    options: Partial<SelectionOptions> = {},
  ): Promise<SelectionResult> {
    const resolved: SelectionOptions = { ...DEFAULT_SELECTION_OPTIONS, ...options };
    const strategy = this.registry.get(resolved.strategy);
    const selection = await strategy.select(input, resolved);
    const prompt = this.promptBuilder.build(input, selection);
    return { selection, prompt };
  }
}

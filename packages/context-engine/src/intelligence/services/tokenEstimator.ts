import type { TokenEstimate } from "@ai-context-bridge/shared";
import type { ITokenEstimator } from "../interfaces";

export interface TokenEstimatorOptions {
  /** Average characters per token; ~4 is the accepted GPT-family heuristic. */
  charsPerToken: number;
  /** Above this many tokens the estimate is flagged as a warning. */
  warningTokens: number;
  /** Above this many tokens compression is recommended. */
  compressionTokens: number;
}

export const DEFAULT_TOKEN_ESTIMATOR_OPTIONS: TokenEstimatorOptions = {
  charsPerToken: 4,
  warningTokens: 8_000,
  compressionTokens: 16_000,
};

/**
 * Character-count based token estimation. Deliberately simple (no
 * tokenizer, no AI): accurate enough for warning thresholds, free to run
 * on every snapshot. A model-specific tokenizer can replace it through
 * {@link ITokenEstimator}.
 */
export class HeuristicTokenEstimator implements ITokenEstimator {
  constructor(
    private readonly options: TokenEstimatorOptions = DEFAULT_TOKEN_ESTIMATOR_OPTIONS,
  ) {}

  estimate(text: string): TokenEstimate {
    const characters = text.length;
    const estimatedTokens = Math.ceil(characters / this.options.charsPerToken);
    return {
      characters,
      estimatedTokens,
      level:
        estimatedTokens >= this.options.compressionTokens
          ? "compressionRecommended"
          : estimatedTokens >= this.options.warningTokens
            ? "warning"
            : "ok",
    };
  }
}

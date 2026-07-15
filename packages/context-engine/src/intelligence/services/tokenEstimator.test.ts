import { describe, expect, it } from "vitest";
import { HeuristicTokenEstimator } from "./tokenEstimator";

describe("HeuristicTokenEstimator", () => {
  const estimator = new HeuristicTokenEstimator({
    charsPerToken: 4,
    warningTokens: 100,
    compressionTokens: 200,
  });

  it("estimates tokens from character count", () => {
    const estimate = estimator.estimate("x".repeat(402));
    expect(estimate.characters).toBe(402);
    expect(estimate.estimatedTokens).toBe(101); // ceil(402 / 4)
  });

  it("grades levels against thresholds", () => {
    expect(estimator.estimate("x".repeat(100)).level).toBe("ok");
    expect(estimator.estimate("x".repeat(400)).level).toBe("warning");
    expect(estimator.estimate("x".repeat(800)).level).toBe("compressionRecommended");
  });

  it("handles empty input", () => {
    expect(estimator.estimate("")).toEqual({
      characters: 0,
      estimatedTokens: 0,
      level: "ok",
    });
  });
});

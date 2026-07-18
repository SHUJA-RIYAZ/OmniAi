import { describe, expect, it } from "vitest";
import { ContextScorer } from "../scoring/contextScorer";
import { PriorityRanker } from "./priorityRanker";
import { makeInput } from "../testing/fixtures";

const ranker = new PriorityRanker();

function ranked() {
  const input = makeInput();
  const files = ranker.rankFiles(new ContextScorer().scoreFiles(input));
  return { input, files, symbols: ranker.rankSymbols(input, files) };
}

describe("PriorityRanker", () => {
  it("orders files by score with path tiebreaker", () => {
    const { files } = ranked();
    expect(files.map((f) => f.filePath)).toEqual([
      "main.py",
      "database.py", // 90, ties with jwt.py → alphabetical
      "jwt.py",
      "models.py",
      "config.py",
      "changed.py",
      "utils.py",
    ]);
  });

  it("ranks the current function first among symbols", () => {
    const { symbols } = ranked();
    expect(symbols[0]).toMatchObject({ name: "login", score: 100, filePath: "main.py" });
  });

  it("ranks called symbols from related files above ordinary imports", () => {
    const { symbols } = ranked();
    const createToken = symbols.find((s) => s.name === "create_token");
    expect(createToken).toMatchObject({ score: 88, filePath: "jwt.py" });
  });

  it("is stable across runs", () => {
    expect(ranked().symbols).toEqual(ranked().symbols);
  });
});

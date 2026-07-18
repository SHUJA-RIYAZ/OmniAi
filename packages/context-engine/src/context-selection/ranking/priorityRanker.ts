import type { IPriorityRanker } from "../interfaces";
import type { RankedSymbol, ScoredFile, SelectionInput } from "../models";

/**
 * Deterministic ranking (Feature 2). Files sort by score descending with
 * path as tiebreaker (so equal scores never reorder between runs).
 * Symbols come from the current file's analysis plus the symbols recorded
 * on related files: current function first, then functions it calls,
 * then siblings, then classes.
 */
export class PriorityRanker implements IPriorityRanker {
  rankFiles(scored: ScoredFile[]): ScoredFile[] {
    return [...scored].sort(
      (a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath),
    );
  }

  rankSymbols(input: SelectionInput, rankedFiles: ScoredFile[]): RankedSymbol[] {
    const intel = input.snapshot.intelligence;
    const analysis = intel?.fileAnalysis;
    if (!analysis) return [];

    const currentFile =
      intel?.dependencyGraph?.rootFile ??
      rankedFiles.find((f) => f.signals.isCurrent)?.filePath ??
      "";
    const current = intel?.currentFunction;
    const calledNames = new Set((current?.calls ?? []).map((c) => c.name));
    const symbols: RankedSymbol[] = [];

    const push = (
      symbol: Omit<RankedSymbol, "score" | "filePath">,
      score: number,
      filePath: string,
    ) => symbols.push({ ...symbol, score, filePath });

    for (const fn of analysis.functions) {
      const score =
        fn.qualifiedName === current?.qualifiedName ? 100 : calledNames.has(fn.name) ? 90 : 70;
      push(
        {
          ...(fn.id !== undefined ? { id: fn.id } : {}),
          name: fn.qualifiedName,
          kind: "function",
          startLine: fn.startLine,
          endLine: fn.endLine,
        },
        score,
        currentFile,
      );
    }
    for (const cls of analysis.classes) {
      push(
        {
          ...(cls.id !== undefined ? { id: cls.id } : {}),
          name: cls.name,
          kind: "class",
          startLine: cls.startLine,
          endLine: cls.endLine,
        },
        65,
        currentFile,
      );
      for (const method of cls.methods) {
        const score =
          method.qualifiedName === current?.qualifiedName
            ? 100
            : calledNames.has(method.name)
              ? 85
              : 60;
        push(
          {
            ...(method.id !== undefined ? { id: method.id } : {}),
            name: method.qualifiedName,
            kind: "method",
            startLine: method.startLine,
            endLine: method.endLine,
          },
          score,
          currentFile,
        );
      }
    }

    // Symbols that made related files relevant (defined elsewhere).
    for (const related of intel?.relatedFiles ?? []) {
      for (const name of related.symbols ?? []) {
        push(
          { name, kind: "function", startLine: 0, endLine: 0 },
          related.reason === "calls" ? 88 : 68,
          related.filePath,
        );
      }
    }

    return symbols.sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.filePath.localeCompare(b.filePath),
    );
  }
}

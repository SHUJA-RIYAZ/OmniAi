import type { DependencyGraphData } from "@ai-context-bridge/shared";
import type { IContextScorer } from "../interfaces";
import type { ScoredFile, ScoreSignals, SelectionInput } from "../models";

/**
 * Weight profile for scoring. Strategies are expressed as different
 * profiles over this single deterministic scorer — no per-strategy logic.
 */
export interface ScoringWeights {
  /** Score of the current file. */
  current: number;
  /** Base score of a file the current function calls into. */
  called: number;
  /** Base score of a depth-1 import. */
  imported: number;
  /** Score lost per additional import-graph depth level. */
  depthDecay: number;
  /** Added per diagnostic in the file (capped at 3 diagnostics). */
  diagnosticBoost: number;
  /** Added when the file appears in the git diff. */
  gitBoost: number;
}

export const HYBRID_WEIGHTS: ScoringWeights = {
  current: 100,
  called: 90,
  imported: 75,
  depthDecay: 15,
  diagnosticBoost: 5,
  gitBoost: 10,
};

/**
 * Deterministic 0–100 relevance scoring (Feature 1). Inputs come entirely
 * from the Phase 2 snapshot: dependency graph (with call edges), related
 * files, diagnostics, and git diff. Same snapshot → same scores.
 */
export class ContextScorer implements IContextScorer {
  constructor(private readonly weights: ScoringWeights = HYBRID_WEIGHTS) {}

  scoreFiles(input: SelectionInput): ScoredFile[] {
    const intel = input.snapshot.intelligence;
    const currentFile = intel?.dependencyGraph?.rootFile ?? this.activeFilePath(input);
    const depths = graphDepths(intel?.dependencyGraph, currentFile);
    const calledFiles = new Set(
      (intel?.dependencyGraph?.edges ?? [])
        .filter((e) => e.type === "call" && e.from === currentFile)
        .map((e) => e.to),
    );
    for (const related of intel?.relatedFiles ?? []) {
      if (related.reason === "calls") calledFiles.add(related.filePath);
    }

    const diagnosticCounts = new Map<string, number>();
    for (const d of input.snapshot.diagnostics) {
      diagnosticCounts.set(d.filePath, (diagnosticCounts.get(d.filePath) ?? 0) + 1);
    }
    const gitFiles = parseDiffFiles(input.snapshot.gitDiff?.diff);

    const universe = new Set<string>([
      ...(currentFile ? [currentFile] : []),
      ...(intel?.dependencyGraph?.files ?? []),
      ...(intel?.relatedFiles.map((r) => r.filePath) ?? []),
      ...diagnosticCounts.keys(),
      ...gitFiles,
    ]);

    const scored: ScoredFile[] = [];
    for (const filePath of universe) {
      const signals: ScoreSignals = {
        isCurrent: filePath === currentFile,
        ...(depths.has(filePath) ? { importDepth: depths.get(filePath) as number } : {}),
        calledFromCurrent: calledFiles.has(filePath),
        diagnosticCount: diagnosticCounts.get(filePath) ?? 0,
        inGitDiff: gitFiles.has(filePath),
      };
      scored.push({ filePath, score: this.score(signals), signals });
    }
    return scored;
  }

  private score(signals: ScoreSignals): number {
    const w = this.weights;
    let base = 0;
    if (signals.isCurrent) {
      base = w.current;
    } else if (signals.calledFromCurrent) {
      base = w.called;
    } else if (signals.importDepth !== undefined && signals.importDepth >= 1) {
      base = Math.max(0, w.imported - w.depthDecay * (signals.importDepth - 1));
    }
    const boosts =
      w.diagnosticBoost * Math.min(signals.diagnosticCount, 3) +
      (signals.inGitDiff ? w.gitBoost : 0);
    return Math.max(0, Math.min(100, base + boosts));
  }

  private activeFilePath(input: SelectionInput): string | undefined {
    return input.snapshot.activeFile?.filePath.replace(/\\/g, "/");
  }
}

/** BFS depths over import-type edges from the root (root = 0). */
export function graphDepths(
  graph: DependencyGraphData | undefined,
  rootFile: string | undefined,
): Map<string, number> {
  const depths = new Map<string, number>();
  if (!graph || !rootFile) return depths;

  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type !== undefined && edge.type !== "import") continue;
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }

  depths.set(rootFile, 0);
  let frontier = [rootFile];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const file of frontier) {
      for (const target of adjacency.get(file) ?? []) {
        if (!depths.has(target)) {
          depths.set(target, (depths.get(file) as number) + 1);
          next.push(target);
        }
      }
    }
    frontier = next;
  }
  return depths;
}

/** Extracts b/-side paths from a unified git diff. */
export function parseDiffFiles(diff: string | undefined): Set<string> {
  const files = new Set<string>();
  if (!diff) return files;
  for (const match of diff.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)) {
    files.add(match[2] as string);
  }
  return files;
}

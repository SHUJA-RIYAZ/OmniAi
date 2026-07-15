import type { FileAnalysis, FunctionInfo } from "@ai-context-bridge/shared";

/**
 * Pure symbol lookup over a {@link FileAnalysis}. Language-independent:
 * it only relies on line ranges, which every analyzer must provide.
 */

/** All functions in a file, flattened: top-level functions plus class methods. */
export function allFunctions(analysis: FileAnalysis): FunctionInfo[] {
  return [...analysis.functions, ...analysis.classes.flatMap((c) => c.methods)];
}

/**
 * The innermost function containing the (1-based) cursor line, or undefined
 * when the cursor is at module level. "Innermost" = smallest line span, so
 * a method wins over a class-sized range.
 */
export function findEnclosingFunction(
  analysis: FileAnalysis,
  cursorLine: number,
): FunctionInfo | undefined {
  let best: FunctionInfo | undefined;
  for (const fn of allFunctions(analysis)) {
    if (cursorLine < fn.startLine || cursorLine > fn.endLine) continue;
    if (!best || fn.endLine - fn.startLine < best.endLine - best.startLine) {
      best = fn;
    }
  }
  return best;
}

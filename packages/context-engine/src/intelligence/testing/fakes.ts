import type { FileAnalysis, FunctionInfo } from "@ai-context-bridge/shared";
import type { ILanguageAnalyzer } from "../interfaces";

/** Builds a FileAnalysis with sensible empty defaults. */
export function makeAnalysis(partial: Partial<FileAnalysis> = {}): FileAnalysis {
  return { language: "python", imports: [], functions: [], classes: [], ...partial };
}

/** Builds a FunctionInfo with sensible empty defaults. */
export function makeFunction(partial: Partial<FunctionInfo> & { name: string }): FunctionInfo {
  return {
    qualifiedName: partial.name,
    args: [],
    decorators: [],
    startLine: 1,
    endLine: 1,
    calls: [],
    raises: [],
    nestedFunctions: [],
    isMethod: false,
    ...partial,
  };
}

/**
 * `ILanguageAnalyzer` that returns canned analyses keyed by exact source
 * text. Unknown source throws, like a real parser on garbage input.
 */
export class FakeAnalyzer implements ILanguageAnalyzer {
  constructor(private readonly bySource: Map<string, FileAnalysis>) {}

  supports(languageId: string): boolean {
    return languageId === "python";
  }

  async analyze(source: string, _languageId: string): Promise<FileAnalysis> {
    const analysis = this.bySource.get(source);
    if (!analysis) throw new Error("FakeAnalyzer: unknown source");
    return analysis;
  }
}

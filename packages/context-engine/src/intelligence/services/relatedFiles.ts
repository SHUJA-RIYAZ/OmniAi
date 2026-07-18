import type { FileAnalysis, FunctionInfo, RelatedFile } from "@ai-context-bridge/shared";
import type { IFileSystem, ILanguageAnalyzer, IModuleResolver } from "../interfaces";
import { allFunctions } from "../symbols/symbolLocator";

/**
 * Picks the files most relevant to the current cursor position:
 * the current file, then imported files that define functions the current
 * function calls (reason "calls"), then remaining imports — capped at
 * `maxRelatedFiles` so context stays small.
 */
export class RelatedFileDiscovery {
  constructor(
    private readonly analyzer: ILanguageAnalyzer,
    private readonly resolver: IModuleResolver,
    private readonly fs: IFileSystem,
  ) {}

  async discover(
    currentFile: string,
    languageId: string,
    analysis: FileAnalysis,
    currentFunction: FunctionInfo | undefined,
    maxRelatedFiles: number,
  ): Promise<RelatedFile[]> {
    // file → imported names that made it relevant.
    const importedSymbols = new Map<string, string[]>();
    for (const imp of analysis.imports) {
      for (const file of await this.resolver.resolve(imp, currentFile)) {
        if (file === currentFile) continue;
        const symbols = importedSymbols.get(file) ?? [];
        symbols.push(...imp.names.map((n) => n.name));
        importedSymbols.set(file, symbols);
      }
    }

    const callTargets = currentFunction
      ? new Set(currentFunction.calls.map((c) => c.name))
      : new Set<string>();

    const callFiles = new Map<string, string[]>(); // file → called symbols defined there
    const otherFiles: string[] = [];
    for (const file of importedSymbols.keys()) {
      const defined =
        callTargets.size > 0 ? await this.definedCalls(file, languageId, callTargets) : [];
      if (defined.length > 0) {
        callFiles.set(file, defined);
      } else {
        otherFiles.push(file);
      }
    }

    const related: RelatedFile[] = [
      { filePath: currentFile, reason: "current", priority: 100, depth: 0 },
    ];
    // Call-defining files first (95, 94, …), then plain imports (80, 79, …).
    let priority = 95;
    for (const [file, symbols] of callFiles) {
      if (related.length >= maxRelatedFiles) break;
      related.push({ filePath: file, reason: "calls", priority: priority--, depth: 1, symbols });
    }
    priority = 80;
    for (const file of otherFiles) {
      if (related.length >= maxRelatedFiles) break;
      const symbols = dedupe(importedSymbols.get(file) ?? []);
      related.push({
        filePath: file,
        reason: "imported",
        priority: priority--,
        depth: 1,
        ...(symbols.length > 0 ? { symbols } : {}),
      });
    }
    return related;
  }

  /** Called-function names that `file` actually defines; empty on any failure. */
  private async definedCalls(
    file: string,
    languageId: string,
    names: Set<string>,
  ): Promise<string[]> {
    const source = await this.fs.readFile(file);
    if (source === undefined) return [];
    try {
      const analysis = await this.analyzer.analyze(source, languageId, file);
      return dedupe(
        allFunctions(analysis)
          .filter((fn) => names.has(fn.name))
          .map((fn) => fn.name),
      );
    } catch {
      return [];
    }
  }
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

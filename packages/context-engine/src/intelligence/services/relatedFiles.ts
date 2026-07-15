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
    const imported: string[] = [];
    for (const imp of analysis.imports) {
      for (const file of await this.resolver.resolve(imp, currentFile)) {
        if (file !== currentFile && !imported.includes(file)) imported.push(file);
      }
    }

    const callTargets = currentFunction
      ? new Set(currentFunction.calls.map((c) => c.split(".").pop() as string))
      : new Set<string>();

    const callFiles: string[] = [];
    const otherFiles: string[] = [];
    for (const file of imported) {
      if (callTargets.size > 0 && (await this.definesAnyOf(file, languageId, callTargets))) {
        callFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }

    const related: RelatedFile[] = [{ filePath: currentFile, reason: "current" }];
    for (const file of callFiles) {
      if (related.length >= maxRelatedFiles) break;
      related.push({ filePath: file, reason: "calls" });
    }
    for (const file of otherFiles) {
      if (related.length >= maxRelatedFiles) break;
      related.push({ filePath: file, reason: "imported" });
    }
    return related;
  }

  private async definesAnyOf(
    file: string,
    languageId: string,
    names: Set<string>,
  ): Promise<boolean> {
    const source = await this.fs.readFile(file);
    if (source === undefined) return false;
    try {
      const analysis = await this.analyzer.analyze(source, languageId);
      return allFunctions(analysis).some((fn) => names.has(fn.name));
    } catch {
      return false;
    }
  }
}

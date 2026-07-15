import type { ImportInfo } from "@ai-context-bridge/shared";
import type { IFileSystem, IModuleResolver } from "../interfaces";
import { ascend, dirname, join } from "./paths";

/**
 * Resolves Python imports to workspace files.
 *
 * Handles absolute imports rooted at the workspace (and optional extra
 * source roots such as "src"), relative imports (`from ..pkg import x`),
 * packages (`__init__.py`), and `from module import submodule` where the
 * imported name is itself a module. Third-party imports resolve to nothing,
 * which is exactly what the dependency graph wants.
 */
export class PythonModuleResolver implements IModuleResolver {
  constructor(
    private readonly fs: IFileSystem,
    /** Directories treated as import roots, in priority order. */
    private readonly sourceRoots: string[] = ["", "src"],
  ) {}

  supports(languageId: string): boolean {
    return languageId === "python";
  }

  async resolve(imp: ImportInfo, importerPath: string): Promise<string[]> {
    const modulePath = imp.module.split(".").filter(Boolean).join("/");
    const bases = imp.isRelative
      ? [join(ascend(dirname(importerPath), imp.level - 1), modulePath)]
      : this.sourceRoots.map((root) => join(root, modulePath));

    const results: string[] = [];
    for (const base of bases) {
      await this.addIfModule(base, results);
      // `from a.b import c` where c is a module, not a symbol.
      for (const name of imp.names) {
        await this.addIfModule(join(base, name.name), results);
      }
    }
    return [...new Set(results)];
  }

  private async addIfModule(base: string, results: string[]): Promise<void> {
    if (!base) return;
    for (const candidate of [`${base}.py`, join(base, "__init__.py")]) {
      if (await this.fs.exists(candidate)) {
        results.push(candidate);
        return;
      }
    }
  }
}

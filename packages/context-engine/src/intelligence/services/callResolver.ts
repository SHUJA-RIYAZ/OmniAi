import type {
  ClassInfo,
  DependencyEdge,
  FileAnalysis,
  FunctionInfo,
} from "@ai-context-bridge/shared";
import type { IModuleResolver } from "../interfaces";

/** Result of resolving a file's calls against the workspace. */
export interface CallResolution {
  /** module name → workspace files it resolved to (empty = third-party). */
  moduleFiles: Map<string, string[]>;
  /** Extra typed edges (call/inherits) discovered from the analysis. */
  edges: DependencyEdge[];
}

/**
 * Second-pass call classification. The single-file analyzer marks calls it
 * cannot place as `unknown`; this service settles them using module
 * resolution: module resolves to a workspace file → `workspace` +
 * `resolved`, otherwise → `thirdparty`. Also derives `call` and `inherits`
 * graph edges for visualization.
 *
 * Mutates the given analysis in place (it is this build's private copy).
 */
export class CallResolver {
  constructor(private readonly resolver: IModuleResolver) {}

  async resolve(analysis: FileAnalysis, importerPath: string): Promise<CallResolution> {
    const moduleFiles = new Map<string, string[]>();
    const importedNameToFiles = new Map<string, string[]>();

    for (const imp of analysis.imports) {
      const files = await this.resolver.resolve(imp, importerPath);
      moduleFiles.set(imp.module, files);
      for (const name of imp.names) {
        importedNameToFiles.set(name.alias ?? name.name, files);
      }
    }

    const edges: DependencyEdge[] = [];
    const edgeKeys = new Set<string>();
    const addEdge = (to: string, type: "call" | "inherits") => {
      const key = `${type}:${importerPath}→${to}`;
      if (to !== importerPath && !edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push({ from: importerPath, to, type });
      }
    };

    const refine = (fn: FunctionInfo) => {
      for (const call of fn.calls) {
        if (call.module === undefined || call.type === "local" || call.type === "builtin") {
          continue;
        }
        const files = moduleFiles.get(call.module) ?? [];
        if (files.length > 0) {
          call.type = "workspace";
          call.resolved = true;
          for (const file of files) addEdge(file, "call");
        } else if (call.type === "unknown") {
          call.type = "thirdparty";
        }
      }
    };

    const inheritEdges = (cls: ClassInfo) => {
      for (const base of cls.baseClasses) {
        const files = importedNameToFiles.get(base.split(".")[0] as string) ?? [];
        for (const file of files) addEdge(file, "inherits");
      }
    };

    analysis.functions.forEach(refine);
    for (const cls of analysis.classes) {
      cls.methods.forEach(refine);
      inheritEdges(cls);
    }

    return { moduleFiles, edges };
  }
}

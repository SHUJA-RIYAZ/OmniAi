import type { DependencyEdge, DependencyGraphData } from "@ai-context-bridge/shared";
import type { IFileSystem, ILanguageAnalyzer, IModuleResolver } from "../interfaces";

/** Iterative three-color DFS cycle check over directed edges. */
export function hasCycle(edges: DependencyEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();

  for (const start of adjacency.keys()) {
    if ((color.get(start) ?? WHITE) !== WHITE) continue;
    const stack: Array<{ node: string; index: number }> = [{ node: start, index: 0 }];
    color.set(start, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as { node: string; index: number };
      const neighbors = adjacency.get(frame.node) ?? [];
      if (frame.index < neighbors.length) {
        const next = neighbors[frame.index++] as string;
        const c = color.get(next) ?? WHITE;
        if (c === GRAY) return true;
        if (c === WHITE) {
          color.set(next, GRAY);
          stack.push({ node: next, index: 0 });
        }
      } else {
        color.set(frame.node, BLACK);
        stack.pop();
      }
    }
  }
  return false;
}

/**
 * Builds the transitive import graph of a file via breadth-first traversal:
 * root → imported files → their imports → … up to `maxDepth` levels.
 *
 * Cycle-safe (visited set) and failure-tolerant: files that cannot be read
 * or parsed become leaf nodes instead of failing the graph.
 */
export class DependencyGraphBuilder {
  constructor(
    private readonly analyzer: ILanguageAnalyzer,
    private readonly resolver: IModuleResolver,
    private readonly fs: IFileSystem,
  ) {}

  async build(
    rootFile: string,
    languageId: string,
    maxDepth: number,
  ): Promise<DependencyGraphData> {
    const files = new Set<string>([rootFile]);
    const edges: DependencyEdge[] = [];
    const edgeKeys = new Set<string>();
    let frontier = [rootFile];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const file of frontier) {
        const targets = await this.importsOf(file, languageId);
        for (const target of targets) {
          const key = `${file}→${target}`;
          if (!edgeKeys.has(key) && target !== file) {
            edgeKeys.add(key);
            edges.push({ from: file, to: target, type: "import" });
          }
          if (!files.has(target)) {
            files.add(target);
            next.push(target);
          }
        }
      }
      frontier = next;
    }

    // Truncated only if a frontier file actually imports something unvisited —
    // reaching maxDepth with nothing left to discover is a complete graph.
    let truncated = false;
    for (const file of frontier) {
      const targets = await this.importsOf(file, languageId);
      if (targets.some((t) => !files.has(t))) {
        truncated = true;
        break;
      }
    }

    return {
      rootFile,
      files: [...files],
      edges,
      maxDepth,
      truncated,
      nodes: [...files].map((f) => ({ id: f, filePath: f, kind: "file" as const })),
      hasCycles: hasCycle(edges),
    };
  }

  /** Workspace files directly imported by `file`; empty on any failure. */
  async importsOf(file: string, languageId: string): Promise<string[]> {
    const source = await this.fs.readFile(file);
    if (source === undefined) return [];
    try {
      const analysis = await this.analyzer.analyze(source, languageId, file);
      const resolved: string[] = [];
      for (const imp of analysis.imports) {
        resolved.push(...(await this.resolver.resolve(imp, file)));
      }
      return [...new Set(resolved)];
    } catch {
      return [];
    }
  }
}

import type {
  FeatureFlagReader,
  IntelligenceContext,
  IntelligenceWarning,
  PerformanceMetrics,
} from "@ai-context-bridge/shared";
import type {
  IContextBuilder,
  IFileSystem,
  ILanguageAnalyzer,
  IModuleResolver,
  ITokenEstimator,
  IWorkspaceSummarizer,
} from "../interfaces";
import type { IntelligenceInput, IntelligenceOptions } from "../models";
import { DEFAULT_INTELLIGENCE_OPTIONS } from "../models";
import { CachedAnalyzer } from "../cache/analysisCache";
import { DependencyGraphBuilder } from "../dependency/graphBuilder";
import { CallResolver } from "./callResolver";
import { RelatedFileDiscovery } from "./relatedFiles";
import { buildCursorContext, findEnclosingFunction } from "../symbols/symbolLocator";

/** Everything the builder needs, injected so each piece is replaceable and testable. */
export interface IntelligenceBuilderDeps {
  analyzer: ILanguageAnalyzer;
  resolver: IModuleResolver;
  fs: IFileSystem;
  summarizer: IWorkspaceSummarizer;
  estimator: ITokenEstimator;
  flags: FeatureFlagReader;
  /** Optional overrides; defaults are composed from the ports above. */
  graphBuilder?: DependencyGraphBuilder;
  relatedFiles?: RelatedFileDiscovery;
  callResolver?: CallResolver;
}

/**
 * Orchestrates the intelligence pipeline into one {@link IntelligenceContext}:
 * file analysis + current function + cursor (flag `engine.astParsing`),
 * call resolution, dependency graph + related files (flag
 * `engine.dependencyGraph`), workspace summary (always), token estimate
 * (flag `engine.tokenEstimation`).
 *
 * Every step degrades independently and reports an
 * {@link IntelligenceWarning} instead of throwing. Per-phase timings and
 * cache statistics land in {@link PerformanceMetrics}.
 */
export class IntelligenceContextBuilder implements IContextBuilder<IntelligenceInput> {
  private readonly graphBuilder: DependencyGraphBuilder;
  private readonly relatedFiles: RelatedFileDiscovery;
  private readonly callResolver: CallResolver;

  constructor(
    private readonly deps: IntelligenceBuilderDeps,
    private readonly options: IntelligenceOptions = DEFAULT_INTELLIGENCE_OPTIONS,
  ) {
    this.graphBuilder =
      deps.graphBuilder ?? new DependencyGraphBuilder(deps.analyzer, deps.resolver, deps.fs);
    this.relatedFiles =
      deps.relatedFiles ?? new RelatedFileDiscovery(deps.analyzer, deps.resolver, deps.fs);
    this.callResolver = deps.callResolver ?? new CallResolver(deps.resolver);
  }

  async build(input: IntelligenceInput): Promise<IntelligenceContext> {
    const started = Date.now();
    const { analyzer, summarizer, estimator, flags } = this.deps;
    const cachedAnalyzer = analyzer instanceof CachedAnalyzer ? analyzer : undefined;
    cachedAnalyzer?.resetStats();

    const context: IntelligenceContext = { relatedFiles: [] };
    const warnings: IntelligenceWarning[] = [];
    let parseTimeMs = 0;
    let dependencyTimeMs = 0;

    // Phase 1: parse the active file (flag: engine.astParsing).
    if (flags.isEnabled("engine.astParsing")) {
      if (!analyzer.supports(input.languageId)) {
        warnings.push({
          code: "unsupported-language",
          message: `No analyzer for language "${input.languageId}"; sending base context only.`,
        });
      } else {
        const parseStart = Date.now();
        try {
          const analysis = await analyzer.analyze(input.source, input.languageId, input.filePath);
          context.fileAnalysis = analysis;
          if (input.cursorLine !== undefined) {
            const fn = findEnclosingFunction(analysis, input.cursorLine);
            if (fn) context.currentFunction = fn;
            context.cursor = buildCursorContext(
              analysis,
              input.cursorLine,
              input.cursorColumn ?? 1,
              input.selectionLength ?? 0,
            );
          }
        } catch (err) {
          warnings.push({
            code: this.isNetworkError(err) ? "bridge-unreachable" : "parse-failed",
            message: err instanceof Error ? err.message : String(err),
          });
        }
        parseTimeMs = Date.now() - parseStart;
      }
    }

    // Phase 2: dependencies (flag: engine.dependencyGraph).
    if (context.fileAnalysis && flags.isEnabled("engine.dependencyGraph")) {
      const depStart = Date.now();
      try {
        const resolution = await this.callResolver.resolve(context.fileAnalysis, input.filePath);
        const graph = await this.graphBuilder.build(
          input.filePath,
          input.languageId,
          this.options.maxDepth,
        );
        graph.edges = [...graph.edges, ...resolution.edges];
        context.dependencyGraph = graph;
        if (graph.hasCycles) {
          warnings.push({
            code: "cyclic-dependency",
            message: `Import cycle detected in the dependency graph of ${input.filePath}.`,
          });
        }
        context.relatedFiles = await this.relatedFiles.discover(
          input.filePath,
          input.languageId,
          context.fileAnalysis,
          context.currentFunction,
          this.options.maxRelatedFiles,
        );
      } catch (err) {
        warnings.push({
          code: "missing-file",
          message: `Dependency analysis failed: ${err instanceof Error ? err.message : err}`,
        });
      }
      dependencyTimeMs = Date.now() - depStart;
    }

    // Phase 3: workspace summary (metadata-only, always on).
    try {
      context.workspaceSummary = await summarizer.summarize(input.workspaceLanguages);
    } catch (err) {
      warnings.push({
        code: "summary-failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }

    // Phase 4: token estimate (flag: engine.tokenEstimation).
    if (flags.isEnabled("engine.tokenEstimation") && input.estimateTarget !== undefined) {
      context.tokenEstimate = estimator.estimate(input.estimateTarget);
    }

    if (warnings.length > 0) context.warnings = warnings;

    const totalTimeMs = Date.now() - started;
    context.metrics = this.metrics(parseTimeMs, dependencyTimeMs, totalTimeMs, cachedAnalyzer);
    context.collectionTimeMs = totalTimeMs;
    return context;
  }

  private metrics(
    parseTimeMs: number,
    dependencyTimeMs: number,
    totalTimeMs: number,
    cachedAnalyzer: CachedAnalyzer | undefined,
  ): PerformanceMetrics {
    const stats = cachedAnalyzer?.stats() ?? { hits: 0, misses: 0 };
    const requests = stats.hits + stats.misses;
    const memory = this.memoryUsageMb();
    return {
      parseTimeMs,
      dependencyTimeMs,
      contextBuildTimeMs: totalTimeMs - parseTimeMs - dependencyTimeMs,
      totalTimeMs,
      filesParsed: stats.misses,
      filesCached: stats.hits,
      cacheHitRate: requests > 0 ? stats.hits / requests : 0,
      ...(memory !== undefined ? { memoryUsageMb: memory } : {}),
    };
  }

  private memoryUsageMb(): number | undefined {
    const usage = (
      globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }
    ).process?.memoryUsage?.();
    return usage ? Math.round((usage.heapUsed / 1024 / 1024) * 10) / 10 : undefined;
  }

  private isNetworkError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /fetch|network|ECONNREFUSED|timeout|abort/i.test(message);
  }
}

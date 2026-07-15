import type { FeatureFlagReader, IntelligenceContext } from "@ai-context-bridge/shared";
import type {
  IFileSystem,
  ILanguageAnalyzer,
  IModuleResolver,
  ITokenEstimator,
  IWorkspaceSummarizer,
} from "../interfaces";
import type { IntelligenceInput, IntelligenceOptions } from "../models";
import { DEFAULT_INTELLIGENCE_OPTIONS } from "../models";
import { DependencyGraphBuilder } from "../dependency/graphBuilder";
import { RelatedFileDiscovery } from "./relatedFiles";
import { findEnclosingFunction } from "../symbols/symbolLocator";

/** Everything the builder needs, injected so each piece is replaceable and testable. */
export interface IntelligenceBuilderDeps {
  analyzer: ILanguageAnalyzer;
  resolver: IModuleResolver;
  fs: IFileSystem;
  summarizer: IWorkspaceSummarizer;
  estimator: ITokenEstimator;
  flags: FeatureFlagReader;
}

/**
 * Orchestrates Feature 1–9 into one {@link IntelligenceContext}:
 * file analysis + current function (flag `engine.astParsing`), dependency
 * graph + related files (flag `engine.dependencyGraph`), workspace summary
 * (always, it is metadata-only), and token estimate (flag
 * `engine.tokenEstimation`).
 *
 * Every step degrades independently: a failing analyzer or unreachable
 * bridge yields a sparser context, never an exception — mirroring the
 * collector contract of the surrounding context engine.
 */
export class IntelligenceContextBuilder {
  private readonly graphBuilder: DependencyGraphBuilder;
  private readonly relatedFiles: RelatedFileDiscovery;

  constructor(
    private readonly deps: IntelligenceBuilderDeps,
    private readonly options: IntelligenceOptions = DEFAULT_INTELLIGENCE_OPTIONS,
  ) {
    this.graphBuilder = new DependencyGraphBuilder(deps.analyzer, deps.resolver, deps.fs);
    this.relatedFiles = new RelatedFileDiscovery(deps.analyzer, deps.resolver, deps.fs);
  }

  async build(input: IntelligenceInput): Promise<IntelligenceContext> {
    const started = Date.now();
    const { analyzer, summarizer, estimator, flags } = this.deps;
    const context: IntelligenceContext = { relatedFiles: [] };

    const analyzable =
      flags.isEnabled("engine.astParsing") && analyzer.supports(input.languageId);

    if (analyzable) {
      try {
        const analysis = await analyzer.analyze(input.source, input.languageId);
        context.fileAnalysis = analysis;
        if (input.cursorLine !== undefined) {
          const fn = findEnclosingFunction(analysis, input.cursorLine);
          if (fn) context.currentFunction = fn;
        }
      } catch {
        // Unparseable source or unreachable bridge: continue without analysis.
      }
    }

    if (context.fileAnalysis && flags.isEnabled("engine.dependencyGraph")) {
      try {
        context.dependencyGraph = await this.graphBuilder.build(
          input.filePath,
          input.languageId,
          this.options.maxDepth,
        );
        context.relatedFiles = await this.relatedFiles.discover(
          input.filePath,
          input.languageId,
          context.fileAnalysis,
          context.currentFunction,
          this.options.maxRelatedFiles,
        );
      } catch {
        // Graph is optional enrichment.
      }
    }

    try {
      context.workspaceSummary = await summarizer.summarize(input.workspaceLanguages);
    } catch {
      // Summary is optional enrichment.
    }

    if (flags.isEnabled("engine.tokenEstimation") && input.estimateTarget !== undefined) {
      context.tokenEstimate = estimator.estimate(input.estimateTarget);
    }

    context.collectionTimeMs = Date.now() - started;
    return context;
  }
}

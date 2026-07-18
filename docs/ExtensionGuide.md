# Extension Guide

How to extend the intelligence engine without touching existing code. All ports live in `packages/context-engine/src/intelligence/interfaces/`; the spec-facing aliases (`LanguageAnalyzer`, `WorkspaceAnalyzer`, `DependencyResolver`, `ContextBuilder`, `TokenEstimator`) are interchangeable with the `I`-prefixed names.

## Add a language (e.g. TypeScript)

1. **Bridge**: add `bridge/analysis/typescript_analyzer.py` (or reuse a TS parser service) producing `FileAnalysis`; register `POST /api/v1/analyze/typescript` in `main.py`.
2. **Client**: add `"typescript"` to `BridgeAnalyzerClient.SUPPORTED`.
3. **Resolution**: implement `IModuleResolver` for the language's import semantics (see `PythonModuleResolver`).
4. Everything else — cursor context, graph, related files, caching, metrics — works unchanged, because it only consumes `FileAnalysis`.

Prefer in-process parsing? Implement `ILanguageAnalyzer` directly (e.g. tree-sitter WASM) and inject it instead of `BridgeAnalyzerClient`; wrap it in `CachedAnalyzer` to keep incremental parsing.

## Add a framework detection

Append one `Detection` entry to the relevant list in `summarizer/workspaceSummarizer.ts` (order = priority; more specific first) and a test. New manifest file → read it in `summarize()` and pass it to `detect`.

## Replace the cache

Implement `IAnalysisCache` (three methods) — e.g. SQLite-backed for cross-session persistence — and pass it to `CachedAnalyzer`. Keying/invalidations stay in the decorator.

## Custom context building

`IntelligenceContextBuilder` accepts optional `graphBuilder`, `relatedFiles`, and `callResolver` overrides in its deps, and itself implements `IContextBuilder<IntelligenceInput>` — swap the whole builder if a host needs a different pipeline.

## Add a snapshot field

1. Add the optional field to `packages/shared/src/intelligence.ts` **and** `bridge/analysis/models.py` (they mirror; API tests catch drift).
2. If the change alters existing field shapes, bump `CURRENT_SCHEMA_VERSION` and append a migration in `shared/src/migration.ts` + a `mode="before"` validator on the Python side.
3. Never remove or repurpose a field — deprecate and leave it.

## Consume the dependency graph (visualization)

`dependencyGraph.nodes` + `edges` are a ready node-link dataset; filter by `edge.type` for import-only vs. call/inheritance views. Treat absent `type` as `"import"`.

# Context Intelligence (Phase 2)

> Phase 2.5 hardening added: rich call graphs, symbol ids, cursor context, typed graph edges/nodes, prioritized related files, incremental parsing with caching, per-phase metrics, warnings, and schema v2 with migrations. See [ContextSchema.md](ContextSchema.md), [DependencyGraph.md](DependencyGraph.md), [Performance.md](Performance.md), and [ExtensionGuide.md](ExtensionGuide.md).

Phase 2 turns raw file dumps into structured project understanding. A snapshot now optionally carries an `intelligence` object:

```jsonc
{
  // ...existing snapshot fields unchanged...
  "intelligence": {
    "currentFunction":  { "qualifiedName": "UserService.create_user", "args": [...], "calls": ["repo.create"] },
    "fileAnalysis":     { "imports": [...], "functions": [...], "classes": [...] },
    "dependencyGraph":  { "rootFile": "app/main.py", "files": [...], "edges": [{"from": "...", "to": "..."}] },
    "relatedFiles":     [ {"filePath": "app/main.py", "reason": "current"}, {"filePath": "app/repo.py", "reason": "calls"} ],
    "workspaceSummary": { "projectType": "backend", "frameworks": {"backend": "FastAPI", "packageManager": "uv"} },
    "tokenEstimate":    { "characters": 48210, "estimatedTokens": 12053, "level": "warning" },
    "collectionTimeMs": 87
  }
}
```

The field is **optional and additive** — every Milestone-1 consumer keeps working.

## Module layout

```
packages/context-engine/src/intelligence/
├── interfaces/    ILanguageAnalyzer · IFileSystem · IModuleResolver · ITokenEstimator · IWorkspaceSummarizer
├── models/        re-exports wire types from shared + engine-local options
├── parser/        BridgeAnalyzerClient (HTTP → bridge AST endpoints)
├── symbols/       findEnclosingFunction / allFunctions (pure, language-independent)
├── dependency/    PythonModuleResolver · DependencyGraphBuilder (BFS, cycle-safe) · path helpers
├── summarizer/    ManifestWorkspaceSummarizer (framework/tooling detection)
├── services/      IntelligenceContextBuilder · RelatedFileDiscovery · HeuristicTokenEstimator
└── testing/       InMemoryFileSystem · FakeAnalyzer · fixture factories (exported for downstream tests)
```

The Python analyzer itself lives in `apps/local-bridge/bridge/analysis/` (see ADR-0005).

## Data flow

```
VS Code command
  └─ ContextAssembler (Milestone 1 collectors, unchanged)
       └─ IntelligenceService.enrich(snapshot)           [vscode-extension: wiring only]
            └─ IntelligenceContextBuilder.build(input)   [context-engine: all logic]
                 ├─ ILanguageAnalyzer.analyze(source)  ──HTTP──▶  POST /api/v1/analyze/python (ast)
                 ├─ findEnclosingFunction(analysis, cursorLine)
                 ├─ DependencyGraphBuilder.build(file, maxDepth)   (analyzer + resolver + fs)
                 ├─ RelatedFileDiscovery.discover(...)             (max 5, calls > imports)
                 ├─ ManifestWorkspaceSummarizer.summarize(...)
                 └─ HeuristicTokenEstimator.estimate(serialized snapshot)
```

## Feature flags & settings

| Setting (`aiContextBridge.*`) | Flag | Default | Gates |
|---|---|---|---|
| `flags.astParsing` | `engine.astParsing` | on | file analysis + current function |
| `flags.dependencyGraph` | `engine.dependencyGraph` | on | dependency graph + related files |
| `flags.tokenEstimation` | `engine.tokenEstimation` | on | token estimate |
| `intelligence.maxDepth` | — | 2 | graph traversal depth |
| `intelligence.maxRelatedFiles` | — | 5 | related-file cap |

## Failure semantics

Same contract as collectors: every intelligence step is independent and non-fatal. Bridge down → no `fileAnalysis`; unparseable file → no graph; missing manifests → sparse summary. The base snapshot always ships.

## Status panel

`AI Context Bridge: Show Status Panel` opens a webview with context size, estimated tokens (color-graded), current function, project type, related files, per-collector status, and intelligence time. The view model and HTML renderer (`status/statusReport.ts`) are pure and unit-tested; the webview class only displays.

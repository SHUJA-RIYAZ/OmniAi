# Roadmap

Each milestone ships behind feature flags (canonical names in `packages/shared/src/featureFlags.ts`), with docs and tests, and is validated before the next begins.

## ✅ Milestone 1 — MVP

- Collect active file, selection, diagnostics, terminal output (opt-in), git diff, workspace metadata
- Local FastAPI bridge with versioned REST API
- Browser extension inserts context into Claude / ChatGPT / Gemini

## ✅ Milestone 2 — Context intelligence (Phase 2, current)

See [intelligence.md](intelligence.md) and ADR-0005.

- `engine.astParsing` — structural analysis (imports, functions, classes, current function) via the bridge's Python `ast` analyzer
- `engine.dependencyGraph` — transitive import graph, configurable depth
- Related-file discovery (current + call-defining + imported, capped)
- Workspace summary (project type, frameworks, database, build tool, package manager)
- `engine.tokenEstimation` — heuristic token estimate with warning/compression thresholds
- Status panel in VS Code

Deferred from the original milestone-2 list: the bridge auth token handshake (still open).

## Milestone 3 — Understanding

- Bridge auth token handshake (close the local-process gap)
- `engine.compression` — token-budgeted context selection
- `engine.semanticSearch` + `engine.embeddings` — local embedding index
- Additional language analyzers (TypeScript/JavaScript) behind `ILanguageAnalyzer`

## Milestone 4 — Orchestration

- `engine.projectMemory` — persistent SQLite store of decisions/history
- `providers.routing` — pick the right provider per task
- `providers.conversationHandoff` — move a conversation between providers
- `browser.automation` — optional auto-submit workflows (explicitly opt-in)

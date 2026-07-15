# Roadmap

Each milestone ships behind feature flags (canonical names in `packages/shared/src/featureFlags.ts`), with docs and tests, and is validated before the next begins.

## ✅ Milestone 1 — MVP (current)

- Collect active file, selection, diagnostics, terminal output (opt-in), git diff, workspace metadata
- Local FastAPI bridge with versioned REST API
- Browser extension inserts context into Claude / ChatGPT / Gemini

## Milestone 2 — Trust & depth

- Bridge auth token handshake (close the local-process gap)
- `engine.tokenEstimation` — token counts per snapshot section
- `engine.astParsing` — tree-sitter based symbol outlines instead of raw file text

## Milestone 3 — Understanding

- `engine.dependencyGraph` — import graph so context can include *related* files
- `engine.compression` — token-budgeted context selection
- `engine.semanticSearch` + `engine.embeddings` — local embedding index

## Milestone 4 — Orchestration

- `engine.projectMemory` — persistent SQLite store of decisions/history
- `providers.routing` — pick the right provider per task
- `providers.conversationHandoff` — move a conversation between providers
- `browser.automation` — optional auto-submit workflows (explicitly opt-in)

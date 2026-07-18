# ADR-0002: Context Intelligence Engine

## Status

Accepted

## Date

2026-07-18

---

## Context

Raw editor state (open file, selection, diagnostics) is not enough for high-quality AI assistance. Developers need related files, current function context, dependency awareness, and workspace structure — without pasting half the repo by hand.

If intelligence logic lived inside the VS Code extension, we could never reuse it from a CLI, JetBrains plugin, or headless collector.

---

## Decision

Isolate all context intelligence in `packages/context-engine`.

Responsibilities:

- Collectors for active file, selection, diagnostics, terminal, git diff
- AST analysis and dependency graph (where enabled)
- Workspace detection and related-file selection
- Current function / cursor context
- Snapshot assembly into `ContextSnapshot`
- Feature-flag gated collection (no hard-wired always-on sources)

The VS Code extension only implements collector ports against the VS Code API and pushes assembled snapshots to the local bridge. The browser extension never re-implements intelligence — it consumes snapshots.

---

## Consequences

### Benefits

- Editor-agnostic core
- Testable without VS Code
- Incremental rollout via feature flags
- Single snapshot schema for all consumers

### Tradeoffs

- Extra package boundary and DI ports
- Intelligence richness depends on language analyzers available in-process / bridge
- Snapshot size must be managed carefully (truncation now; compression later)

---

## Alternatives Considered

1. **Put intelligence inside the VS Code extension.**  
   Rejected — locks the product to one editor.

2. **Run all analysis in the browser extension.**  
   Rejected — no filesystem / workspace access; wrong security boundary.

3. **Ask the remote AI to “figure out” context from a single file.**  
   Rejected — unreliable and wastes the user’s tokens.

---

## Future Notes

Semantic search, embeddings, and project memory will extend `context-engine` behind feature flags. The wire format must remain additive (`schemaVersion` migrations). Browser workflows should keep treating snapshots as opaque inputs to the Prompt Manager.

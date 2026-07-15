# ADR-0005: Language analysis runs in the bridge behind a TS analyzer port

**Status:** accepted · **Date:** 2026-07-15

## Context
Phase 2 needs real ASTs (functions, classes, imports, call sites) starting with Python. The consumers are TypeScript (`context-engine`), and parsing Python well in TS means either shipping native tree-sitter binaries with the VS Code extension or hand-rolling a parser.

## Decision
Parsing runs server-side in the local bridge (`bridge/analysis/`, Python's stdlib `ast`), exposed as `POST /api/v1/analyze/{language}`. The TypeScript side sees only the `ILanguageAnalyzer` port; `BridgeAnalyzerClient` is the HTTP implementation.

## Alternatives considered
- **tree-sitter (WASM/native) in the extension**: offline and multi-language, but adds binary packaging complexity per platform and per language grammar. Deferred, not rejected — it would slot in as another `ILanguageAnalyzer` with zero consumer changes.
- **Regex-based extraction in TS**: cheap but wrong on real code (nested defs, decorators, multiline signatures). Rejected for a "production-quality" bar.

## Consequences
- Intelligence requires the bridge to be running; when it isn't, the builder degrades to a base snapshot (collector contract: enrichment never fails collection).
- Each analyzed file costs one localhost HTTP round trip; graph depth and related-file caps bound the total. Fine at depth ≤ 2–3; revisit with a batch endpoint if profiling says otherwise.
- Adding a language = one analyzer class in the bridge + registering the language id in `BridgeAnalyzerClient.SUPPORTED` + a module resolver implementing `IModuleResolver`.

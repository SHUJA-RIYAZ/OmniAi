# Context Selection (Phase 3)

Deterministically decides **what**, **how much**, and **in what order** context goes to an AI. No AI involved: same snapshot + options → byte-identical prompt.

## Pipeline

```
Phase 2 snapshot (intelligence: graph, calls, diagnostics, git diff)
        │
        ▼
ContextScorer ──── weight profile = strategy ────────── 0–100 per file
        │
        ▼
PriorityRanker ── files (score desc, path tiebreak) ── symbols (current fn → called → siblings)
        │
        ▼
TokenBudgetManager ── greedy fill in rank order, lazy file reads,
        │             representation ladder per file:
        │             full (level none) → compressed → snippet (current) → structural → removed
        ▼
CompressionReport ── original/compressed tokens, ratio, selected/removed, budget left
        │
        ▼
PromptBuilder ── versioned JSON PromptDocument + finalPrompt markdown
```

Dependency expansion (Feature 7) falls out of the design: rank order encodes graph distance (current → called → depth-1 imports → depth-2 …), and the greedy fill simply stops admitting files when the budget runs out.

## Strategies (Feature 9)

All five are **weight profiles over the same pipeline** (`STRATEGY_WEIGHTS` in `selectors/strategies.ts`) — no duplicated logic:

| Strategy | Emphasis |
|---|---|
| `hybrid` (default) | balanced: current 100 / called 90 / imports 75 (−15/depth) / +5 per diagnostic / +10 git |
| `current-file` | only the active file |
| `dependency` | call/import graph, no diagnostics/git boosts |
| `diagnostics` | +30 per diagnostic |
| `git` | +60 for files in the working diff |

`StrategyRegistry` resolves by name (unknown → hybrid) and accepts custom registrations.

## Compression (Features 5–6)

- `CodeCompressor` (text-level, conservative): `light` = trailing whitespace + blank-run collapse + import dedupe; `aggressive` adds comment removal (never on lines containing quotes), unused `from x import y` pruning, >80-char literal shortening, and collapse of collections spanning >10 lines. Indentation and string contents are never altered.
- `StructuralCompressor`: renders a file as a signature skeleton (imports, decorators, `def f(x: int) -> str: ...`, class bases/properties, first docstring lines) from its `FileAnalysis`.

## Determinism guarantees

Scoring is pure arithmetic over snapshot facts; ranking tiebreaks on path; budget fill is greedy in rank order; the prompt renderer has no timestamps or randomness. Covered by byte-equality tests at unit, service, and 10k-file scale.

## Performance (Feature 13)

Scoring/ranking is O(files in the candidate universe) — benchmarked at **60 ms for 10,000 files**; a full selection over the same workspace takes **42 ms** because sources load lazily (only ranked candidates within `maxFiles` are ever read) and parses hit the Phase 2.5 `CachedAnalyzer`.

## VS Code surface (Features 11–12)

Command **AI Context Bridge: Open Context Inspector** — webview showing budget bar, selected files (representation/score/tokens), top symbols, compression stats, selection/collection time, with **Refresh / Copy Prompt / Export JSON**. Settings under `aiContextBridge.selection.*` (maxTokens 4k–32k, strategy, compressionLevel, removeComments, compressWhitespace, maxFiles); depth and related-file caps reuse `aiContextBridge.intelligence.*`. Gated by `aiContextBridge.flags.contextSelection`.

# Performance

## Incremental parsing & caching

`CachedAnalyzer` (`intelligence/cache/analysisCache.ts`) decorates any `ILanguageAnalyzer` with a content-addressed cache:

- Key = `language : path : fnv1a(content)` — any edit changes the hash, so **invalidation is automatic**; there is no invalidation protocol to get wrong. VS Code document versions and mtimes are deliberately not part of the key: content hash subsumes both.
- Store = `InMemoryAnalysisCache`, a bounded LRU (default 500 entries) behind the `IAnalysisCache` port (swap for disk persistence later).
- The VS Code `IntelligenceService` holds one cache for the whole session, so repeated "Send Context" commands only re-parse files that actually changed.

## Metrics

Every build attaches `intelligence.metrics`:

| Field | Meaning |
|---|---|
| `parseTimeMs` | active-file analysis |
| `dependencyTimeMs` | call resolution + graph + related files |
| `contextBuildTimeMs` | everything else (summary, estimate, assembly) |
| `totalTimeMs` | wall clock; equals the sum of the three above |
| `filesParsed` / `filesCached` | cache misses / hits this build |
| `cacheHitRate` | hits ÷ (hits + misses), 0–1 |
| `memoryUsageMb` | heap used (Node hosts only) |

## Benchmark results

`performance.bench.test.ts` builds a synthetic 200-file workspace (10 packages × 20 modules, chained imports, shared fan-in module, one cycle per package) and runs the full pipeline with a line-parsing analyzer (so only the bridge HTTP hop is simulated). Local results (Node 24, Windows):

| Scenario | Result |
|---|---|
| Cold build, 21-file graph, depth 25 | **8 ms**, 21 parsed / 1 cached |
| Warm rebuild (nothing changed) | **1 ms**, cache hit rate 1.00, 0 parsed |
| One file edited | 1 parsed, 21 cached |

CI assertions are intentionally loose (cold < 2 s, warm < 1 s, hit rate > 0.9); the logged numbers are the real measurement.

## Real-world cost model

With the HTTP-backed analyzer each cache miss costs one localhost round trip (~1–3 ms). A cold depth-2 build of a typical module (5–15 reachable files) lands well under 100 ms; warm builds are dominated by the single active-file parse. If profiling ever disagrees, the escape hatches are (in order): batch analyze endpoint, disk-backed `IAnalysisCache`, in-process tree-sitter analyzer — all behind existing ports.

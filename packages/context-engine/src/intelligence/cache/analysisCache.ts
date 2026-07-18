import type { FileAnalysis } from "@ai-context-bridge/shared";
import type { CacheStats, IAnalysisCache, ILanguageAnalyzer } from "../interfaces";

/**
 * FNV-1a content hash. Fast, dependency-free, and stable across sessions —
 * sufficient for cache keying (collisions only cause a stale analysis for
 * one build, never corruption).
 */
export function contentHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Bounded in-memory LRU implementation of {@link IAnalysisCache}. */
export class InMemoryAnalysisCache implements IAnalysisCache {
  private readonly entries = new Map<string, FileAnalysis>();

  constructor(private readonly maxEntries = 500) {}

  get(key: string): FileAnalysis | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      // Refresh recency.
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, analysis: FileAnalysis): void {
    this.entries.delete(key);
    this.entries.set(key, analysis);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * Decorator adding incremental parsing to any {@link ILanguageAnalyzer}:
 * results are keyed by language + path + content hash, so unchanged files
 * are never re-parsed, and any edit (new hash) invalidates automatically —
 * no explicit invalidation protocol needed.
 *
 * Exposes {@link CacheStats} for performance metrics; `resetStats()` scopes
 * the numbers to one build.
 */
export class CachedAnalyzer implements ILanguageAnalyzer {
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly inner: ILanguageAnalyzer,
    private readonly cache: IAnalysisCache = new InMemoryAnalysisCache(),
  ) {}

  supports(languageId: string): boolean {
    return this.inner.supports(languageId);
  }

  async analyze(source: string, languageId: string, path?: string): Promise<FileAnalysis> {
    const key = `${languageId}:${path ?? ""}:${contentHash(source)}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.hits++;
      return cached;
    }
    this.misses++;
    const analysis = await this.inner.analyze(source, languageId, path);
    this.cache.set(key, analysis);
    return analysis;
  }

  stats(): CacheStats {
    return { hits: this.hits, misses: this.misses };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

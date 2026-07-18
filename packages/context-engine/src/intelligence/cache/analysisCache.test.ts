import { describe, expect, it } from "vitest";
import type { FileAnalysis } from "@ai-context-bridge/shared";
import type { ILanguageAnalyzer } from "../interfaces";
import { CachedAnalyzer, InMemoryAnalysisCache, contentHash } from "./analysisCache";
import { makeAnalysis } from "../testing/fakes";

class CountingAnalyzer implements ILanguageAnalyzer {
  parses = 0;
  supports = () => true;
  async analyze(source: string): Promise<FileAnalysis> {
    this.parses++;
    return makeAnalysis({ language: `parsed:${source}` });
  }
}

describe("contentHash", () => {
  it("is deterministic and content-sensitive", () => {
    expect(contentHash("abc")).toBe(contentHash("abc"));
    expect(contentHash("abc")).not.toBe(contentHash("abd"));
    expect(contentHash("")).toBeTypeOf("string");
  });
});

describe("CachedAnalyzer", () => {
  it("parses once per unique content and serves repeats from cache", async () => {
    const inner = new CountingAnalyzer();
    const cached = new CachedAnalyzer(inner);

    await cached.analyze("src-a", "python", "a.py");
    await cached.analyze("src-a", "python", "a.py");
    await cached.analyze("src-a", "python", "a.py");

    expect(inner.parses).toBe(1);
    expect(cached.stats()).toEqual({ hits: 2, misses: 1 });
  });

  it("invalidates automatically when content changes", async () => {
    const inner = new CountingAnalyzer();
    const cached = new CachedAnalyzer(inner);

    await cached.analyze("v1", "python", "a.py");
    await cached.analyze("v2", "python", "a.py"); // edited file
    await cached.analyze("v2", "python", "a.py");

    expect(inner.parses).toBe(2);
    expect(cached.stats()).toEqual({ hits: 1, misses: 2 });
  });

  it("keys by path and language as well as content", async () => {
    const inner = new CountingAnalyzer();
    const cached = new CachedAnalyzer(inner);

    await cached.analyze("same", "python", "a.py");
    await cached.analyze("same", "python", "b.py");

    expect(inner.parses).toBe(2);
  });

  it("resetStats scopes statistics to one build", async () => {
    const cached = new CachedAnalyzer(new CountingAnalyzer());
    await cached.analyze("x", "python");
    cached.resetStats();
    await cached.analyze("x", "python");
    expect(cached.stats()).toEqual({ hits: 1, misses: 0 });
  });

  it("evicts least-recently-used entries beyond capacity", async () => {
    const cache = new InMemoryAnalysisCache(2);
    cache.set("a", makeAnalysis());
    cache.set("b", makeAnalysis());
    cache.get("a"); // refresh a
    cache.set("c", makeAnalysis()); // evicts b

    expect(cache.get("a")).toBeDefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBeDefined();
  });
});

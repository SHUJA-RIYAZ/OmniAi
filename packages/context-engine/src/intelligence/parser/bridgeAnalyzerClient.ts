import type { BridgeResponse, FileAnalysis } from "@ai-context-bridge/shared";
import type { ILanguageAnalyzer } from "../interfaces";

/**
 * `ILanguageAnalyzer` backed by the local bridge's `/api/v1/analyze/*`
 * endpoints, which run real language parsers (Python's `ast` today).
 *
 * Design note (ADR-0005): parsing lives server-side so we get first-class
 * ASTs without shipping native parser binaries. An in-process tree-sitter
 * implementation can replace this class without touching any consumer.
 */
export class BridgeAnalyzerClient implements ILanguageAnalyzer {
  private static readonly SUPPORTED = new Set(["python"]);

  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  supports(languageId: string): boolean {
    return BridgeAnalyzerClient.SUPPORTED.has(languageId);
  }

  async analyze(source: string, languageId: string): Promise<FileAnalysis> {
    if (!this.supports(languageId)) {
      throw new Error(`No analyzer available for language: ${languageId}`);
    }
    const res = await this.fetchFn(`${this.baseUrl}/api/v1/analyze/${languageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, language: languageId }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as BridgeResponse<FileAnalysis>;
    if (!res.ok || !body.ok || !body.data) {
      throw new Error(body.error ?? `Analyzer returned HTTP ${res.status}`);
    }
    return body.data;
  }
}

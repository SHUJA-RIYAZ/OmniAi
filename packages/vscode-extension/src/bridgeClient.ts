import { ENDPOINTS, type BridgeResponse, type ContextSnapshot } from "@ai-context-bridge/shared";

/** Thin HTTP client for the local bridge. Replaceable via this interface. */
export interface BridgeClient {
  isHealthy(): Promise<boolean>;
  pushSnapshot(snapshot: ContextSnapshot): Promise<void>;
}

export class HttpBridgeClient implements BridgeClient {
  constructor(private readonly baseUrl: string) {}

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}${ENDPOINTS.health}`, {
        signal: AbortSignal.timeout(2_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async pushSnapshot(snapshot: ContextSnapshot): Promise<void> {
    const res = await fetch(`${this.baseUrl}${ENDPOINTS.context}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => undefined)) as
        | BridgeResponse<unknown>
        | undefined;
      throw new Error(body?.error ?? `Bridge returned HTTP ${res.status}`);
    }
  }
}

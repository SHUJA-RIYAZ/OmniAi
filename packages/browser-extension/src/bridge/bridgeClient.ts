import {
  ENDPOINTS,
  type BridgeResponse,
  type ContextSnapshot,
} from "@ai-context-bridge/shared";
import { ExtensionError } from "../types/errors";
import { rootLogger } from "../utils/logger";

export interface BridgeHealth {
  status: string;
  version: string;
}

export interface BridgeClient {
  health(): Promise<BridgeHealth>;
  getLatestContext(): Promise<ContextSnapshot>;
  getSnapshot(id: string): Promise<ContextSnapshot>;
  isHealthy(): Promise<boolean>;
}

/**
 * HTTP client for the existing FastAPI bridge. Does not modify the backend —
 * consumes health, latest context, and snapshot-by-id endpoints only.
 */
export class HttpBridgeClient implements BridgeClient {
  private readonly log = rootLogger.child("Bridge");

  constructor(
    private baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch.bind(globalThis),
  ) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, "");
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<BridgeHealth> {
    const body = await this.request<BridgeHealth>(ENDPOINTS.health, {
      timeoutMs: 2_000,
    });
    return body;
  }

  async getLatestContext(): Promise<ContextSnapshot> {
    return this.request<ContextSnapshot>(ENDPOINTS.contextLatest, {
      timeoutMs: 5_000,
      notFoundCode: "NO_CONTEXT",
      notFoundMessage: "No context snapshot available. Push context from VS Code first.",
    });
  }

  async getSnapshot(id: string): Promise<ContextSnapshot> {
    return this.request<ContextSnapshot>(`${ENDPOINTS.context}/${encodeURIComponent(id)}`, {
      timeoutMs: 5_000,
      notFoundCode: "NO_CONTEXT",
      notFoundMessage: `Snapshot ${id} was not found on the bridge.`,
    });
  }

  private async request<T>(
    path: string,
    options: {
      timeoutMs: number;
      notFoundCode?: "NO_CONTEXT";
      notFoundMessage?: string;
    },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    this.log.debug("Request", { url });

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Network error";
      this.log.error("Bridge unreachable", { url, message });
      throw new ExtensionError(
        "BRIDGE_OFFLINE",
        `Bridge unreachable (${message}). Is it running at ${this.baseUrl}?`,
        { url },
      );
    }

    let body: BridgeResponse<T>;
    try {
      body = (await res.json()) as BridgeResponse<T>;
    } catch {
      throw new ExtensionError(
        "BRIDGE_OFFLINE",
        `Bridge returned non-JSON (HTTP ${res.status}).`,
        { url, status: res.status },
      );
    }

    if (res.status === 404 || (body.ok === false && res.status === 404)) {
      throw new ExtensionError(
        options.notFoundCode ?? "NO_CONTEXT",
        body.error ?? options.notFoundMessage ?? "Not found",
        { url, status: res.status },
      );
    }

    if (!res.ok || !body.ok || body.data === undefined) {
      if (res.status >= 500 || res.status === 0) {
        throw new ExtensionError(
          "BRIDGE_OFFLINE",
          body.error ?? `Bridge error (HTTP ${res.status})`,
          { url, status: res.status },
        );
      }
      throw new ExtensionError(
        options.notFoundCode ?? "UNKNOWN",
        body.error ?? `Bridge error (HTTP ${res.status})`,
        { url, status: res.status },
      );
    }

    return body.data;
  }
}

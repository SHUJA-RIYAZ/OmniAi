import type { ProviderAdapter } from "./provider";

/** Registry resolving adapters by id or by page URL. First match wins. */
export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Provider adapter already registered: ${adapter.id}`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  byId(id: string): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  forUrl(url: string): ProviderAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.matchesUrl(url)) return adapter;
    }
    return undefined;
  }

  all(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }
}

import { hostMatches } from "../utils/dom";
import { rootLogger } from "../utils/logger";
import { chatgptDescriptor } from "./chatgptAdapter";
import { claudeDescriptor } from "./claudeAdapter";
import { deepseekDescriptor } from "./deepseekAdapter";
import { geminiDescriptor } from "./geminiAdapter";
import { kimiDescriptor } from "./kimiAdapter";
import { perplexityDescriptor } from "./perplexityAdapter";
import type { AdapterDescriptor, AIAdapter, IAdapterRegistry } from "./types";
import { zaiDescriptor } from "./zaiAdapter";

/**
 * Built-in adapter descriptors. Adding a provider = one adapter file + one entry here.
 * Factories are invoked lazily — adapters are constructed only when selected.
 */
export const BUILTIN_ADAPTERS: readonly AdapterDescriptor[] = [
  chatgptDescriptor,
  claudeDescriptor,
  geminiDescriptor,
  deepseekDescriptor,
  kimiDescriptor,
  perplexityDescriptor,
  zaiDescriptor,
];

/**
 * Resolves the correct AIAdapter for a URL. Never exposes provider-specific
 * logic to callers — managers only receive the AIAdapter abstraction.
 */
export class AdapterRegistry implements IAdapterRegistry {
  private readonly descriptors = new Map<string, AdapterDescriptor>();
  private readonly instances = new Map<string, AIAdapter>();
  private readonly log = rootLogger.child("Provider");

  constructor(descriptors: readonly AdapterDescriptor[] = BUILTIN_ADAPTERS) {
    for (const descriptor of descriptors) {
      this.register(descriptor);
    }
  }

  register(descriptor: AdapterDescriptor): void {
    if (this.descriptors.has(descriptor.id)) {
      throw new Error(`Adapter already registered: ${descriptor.id}`);
    }
    this.descriptors.set(descriptor.id, descriptor);
  }

  /** All registered provider ids (for settings UI / preferred provider). */
  ids(): string[] {
    return [...this.descriptors.keys()];
  }

  list(): readonly AdapterDescriptor[] {
    return [...this.descriptors.values()];
  }

  /** Lazy-load: construct (and cache) the adapter for an id. */
  getById(id: string): AIAdapter | null {
    const cached = this.instances.get(id);
    if (cached) return cached;

    const descriptor = this.descriptors.get(id);
    if (!descriptor) return null;

    this.log.debug("Lazy-loading adapter", { id });
    const instance = descriptor.create();
    this.instances.set(id, instance);
    return instance;
  }

  /**
   * Match a URL to a descriptor without constructing the adapter.
   * Safe to call from the service worker (no DOM).
   */
  describeForUrl(url: string): AdapterDescriptor | null {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return null;
    }

    for (const descriptor of this.descriptors.values()) {
      if (hostMatches(hostname, descriptor.hosts)) {
        return descriptor;
      }
    }
    return null;
  }

  /** Detect provider from URL; lazily constructs the matching adapter. */
  forUrl(url: string): AIAdapter | null {
    const descriptor = this.describeForUrl(url);
    if (!descriptor) return null;
    return this.getById(descriptor.id);
  }

  /** True if any registered adapter claims this URL. */
  isSupportedUrl(url: string): boolean {
    return this.describeForUrl(url) != null;
  }

  /** Host match patterns suitable for chrome.tabs / content_scripts. */
  matchPatterns(): string[] {
    const patterns = new Set<string>();
    for (const descriptor of this.descriptors.values()) {
      for (const host of descriptor.hosts) {
        patterns.add(`https://${host}/*`);
        patterns.add(`https://*.${host}/*`);
      }
    }
    return [...patterns];
  }
}

/** Default singleton used by content script / tests can construct their own. */
export const defaultAdapterRegistry = new AdapterRegistry();

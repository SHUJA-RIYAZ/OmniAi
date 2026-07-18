import { AdapterRegistry, BUILTIN_ADAPTERS } from "../adapters/registry";
import { HttpBridgeClient } from "../bridge/bridgeClient";
import { ConversationManager } from "../conversation/conversationManager";
import { eventBus } from "../events/eventBus";
import { ExtensionEvents } from "../events/events";
import { featureFlags } from "../features/featureFlags";
import { PromptManager } from "../prompt/promptManager";
import { ContentOrchestratorPort } from "../providerManager/contentPort";
import { SettingsService } from "../services/settingsService";
import { telemetry } from "../telemetry/telemetry";
import { ExtensionError, isExtensionError, toErrorMessage } from "../types/errors";
import type {
  BridgeStatus,
  ExtensionMessage,
  ExtensionStatus,
  MessageResult,
} from "../types/messages";
import type { ProviderInfo } from "../types/provider";
import { rootLogger } from "../utils/logger";
import { createWorkflowEngine } from "../workflow/createEngine";
import type { CopyContextResult, SendContextResult } from "../types/messages";

const log = rootLogger.child("Background");

const settingsService = new SettingsService();
const conversations = new ConversationManager();
const promptManager = new PromptManager();
const contentPort = new ContentOrchestratorPort();
/** URL detection only — no DOM adapters constructed in the service worker. */
const urlRegistry = new AdapterRegistry(BUILTIN_ADAPTERS);

let bridge = new HttpBridgeClient("http://127.0.0.1:8765");
let activeTabId: number | null = null;
let cachedProvider: ProviderInfo | null = null;

const workflow = createWorkflowEngine({
  get bridge() {
    return bridge;
  },
  promptManager,
  contentPort,
  conversations,
  getSettings: () => settingsService.get(),
  events: eventBus,
  telemetry,
  features: featureFlags,
});

async function boot(): Promise<void> {
  const settings = await settingsService.init();
  bridge = new HttpBridgeClient(settings.bridgeUrl);
  rootLogger.setDebugMode(settings.debugMode);
  log.info("Background worker ready", { bridgeUrl: settings.bridgeUrl });
}

const bootPromise = boot();

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function detectProviderFromUrl(url: string | undefined): ProviderInfo | null {
  if (!url) return null;
  const descriptor = urlRegistry.describeForUrl(url);
  if (!descriptor) return null;
  return {
    id: descriptor.id,
    displayName: descriptor.displayName,
    url,
    isChatPage: true,
    supportsFileUpload: descriptor.capabilities.fileUpload,
    capabilities: descriptor.capabilities,
  };
}

async function refreshBridgeStatus(): Promise<BridgeStatus> {
  try {
    const health = await bridge.health();
    eventBus.emit(ExtensionEvents.BRIDGE_ONLINE, {
      url: settingsService.get().bridgeUrl,
      version: health.version,
    });
    return { online: true, version: health.version };
  } catch (err) {
    const error = toErrorMessage(err);
    eventBus.emit(ExtensionEvents.BRIDGE_OFFLINE, {
      url: settingsService.get().bridgeUrl,
      error,
    });
    return {
      online: false,
      error,
    };
  }
}

async function buildStatus(): Promise<ExtensionStatus> {
  await bootPromise;
  const tab = await getActiveTab();
  activeTabId = tab?.id ?? null;

  const bridgeStatus = await refreshBridgeStatus();
  let projectName: string | null = null;
  let snapshotId: string | null = null;

  if (bridgeStatus.online) {
    try {
      const latest = await bridge.getLatestContext();
      projectName = latest.workspace.name;
      snapshotId = latest.id;
    } catch {
      // No snapshot yet is not a hard failure for status.
    }
  }

  let provider = detectProviderFromUrl(tab?.url);
  if (tab?.id != null && provider) {
    try {
      const live = await contentPort.detectProvider(tab.id);
      if (live.provider) provider = live.provider;
    } catch {
      // Content script may not be injected yet; URL detection is enough for UI.
    }
  }
  cachedProvider = provider;

  const conversation =
    tab?.id != null ? await conversations.getForTab(tab.id) : null;

  return {
    bridge: bridgeStatus,
    provider,
    projectName,
    snapshotId,
    conversation,
    settings: settingsService.get(),
    tabUrl: tab?.url ?? null,
  };
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  await bootPromise;

  switch (message.type) {
    case "GET_STATUS":
    case "REFRESH_STATUS": {
      await workflow.execute("refreshContext");
      return buildStatus();
    }

    case "GET_SETTINGS":
      return settingsService.get();

    case "UPDATE_SETTINGS": {
      const next = await settingsService.update(message.settings);
      bridge.setBaseUrl(next.bridgeUrl);
      rootLogger.setDebugMode(next.debugMode);
      return next;
    }

    case "DETECT_PROVIDER": {
      const tab = await getActiveTab();
      if (!tab?.id) return null;
      try {
        const live = await contentPort.detectProvider(tab.id);
        cachedProvider = live.provider;
        if (live.provider) {
          eventBus.emit(ExtensionEvents.PROVIDER_DETECTED, {
            tabId: tab.id,
            providerId: live.provider.id,
          });
        }
        return live.provider;
      } catch {
        return detectProviderFromUrl(tab.url);
      }
    }

    case "SEND_CONTEXT": {
      const tab = await getActiveTab();
      if (!tab?.id || !tab.url) {
        throw new ExtensionError("UNSUPPORTED_WEBSITE", "No active tab.");
      }
      const ctx = await workflow.execute("sendContext", {
        tabId: tab.id,
        tabUrl: tab.url,
      });
      return ctx.result as SendContextResult;
    }

    case "COPY_CONTEXT": {
      const ctx = await workflow.execute("copyContext");
      return ctx.result as CopyContextResult;
    }

    default:
      return undefined;
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (!message?.type || message.type.startsWith("CONTENT_")) {
    return false;
  }

  handleMessage(message)
    .then((data): MessageResult => {
      if (data === undefined) {
        return { ok: false, error: `Unhandled message: ${message.type}` };
      }
      return { ok: true, data };
    })
    .catch((err: unknown): MessageResult => {
      const result: MessageResult = {
        ok: false,
        error: toErrorMessage(err),
      };
      if (isExtensionError(err)) {
        result.code = err.code;
      }
      log.error("Message handler failed", {
        type: message.type,
        error: result.error,
      });
      return result;
    })
    .then(sendResponse);

  return true;
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const previousId = cachedProvider?.id ?? null;
    cachedProvider = detectProviderFromUrl(tab.url);
    if (previousId !== (cachedProvider?.id ?? null)) {
      eventBus.emit(ExtensionEvents.PROVIDER_CHANGED, {
        tabId: activeInfo.tabId,
        from: previousId,
        to: cachedProvider?.id ?? null,
      });
    }
    log.debug("Active tab changed", {
      tabId: activeInfo.tabId,
      providerId: cachedProvider?.id,
    });
  } catch {
    cachedProvider = null;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    if (activeTabId === tabId) {
      const previousId = cachedProvider?.id ?? null;
      cachedProvider = detectProviderFromUrl(tab.url);
      if (previousId !== (cachedProvider?.id ?? null)) {
        eventBus.emit(ExtensionEvents.PROVIDER_CHANGED, {
          tabId,
          from: previousId,
          to: cachedProvider?.id ?? null,
        });
        if (previousId && cachedProvider) {
          log.warn("Provider changed on tab", {
            tabId,
            from: previousId,
            to: cachedProvider.id,
          });
        }
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void conversations.clearTab(tabId);
  if (activeTabId === tabId) {
    activeTabId = null;
    cachedProvider = null;
  }
});

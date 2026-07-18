import { defaultAdapterRegistry } from "../adapters/registry";
import { PromptManager } from "../prompt/promptManager";
import { ProviderManager } from "../providerManager/providerManager";
import { StubResponseObserver } from "../services/responseObserver";
import { SettingsService } from "../services/settingsService";
import { ExtensionError, isExtensionError, toErrorMessage } from "../types/errors";
import type { ExtensionMessage, MessageResult } from "../types/messages";
import { UploadManager } from "../upload/uploadManager";
import { rootLogger } from "../utils/logger";

const log = rootLogger.child("Content");
const settingsService = new SettingsService();
void settingsService.init();

if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.ai_bridge_settings) {
      void settingsService.init();
    }
  });
}

const orchestrator = new ProviderManager({
  registry: defaultAdapterRegistry,
  promptManager: new PromptManager(),
  uploadManager: new UploadManager(),
  responseObserver: new StubResponseObserver(),
  getUrl: () => location.href,
  autoDetect: () => settingsService.get().autoDetectProvider,
  getPreferredProviderId: () => settingsService.get().preferredProvider,
  autoSend: () => settingsService.get().autoSend,
});

/** Page-level MutationObserver — adapters never poll. */
let pageObserver: MutationObserver | null = null;

function ensurePageObserver(): void {
  if (pageObserver) return;
  pageObserver = new MutationObserver(() => {
    log.debug("DOM mutation observed");
  });
  pageObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  ensurePageObserver();

  switch (message.type) {
    case "CONTENT_DETECT_PROVIDER": {
      const provider = orchestrator.detectProvider();
      return {
        provider,
        supportsUpload: orchestrator.supportsUpload(),
        ready: orchestrator.isReady(),
      };
    }
    case "CONTENT_WAIT_READY": {
      if (!orchestrator.detectProvider()) {
        throw new ExtensionError(
          "UNSUPPORTED_WEBSITE",
          "This page is not a supported AI chat website.",
        );
      }
      await orchestrator.waitUntilReady();
      return { ready: true };
    }
    case "CONTENT_INSERT_PROMPT": {
      const result = await orchestrator.sendPrompt(message.prompt, {
        autoSend: message.autoSend,
      });
      return {
        inserted: true,
        sent: result.sent,
        providerId: result.providerId,
      };
    }
    case "CONTENT_READ_RESPONSE": {
      const response = await orchestrator.readLatestResponse();
      return { response };
    }
    case "CONTENT_UPLOAD_CAPABILITY": {
      return { supported: orchestrator.supportsUpload() };
    }
    default:
      return undefined;
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (!message?.type?.startsWith("CONTENT_")) {
    return false;
  }

  handleMessage(message)
    .then((data): MessageResult => {
      if (data === undefined) {
        return { ok: false, error: `Unhandled content message: ${message.type}` };
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
      return result;
    })
    .then(sendResponse);

  return true;
});

log.info("Content script ready", { url: location.href });
ensurePageObserver();

import type {
  CopyContextResult,
  ExtensionStatus,
  SendContextResult,
} from "../types/messages";
import type { ExtensionSettings } from "../types/settings";
import { sendMessage } from "../utils/messaging";
import { rootLogger } from "../utils/logger";
import { deriveStatusLabels } from "./statusView";

const log = rootLogger.child("Popup");

const els = {
  bridge: document.getElementById("bridge-status")!,
  provider: document.getElementById("provider-status")!,
  project: document.getElementById("project-status")!,
  connection: document.getElementById("connection-status")!,
  currentAi: document.getElementById("current-ai")!,
  message: document.getElementById("message")!,
  send: document.getElementById("btn-send") as HTMLButtonElement,
  copy: document.getElementById("btn-copy") as HTMLButtonElement,
  refresh: document.getElementById("btn-refresh") as HTMLButtonElement,
  settingsBtn: document.getElementById("btn-settings") as HTMLButtonElement,
  settingsPanel: document.getElementById("settings-panel")!,
  bridgeUrl: document.getElementById("setting-bridge-url") as HTMLInputElement,
  autoDetect: document.getElementById("setting-auto-detect") as HTMLInputElement,
  preferred: document.getElementById("setting-preferred") as HTMLSelectElement,
  autoSend: document.getElementById("setting-auto-send") as HTMLInputElement,
  debug: document.getElementById("setting-debug") as HTMLInputElement,
  saveSettings: document.getElementById("btn-save-settings") as HTMLButtonElement,
};

function setMessage(text: string, kind: "" | "error" | "success" = ""): void {
  els.message.textContent = text;
  els.message.className = kind ? `message ${kind}` : "message";
}

function setValue(el: HTMLElement, text: string, kind: string): void {
  el.textContent = text;
  el.className = `value ${kind}`;
}

function renderStatus(status: ExtensionStatus): void {
  const labels = deriveStatusLabels(status);
  setValue(els.bridge, labels.bridge.text, labels.bridge.kind);
  setValue(els.provider, labels.provider.text, labels.provider.kind);
  setValue(els.project, labels.project.text, labels.project.kind);
  setValue(els.connection, labels.connection.text, labels.connection.kind);
  setValue(els.currentAi, labels.currentAi.text, labels.currentAi.kind);
  fillSettings(status.settings);
  els.send.disabled = !labels.sendEnabled;
}

function fillSettings(settings: ExtensionSettings): void {
  els.bridgeUrl.value = settings.bridgeUrl;
  els.autoDetect.checked = settings.autoDetectProvider;
  els.preferred.value = settings.preferredProvider ?? "";
  els.autoSend.checked = settings.autoSend;
  els.debug.checked = settings.debugMode;
  els.preferred.disabled = settings.autoDetectProvider;
}

async function refresh(): Promise<void> {
  setMessage("Refreshing…");
  try {
    const status = await sendMessage<ExtensionStatus>({ type: "REFRESH_STATUS" });
    renderStatus(status);
    setMessage("");
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), "error");
  }
}

els.send.addEventListener("click", async () => {
  els.send.disabled = true;
  setMessage("Sending context…");
  try {
    const result = await sendMessage<SendContextResult>({ type: "SEND_CONTEXT" });
    setMessage(
      result.sent
        ? `Sent to ${result.providerId} (${result.projectName}).`
        : `Inserted into ${result.providerId}. Review before sending.`,
      "success",
    );
    await refresh();
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), "error");
    els.send.disabled = false;
  }
});

els.copy.addEventListener("click", async () => {
  setMessage("Fetching context…");
  try {
    const result = await sendMessage<CopyContextResult>({ type: "COPY_CONTEXT" });
    await navigator.clipboard.writeText(result.markdown);
    setMessage(`Copied context for ${result.projectName}.`, "success");
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), "error");
  }
});

els.refresh.addEventListener("click", () => {
  void refresh();
});

els.settingsBtn.addEventListener("click", () => {
  els.settingsPanel.hidden = !els.settingsPanel.hidden;
});

els.autoDetect.addEventListener("change", () => {
  els.preferred.disabled = els.autoDetect.checked;
});

els.saveSettings.addEventListener("click", async () => {
  const patch: Partial<ExtensionSettings> = {
    bridgeUrl: els.bridgeUrl.value.trim().replace(/\/$/, ""),
    autoDetectProvider: els.autoDetect.checked,
    preferredProvider: els.preferred.value || null,
    autoSend: els.autoSend.checked,
    debugMode: els.debug.checked,
  };
  try {
    await sendMessage<ExtensionSettings>({ type: "UPDATE_SETTINGS", settings: patch });
    setMessage("Settings saved.", "success");
    await refresh();
  } catch (err) {
    setMessage(err instanceof Error ? err.message : String(err), "error");
  }
});

log.info("Popup opened");
void refresh();

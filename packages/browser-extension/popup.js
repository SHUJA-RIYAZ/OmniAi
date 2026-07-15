import { formatSnapshotAsMarkdown, selectorsForHost } from "./format.js";

// When loaded as a plain web page (dev preview) instead of an extension popup,
// chrome.* APIs are unavailable: fetch the bridge directly and show the
// markdown instead of injecting it into a tab.
const isExtension = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);

const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "error" : "";
}

// Injected into the page. Must be self-contained (serialized by scripting API).
function insertTextIntoPage(text, selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      // Use the native setter so frameworks (React) observe the change.
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // contenteditable
      const ok = document.execCommand("insertText", false, text);
      if (!ok) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    }
    return true;
  }
  return false;
}

async function fetchLatestSnapshot() {
  if (isExtension) {
    const response = await chrome.runtime.sendMessage({ type: "FETCH_LATEST_CONTEXT" });
    if (!response?.ok) {
      throw new Error(response?.error ?? "Unknown error contacting bridge.");
    }
    return response.snapshot;
  }
  // Dev preview: talk to the bridge directly.
  let res;
  try {
    res = await fetch("http://127.0.0.1:8765/api/v1/context/latest");
  } catch (err) {
    throw new Error(`Bridge unreachable (${err.message}). Is it running on port 8765?`);
  }
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body.data;
}

async function insertIntoActiveTab(markdown) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    setStatus("No active tab.", true);
    return;
  }

  const selectors = selectorsForHost(new URL(tab.url).hostname);
  if (selectors.length === 0) {
    setStatus("This page is not a supported AI chat.", true);
    return;
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: insertTextIntoPage,
    args: [markdown, selectors],
  });

  if (result?.result) {
    setStatus("Context inserted. Review before sending.");
  } else {
    setStatus("Could not find the chat input on this page.", true);
  }
}

document.getElementById("insert").addEventListener("click", async () => {
  setStatus("Fetching context from bridge…");
  previewEl.hidden = true;

  let snapshot;
  try {
    snapshot = await fetchLatestSnapshot();
  } catch (err) {
    setStatus(err.message, true);
    return;
  }

  const markdown = formatSnapshotAsMarkdown(snapshot);

  if (isExtension) {
    await insertIntoActiveTab(markdown);
  } else {
    previewEl.textContent = markdown;
    previewEl.hidden = false;
    setStatus("Dev preview: showing formatted context (load as an extension to insert into a chat).");
  }
});

if (!isExtension) {
  setStatus("Dev preview mode — not running as an extension.");
}

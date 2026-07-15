import { formatSnapshotAsMarkdown, selectorsForHost } from "./format.js";

const statusEl = document.getElementById("status");

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

document.getElementById("insert").addEventListener("click", async () => {
  setStatus("Fetching context from bridge…");

  const response = await chrome.runtime.sendMessage({ type: "FETCH_LATEST_CONTEXT" });
  if (!response?.ok) {
    setStatus(response?.error ?? "Unknown error contacting bridge.", true);
    return;
  }

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

  const markdown = formatSnapshotAsMarkdown(response.snapshot);
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
});

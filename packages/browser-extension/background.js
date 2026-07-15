// Service worker: the only component allowed to talk to the local bridge.
// The popup and content script message it, keeping network access in one place.

const BRIDGE_URL = "http://127.0.0.1:8765";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FETCH_LATEST_CONTEXT") {
    fetch(`${BRIDGE_URL}/api/v1/context/latest`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body.ok) {
          sendResponse({ ok: false, error: body.error || `HTTP ${res.status}` });
        } else {
          sendResponse({ ok: true, snapshot: body.data });
        }
      })
      .catch((err) =>
        sendResponse({
          ok: false,
          error: `Bridge unreachable (${err.message}). Is it running on port 8765?`,
        }),
      );
    return true; // async response
  }
  return false;
});

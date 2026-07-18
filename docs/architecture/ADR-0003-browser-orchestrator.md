# ADR-0003: Browser Orchestrator

## Status

Accepted

## Date

2026-07-18

---

## Context

The project must support multiple AI websites including ChatGPT, Claude, Gemini, DeepSeek, Kimi, Perplexity, Z.ai and future providers.

We need one common entry point instead of every module talking directly to provider-specific adapters.

---

## Decision

Introduce a ProviderManager (Browser Orchestrator).

All browser automation must flow through

```
Workflow Engine
      ↓
ProviderManager
      ↓
Adapter Registry
      ↓
AIAdapter
```

Only ProviderManager is allowed to communicate with adapters.

ProviderManager exposes a stable `BrowserOrchestrator` API:

- `sendContext(context)`
- `sendPrompt(prompt)`
- `uploadFiles(files)`
- `readLatestResponse()`
- `continueConversation()`
- `detectProvider()`

DOM adapters live in the content script. Background talks to them only through a content port — never by importing ChatGPT/Claude classes.

---

## Consequences

### Advantages

- Provider-independent architecture
- Easy to add new providers
- No duplicated business logic
- Better testing

### Tradeoffs

- Slightly more abstraction
- One additional layer
- Content-script messaging required for DOM work

---

## Alternatives Considered

1. **Workflow directly calling adapters.**  
   Rejected because every workflow would become provider-specific.

2. **Background communicating with adapters.**  
   Rejected because background cannot safely manipulate DOM.

3. **Popup using `chrome.scripting.executeScript` with hardcoded selectors.**  
   Rejected — that was the MVP path; it does not scale to conversation observation or uploads.

---

## Future Notes

Phase 4 will extend ProviderManager with

- `readLatestResponse()` (real implementation)
- `requestFiles()` / file-request handling
- `conversationSync()`

No workflow changes required if those capabilities remain behind the orchestrator API.

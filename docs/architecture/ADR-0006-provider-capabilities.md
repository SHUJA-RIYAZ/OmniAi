# ADR-0006: Provider Capabilities

## Status

Accepted

## Date

2026-07-18

---

## Context

Every AI website has different features.

Some support uploads.

Some support images.

Some support reading conversations.

Hardcoding checks like `if (providerId === "chatgpt")` would become difficult to maintain and would leak provider knowledge into managers and workflows.

---

## Decision

Each `AIAdapter` exposes a `ProviderCapabilities` object:

```ts
interface ProviderCapabilities {
  promptInjection: boolean;
  autoSend: boolean;
  fileUpload: boolean;
  multipleFiles: boolean;
  markdown: boolean;
  images: boolean;
  readConversation: boolean;
  conversationSync: boolean;
}
```

Adapter descriptors also carry capabilities so the service worker can reason about a URL without constructing DOM adapters.

Managers must use `capabilities()` (or descriptor capabilities) instead of checking provider names.

`supportsFileUpload()` remains only as a deprecated compatibility alias for `capabilities().fileUpload`.

---

## Consequences

### Benefits

- No provider-specific business logic outside adapters
- Easy provider expansion
- Supports future AI websites
- Clear matrix for UI (e.g. disable upload affordances)

### Tradeoffs

- Capability flags can drift from real DOM behavior if adapters are not kept honest
- Some capabilities are declared early but intentionally unimplemented (Phase 4+)

---

## Alternatives Considered

1. **Hardcoded provider-id conditionals in managers.**  
   Rejected — does not scale and violates SOLID.

2. **Runtime feature detection only (probe the DOM every time).**  
   Rejected as the sole approach — expensive and flaky; keep probes for readiness, declare stable capabilities on the adapter.

3. **Central config file mapping provider → features.**  
   Rejected — splits truth away from the adapter that owns the DOM.

---

## Future Notes

Phase 4 will use `readConversation` / file-upload capabilities for real reply reading and uploads.

Phase 5 will use `images` and related media capabilities.

Feature flags still gate product readiness even when a provider declares a capability.

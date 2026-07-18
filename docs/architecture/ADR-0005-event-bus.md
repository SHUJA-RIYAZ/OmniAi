# ADR-0005: Event Bus

## Status

Accepted

## Date

2026-07-18

---

## Context

Modules should not call each other directly for cross-cutting notifications.

We need loose coupling between workflows, session updates, bridge health, and provider detection — without forcing every producer to know every consumer.

---

## Decision

Introduce an in-process `EventBus` (publish/subscribe).

Examples

- `context.sent`
- `context.copied`
- `context.refreshed`
- `provider.changed`
- `provider.detected`
- `bridge.offline`
- `bridge.online`
- `session.updated`
- `workflow.started` / `workflow.completed` / `workflow.failed`

One bus instance exists per extension realm (background, content, popup). Events are typed via `ExtensionEventMap`.

Use the bus for notifications and side observations. Keep request/response flows on explicit APIs (workflow engine, content port, bridge client).

---

## Consequences

### Benefits

- Independent modules
- Better testing (subscribe in unit tests)
- Easier structured logging
- Future plugins / UI reactions without editing producers

### Tradeoffs

- Event names must stay stable once published
- Easy to overuse events for control flow (avoid that)
- Not a cross-process bus — background ↔ content still uses Chrome messaging

---

## Alternatives Considered

1. **Direct method calls between managers.**  
   Rejected due to tight coupling and harder testing.

2. **Redux / full state store.**  
   Rejected — too heavy for the extension; we need light notifications, not a UI store.

3. **Chrome runtime broadcasts for everything.**  
   Rejected — noisy, harder to type, and unnecessary within a single JS realm.

---

## Future Notes

Phase 4+ observers (reply reading, file requests) should emit domain events rather than calling popup/UI code directly. If cross-context fan-out is needed later, bridge the in-process bus to `chrome.runtime` at the composition root only.

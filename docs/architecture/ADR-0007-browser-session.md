# ADR-0007: Browser Session

## Status

Accepted

## Date

2026-07-18

---

## Context

Users may work with multiple browser tabs and providers.

Conversation state must remain isolated per tab/provider/project so that Send Context on one site does not corrupt another session.

We also need a durable local model that future conversation synchronization can attach to.

---

## Decision

Introduce `BrowserSession`:

```ts
interface BrowserSession {
  projectId: string;
  provider: string;
  tabId: number;
  conversationId?: string;
  snapshotId?: string;
  createdAt: number;
  updatedAt: number;
}
```

`SessionManager` owns persistence (chrome.storage.local / in-memory for tests).

`ConversationManager` keeps its existing public API for Phase 3 callers, but uses `BrowserSession` internally for identity and linkage (project, provider, tab, conversation, snapshot).

Sessions emit `session.updated` on the event bus.

---

## Consequences

### Benefits

- Supports multiple providers and tabs
- Supports future conversation synchronization
- Supports workflow recovery / status UI
- Clear separation between session identity and conversation status metadata

### Tradeoffs

- Two related stores (session + conversation status meta) until a later consolidation
- Local-only — no cross-device sync yet

---

## Alternatives Considered

1. **Single global “current provider” variable.**  
   Rejected — breaks multi-tab use.

2. **Store everything only as ConversationState.**  
   Rejected — mixes UI status with durable session identity needed for sync.

3. **Server-side session store on the bridge.**  
   Deferred — local session is enough for Phase 3.1; bridge sync can come later.

---

## Future Notes

Conversation synchronization (Phase 4+) should key off `conversationId` + `projectId` + `provider`. Do not invent a second session model in the bridge without migrating this one.

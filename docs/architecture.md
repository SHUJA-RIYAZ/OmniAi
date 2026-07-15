# Architecture

## Overview

```
┌─────────────────────┐     POST /api/v1/context      ┌──────────────────┐
│  VS Code extension  │ ────────────────────────────► │   Local bridge    │
│                     │                               │   (FastAPI)       │
│  collectors ──┐     │                               │                   │
│  assembler  ◄─┘     │                               │  SnapshotStore    │
│  (context-engine)   │                               │  (in-memory LRU)  │
└─────────────────────┘                               └────────┬─────────┘
                                                               │ GET /api/v1/context/latest
                                                      ┌────────▼─────────┐
                                                      │ Browser extension │
                                                      │ popup → service   │
                                                      │ worker → inject   │
                                                      └────────┬─────────┘
                                                               │ insert markdown
                                                      ┌────────▼─────────┐
                                                      │  AI chat page     │
                                                      │  (claude.ai, …)   │
                                                      └──────────────────┘
```

Everything runs on the developer's machine. The bridge is the only shared state; the two extensions never talk to each other directly.

## Layering rules

1. **`shared`** has no dependencies. It defines the wire format (`ContextSnapshot`), feature flags, and constants. The Python bridge mirrors these types in `bridge/models.py` — that file and `shared/src/types.ts` must change together (enforced by API tests).
2. **`context-engine`** depends only on `shared`. It knows *how to run collectors*, not *what a collector reads*. It has zero VS Code imports, so it can later serve JetBrains or a CLI.
3. **`provider-sdk`** depends only on `shared`. Adapters are data + pure formatting; DOM manipulation stays in the browser extension.
4. **`vscode-extension`** implements `context-engine`'s `ContextCollector` interface against the VS Code API and wires commands. Commands contain orchestration only — no collection or formatting logic.
5. **`browser-extension`** is plain MV3 JavaScript for the MVP (no build step; see ADR-0004). Only the service worker touches the network.
6. **`local-bridge`** is a thin REST layer over a `SnapshotStore` abstraction. The in-memory store will be swapped for SQLite when project memory lands.

## Key interfaces (replacement points)

| Interface | Package | Replace it to… |
|---|---|---|
| `ContextCollector` | context-engine | add new context sources (AST, dep graph) |
| `FeatureFlagReader` | shared | back flags with remote config or files |
| `IdGenerator` | context-engine | deterministic IDs in tests |
| `BridgeClient` | vscode-extension | switch transport (WebSocket later) |
| `ProviderAdapter` | provider-sdk | support a new AI provider |
| `SnapshotStore` | local-bridge | persistence, project memory |

## Data flow

1. User runs **“Send Context to Bridge”**. The `ContextAssembler` runs each flag-enabled collector; failures are collected, never thrown.
2. The snapshot (schema version 1, UUID, ISO timestamp) is POSTed to the bridge, which validates it with Pydantic and stores it.
3. In the browser, the popup asks the service worker for `GET /context/latest`, formats it as markdown (mirroring `provider-sdk`'s formatter), and injects it into the provider's input element using per-provider selectors. **The user always reviews before sending** — the extension never clicks submit.

## Security & privacy posture (MVP)

- Bridge binds to `127.0.0.1`; unreachable from the network.
- Terminal collection is **off by default** (buffers may contain secrets).
- The browser extension requests host permissions only for supported AI sites and the localhost bridge.
- No telemetry, no external calls.

Known gap (accepted for MVP, tracked for milestone 2): any local process can read the bridge. A per-session token handshake between extension and bridge is planned.

# ADR-0002: Local FastAPI bridge as the integration point

**Status:** accepted · **Date:** 2026-07-15

## Context
The VS Code extension and the browser extension run in different sandboxes and cannot talk directly. We need a rendezvous point that stays local-first.

## Decision
A FastAPI server on `127.0.0.1:8765` with a versioned REST API (`/api/v1`). VS Code pushes snapshots; the browser extension pulls the latest. Storage is an in-memory LRU behind a `SnapshotStore` ABC.

## Alternatives considered
- **Native messaging host** (browser ↔ native): no server, but Chrome-specific, painful to install cross-browser, and doesn't help future non-browser consumers.
- **WebSocket-only**: better for push, but complicates the MVP; REST is sufficient for a pull model and easier to test. WebSockets can be added alongside REST later.
- **Files in a temp dir**: no validation, no versioning, race-prone.

## Consequences
- Python is a second toolchain, accepted because FastAPI/Pydantic give free validation + OpenAPI docs, and later milestones (embeddings, semantic search) want Python anyway.
- CORS is wide-open but the bind address is loopback-only; a token handshake is planned in milestone 2 (any local process can currently read the bridge).

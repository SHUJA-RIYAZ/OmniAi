# ADR-0001: Project Architecture

## Status

Accepted

## Date

2026-07-18

---

## Context

We are building an AI Universal Browser Assistant — not another AI chatbot.

Developers should keep using ChatGPT, Claude, Gemini, DeepSeek, Kimi, Perplexity, Z.ai, or any future AI website. Our software must collect editor context, transfer it through a local bridge, and inject it into whatever AI UI the user prefers.

The system therefore spans multiple runtimes:

- VS Code extension (context collection)
- Context intelligence engine (analysis / selection)
- Local FastAPI bridge (shared state)
- Browser extension (orchestration + DOM injection)
- Provider SDK (formatting contracts)

Without a clear architecture, these pieces will couple tightly and become impossible to extend.

---

## Decision

Adopt a local-first, layered monorepo architecture:

```
VS Code Extension
        ↓
Context Intelligence Engine
        ↓
Local FastAPI Bridge
        ↓
Browser Extension (Workflow → ProviderManager → Adapters)
        ↓
Any AI Website (UI only)
```

Rules:

1. **`packages/shared`** owns the wire contract (`ContextSnapshot`). No other package invents parallel types.
2. **`packages/context-engine`** is editor-agnostic. No VS Code imports.
3. **`packages/provider-sdk`** owns formatting / provider identity data. DOM stays in the browser extension.
4. **`apps/local-bridge`** is the only shared state. Extensions never talk to each other directly.
5. **`packages/browser-extension`** is the orchestration layer. Provider-specific logic lives only in adapters.
6. Everything runs on the developer's machine. No cloud dependency for the core path.

---

## Consequences

### Benefits

- Clear ownership boundaries between packages
- New editors (JetBrains, CLI) can reuse `context-engine`
- New AI websites require only a browser adapter
- Contract changes land in one PR across consumers
- Privacy-preserving by design (localhost bridge)

### Tradeoffs

- More packages to navigate than a single app
- Python bridge must mirror TypeScript types manually
- Contributors need Node + Python toolchains

---

## Alternatives Considered

1. **Single VS Code webview that embeds an AI chat.**  
   Rejected — users must keep their preferred AI websites.

2. **Cloud relay for context transfer.**  
   Rejected — privacy, latency, and offline use are first-class requirements.

3. **Browser extension only (no VS Code / bridge).**  
   Rejected — cannot access workspace AST, diagnostics, or git state reliably.

---

## Future Notes

Later phases add reply reading, file-request detection, conversation sync, semantic search, and project memory. Those features must plug into the existing layers (workflow commands, capabilities, sessions, feature flags) — not invent parallel pipelines.

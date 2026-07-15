# AI Context Bridge

A **local-first AI orchestration platform**: collect your editor's working context (active file, selection, diagnostics, terminal output, git diff, workspace metadata), serve it from a local bridge, and insert it into any AI assistant's web chat with one click. No cloud, no accounts — your code never leaves your machine unless *you* paste it somewhere.

## Status: Context intelligence (milestone 2)

The pipeline works end-to-end: **VS Code → local FastAPI bridge → browser extension → AI chat page**. Snapshots now carry structured intelligence — current function, file structure, import dependency graph, related files, workspace summary, and token estimates — instead of only raw text (see [docs/intelligence.md](docs/intelligence.md)). Remaining advanced features (semantic search, compression, provider routing) are gated behind feature flags — see [docs/roadmap.md](docs/roadmap.md).

## Repository layout

| Path | What it is |
|---|---|
| `packages/vscode-extension` | VS Code extension: collectors + commands + bridge client |
| `packages/context-engine` | Editor-agnostic collection pipeline (collector interfaces, assembler) |
| `packages/provider-sdk` | Provider adapter interfaces, registry, built-in adapters |
| `packages/browser-extension` | Chrome MV3 extension: fetch context, insert into AI chat pages |
| `packages/shared` | Contract types (wire format), feature flags, constants |
| `apps/local-bridge` | FastAPI server storing and serving context snapshots |
| `docs` | Architecture, ADRs, roadmap |

## Quick start

Requirements: Node ≥ 20, Python ≥ 3.10.

```bash
# 1. Install and build the TypeScript packages
npm install
npm run build

# 2. Start the local bridge
cd apps/local-bridge
pip install -e ".[dev]"
uvicorn bridge.main:app --host 127.0.0.1 --port 8765

# 3. Run the VS Code extension
#    Open packages/vscode-extension in VS Code and press F5, then run
#    "AI Context Bridge: Send Context to Bridge" from the command palette.

# 4. Load the browser extension
#    chrome://extensions → Enable developer mode → "Load unpacked"
#    → select packages/browser-extension. Open claude.ai / chatgpt.com,
#    click the extension icon, then "Insert editor context into this page".
```

## Tests

```bash
npm test              # TypeScript unit tests (vitest)
npm run test:bridge   # Python API tests (pytest)
```

## Design principles

- **Local-first.** The bridge binds to `127.0.0.1` only. Nothing is sent anywhere by default.
- **Contracts over coupling.** All components communicate through the types in `packages/shared`; each side can be replaced independently.
- **No business logic in UI.** VS Code commands and the popup delegate to `context-engine` / `provider-sdk`.
- **Feature flags everywhere.** Every collector and future capability is gated (`packages/shared/src/featureFlags.ts`); terminal capture is off by default because terminal buffers may contain secrets.
- **Collectors never break the snapshot.** A failing collector is reported, not fatal.

See [docs/architecture.md](docs/architecture.md) and the ADRs in [docs/adr](docs/adr) for the reasoning behind each decision.

## License

MIT

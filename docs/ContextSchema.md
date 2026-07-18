# Context Schema

Canonical definitions: `packages/shared/src/types.ts` + `intelligence.ts` (TypeScript) and `apps/local-bridge/bridge/analysis/models.py` (Python mirror). This document covers versioning and the semantics that aren't obvious from the types.

## Versioning

| Version | Shipped | Changes |
|---|---|---|
| 1 | Milestone 1–2 | Base snapshot; `intelligence.calls` were bare dotted strings |
| 2 | Phase 2.5 (current) | `calls` are `CallInfo` objects; symbol `id`s; `cursor`, `warnings`, `metrics`; typed graph edges + nodes; related-file `priority`/`depth`/`symbols` |

Rules:

- Producers always emit `CURRENT_SCHEMA_VERSION` (`packages/shared/src/migration.ts`).
- Consumers call `migrateSnapshot(snapshot)` before reading — it upgrades v1→v2 (pure, non-mutating) and returns current snapshots unchanged.
- The bridge accepts both versions: a Pydantic `mode="before"` validator upgrades v1 call strings on ingest, so stored snapshots are always v2-shaped.
- Migrations are append-only: never edit an old migration, chain a new one.

## Symbol IDs

Format: `python://<workspace-relative-path>/<qualifiedName>`

- `python://auth.py/login` — top-level function
- `python://auth.py/User` — class
- `python://auth.py/User.logout` — method
- `python://auth.py/User.name` — property
- `python://<unsaved>/f` — file not on disk yet

IDs are minted by the analyzer from the request's `path` and are **stable across runs** for unchanged path + symbol name. They are opaque strings: consumers must not parse them beyond the `language://` prefix.

## Call classification (`CallInfo.type`)

| type | resolved | Meaning | Decided by |
|---|---|---|---|
| `local` | target found in file | Defined in the same file (incl. `self.`/`cls.`) | analyzer |
| `builtin` | always | Python builtin (`print`, `len`, …) | analyzer |
| `workspace` | file located | Import resolved to a workspace file | analyzer (relative imports) / `CallResolver` |
| `thirdparty` | never | Import that resolves to no workspace file | `CallResolver` |
| `unknown` | never | Could not be classified | fallback |

## Warnings (`intelligence.warnings`)

Non-fatal, never thrown: `unsupported-language`, `parse-failed`, `bridge-unreachable`, `missing-file`, `cyclic-dependency`, `summary-failed`. Absent/empty = clean build.

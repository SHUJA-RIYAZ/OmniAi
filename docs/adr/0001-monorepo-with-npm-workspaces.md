# ADR-0001: Monorepo with npm workspaces + TypeScript project references

**Status:** accepted · **Date:** 2026-07-15

## Context
The system spans a VS Code extension, two libraries, a browser extension, and a Python server that share one wire contract. Contract drift between separately-versioned repos is the biggest long-term risk.

## Decision
Single monorepo. TypeScript packages are npm workspaces built with `tsc -b` project references; the Python app lives in `apps/` with its own toolchain. `packages/shared` is the contract package everything else imports.

## Consequences
- One PR changes the contract and all consumers atomically.
- npm workspaces (not pnpm/turborepo) keeps contributor setup to `npm install` — we can adopt turborepo later if build times demand it.
- The Python bridge cannot import TS types; `bridge/models.py` mirrors them manually, guarded by API tests. If drift becomes a problem, generate Pydantic models from the TS source (or JSON Schema) in a later milestone.

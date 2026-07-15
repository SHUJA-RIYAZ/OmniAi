# ADR-0003: Canonical feature flags in `shared`, storage per host

**Status:** accepted · **Date:** 2026-07-15

## Context
Every feature must ship incrementally and be individually disableable, across components with different config systems (VS Code settings, browser storage, env vars).

## Decision
Flag *names and defaults* live once in `packages/shared` (`FEATURE_FLAGS`, `DEFAULT_FLAG_VALUES`). Each host implements the two-method `FeatureFlagReader` interface over its own storage (`VsCodeFeatureFlags` maps flags to `aiContextBridge.flags.*` settings). Post-MVP flags are declared now, defaulting to `false`, so config surfaces never churn.

## Consequences
- `ContextAssembler` checks flags generically — adding a collector never adds flag plumbing.
- `collect.terminal` defaults to **off**: terminal buffers may contain secrets, so it's an explicit opt-in.
- Declared-but-unimplemented flags are honest placeholders; enabling one is a no-op until its milestone lands.

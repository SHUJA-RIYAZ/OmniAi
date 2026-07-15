# ADR-0004: Browser extension is plain JS for the MVP

**Status:** accepted (revisit at milestone 2) · **Date:** 2026-07-15

## Context
MV3 extensions need bundling to consume workspace TypeScript packages. The MVP extension is ~200 lines across three files.

## Decision
Ship plain ES-module JavaScript, loadable unpacked with zero build step. `format.js` deliberately mirrors `provider-sdk`'s markdown formatter and adapter selector data.

## Consequences
- Fastest possible contributor loop (edit → reload extension).
- The mirror is duplication with a drift risk — both files carry a comment pointing at each other. When the extension grows (provider routing, automation), we add an esbuild step and import `provider-sdk` directly; the mirrored file is deleted then.
- Insertion is conservative: native value setters + `input` events for textareas (so React notices), `execCommand("insertText")` for contenteditable. The extension never auto-submits — the user reviews everything before sending.

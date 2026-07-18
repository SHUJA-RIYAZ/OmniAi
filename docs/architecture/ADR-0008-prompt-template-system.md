# ADR-0008: Prompt Template System

## Status

Accepted

## Date

2026-07-18

---

## Context

Prompt generation should not be hardcoded in TypeScript string builders.

Future workflows require different prompt formats (send context, review code, fix errors, generate tests, continue conversation) while still using the same snapshot → markdown pipeline.

---

## Decision

Use Markdown templates with `{{variable}}` placeholders.

Templates live in:

```
packages/browser-extension/src/prompt/templates/
├── sendContext.md
├── copyContext.md
├── fixError.md
├── reviewCode.md
├── generateTests.md
└── continueConversation.md
```

`PromptManager` still formats a `ContextSnapshot` via the Provider SDK (`formatSnapshotAsMarkdown`), then `TemplateLoader` wraps that body:

- `{{formattedContext}}`
- `{{projectName}}`
- `{{snapshotId}}`
- `{{languages}}`

No AI summarization or compression happens in the template layer.

---

## Consequences

### Benefits

- Easy customization of prompt framing
- Better testing (inject a fake loader)
- Cleaner PromptManager
- Future localization possible
- New workflow prompts = new `.md` file + template id

### Tradeoffs

- Build tooling must load `.md` as text (esbuild + vitest plugin)
- Templates can drift from formatter output if variables are misnamed
- Rich per-provider prompt dialects are not yet modeled (shared markdown first)

---

## Alternatives Considered

1. **Hardcoded string concatenation in PromptManager.**  
   Rejected — does not scale across workflows.

2. **LLM-based prompt rewriting in the extension.**  
   Rejected — out of scope; we do not run models locally for formatting.

3. **Provider-specific template trees per adapter.**  
   Deferred — start with shared templates; add provider overrides only if needed.

---

## Future Notes

Workflows such as Review Code / Fix Error should select a template id in their command (`promptManager.build(snapshot, "reviewCode")`) rather than embedding prose in TypeScript. Keep compression and token budgeting in `context-engine`, not in templates.

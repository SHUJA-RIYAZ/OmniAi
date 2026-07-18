# ADR-0004: Workflow Engine

## Status

Accepted

## Date

2026-07-18

---

## Context

Future versions will support many user actions.

Examples

- Send Context
- Explain Code
- Review Code
- Generate Tests
- Continue Conversation

Implementing these directly inside the popup or ProviderManager would create tight coupling.

---

## Decision

Introduce a command-based Workflow Engine.

Every action is implemented as a `WorkflowCommand`:

```ts
interface WorkflowCommand {
  id: string;
  execute(context: WorkflowContext): Promise<void>;
}
```

`WorkflowEngine` executes commands by ID:

```ts
await workflow.execute("sendContext", { tabId, tabUrl });
```

Built-in commands today:

- `sendContext`
- `copyContext`
- `refreshContext`

`SendContextWorkflow` remains only as a thin facade for backward-compatible call sites.

---

## Consequences

### Benefits

New workflows require only

- one command file
- one registration

No existing command code changes.

Lifecycle events (`workflow.started` / `completed` / `failed`) and local telemetry are centralized.

### Tradeoffs

- One extra abstraction layer
- Results are carried on `WorkflowContext.result` rather than typed return values per command

---

## Alternatives Considered

1. **Switch/case in the popup or background for every action.**  
   Rejected — grows into an untestable god module.

2. **Hardcode Send Context inside ProviderManager.**  
   Rejected — mixes page orchestration with product workflows.

3. **External workflow DSL / visual builder.**  
   Rejected for now — too heavy for Phase 3.1; command classes are enough.

---

## Future Notes

Phase 5 may introduce multi-step workflows (sequences of commands). The current design already supports composing commands or evolving `execute` to run pipelines without changing popup/background message shapes.

import { ExtensionEvents } from "../events/events";
import type { EventBus } from "../events/interfaces";
import type { Telemetry } from "../telemetry/telemetry";
import { rootLogger } from "../utils/logger";
import type {
  WorkflowCommand,
  WorkflowContext,
  WorkflowDependencies,
  WorkflowEngine,
  WorkflowRegistry,
} from "./types";
import { DefaultWorkflowRegistry } from "./workflowRegistry";

export class DefaultWorkflowEngine implements WorkflowEngine {
  private readonly log = rootLogger.child("Workflow");

  constructor(
    private readonly deps: WorkflowDependencies,
    private readonly registry: WorkflowRegistry = new DefaultWorkflowRegistry(),
    private readonly events: EventBus = deps.events,
    private readonly telemetry: Telemetry = deps.telemetry,
  ) {}

  register(command: WorkflowCommand): void {
    this.registry.register(command);
  }

  async execute(
    commandId: string,
    partial: Partial<Omit<WorkflowContext, "deps">> = {},
  ): Promise<WorkflowContext> {
    const command = this.registry.get(commandId);
    if (!command) {
      throw new Error(`Unknown workflow command: ${commandId}`);
    }

    const context: WorkflowContext = {
      ...partial,
      deps: this.deps,
    };

    const started = Date.now();
    this.log.info("Workflow execute", { commandId, tabId: context.tabId });
    const lifecycle = {
      commandId,
      ...(context.tabId !== undefined ? { tabId: context.tabId } : {}),
    };
    this.events.emit(ExtensionEvents.WORKFLOW_STARTED, lifecycle);
    this.telemetry.trackWorkflow(commandId, { phase: "start", tabId: context.tabId });

    try {
      await command.execute(context);
      this.events.emit(ExtensionEvents.WORKFLOW_COMPLETED, lifecycle);
      this.telemetry.trackWorkflow(commandId, { phase: "complete", tabId: context.tabId });
      this.telemetry.trackPerformance(`workflow.${commandId}`, Date.now() - started, {
        tabId: context.tabId,
      });
      return context;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.events.emit(ExtensionEvents.WORKFLOW_FAILED, {
        ...lifecycle,
        error: message,
      });
      this.telemetry.trackWorkflow(commandId, {
        phase: "failed",
        tabId: context.tabId,
        error: message,
      });
      throw err;
    }
  }
}

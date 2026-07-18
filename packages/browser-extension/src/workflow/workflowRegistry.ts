import type { WorkflowCommand, WorkflowRegistry } from "./types";

export class DefaultWorkflowRegistry implements WorkflowRegistry {
  private readonly commands = new Map<string, WorkflowCommand>();

  register(command: WorkflowCommand): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Workflow command already registered: ${command.id}`);
    }
    this.commands.set(command.id, command);
  }

  get(id: string): WorkflowCommand | undefined {
    return this.commands.get(id);
  }

  ids(): string[] {
    return [...this.commands.keys()];
  }
}

import { ExtensionEvents } from "../../events/events";
import type { CopyContextResult } from "../../types/messages";
import type { WorkflowCommand, WorkflowContext } from "../types";

export class CopyContextCommand implements WorkflowCommand {
  readonly id = "copyContext";

  async execute(context: WorkflowContext): Promise<void> {
    const { deps } = context;
    const snapshot = await deps.bridge.getLatestContext();
    const built = deps.promptManager.build(snapshot, "copyContext");

    const result: CopyContextResult = {
      ok: true,
      markdown: built.prompt,
      projectName: built.projectName,
    };
    context.result = result;

    deps.events.emit(ExtensionEvents.CONTEXT_COPIED, {
      projectName: result.projectName,
      promptLength: result.markdown.length,
    });
  }
}

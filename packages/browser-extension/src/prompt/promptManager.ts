import type { ContextSnapshot } from "@ai-context-bridge/shared";
import { formatSnapshotAsMarkdown } from "@ai-context-bridge/provider-sdk";
import { rootLogger } from "../utils/logger";
import {
  defaultTemplateLoader,
  type TemplateLoader,
} from "./templateLoader";
import type { PromptTemplateId } from "./templates/sources";

export interface PromptBuildResult {
  prompt: string;
  projectName: string;
  snapshotId: string;
  templateId: PromptTemplateId;
}

export interface PromptManagerOptions {
  formatter?: (snapshot: ContextSnapshot) => string;
  templates?: TemplateLoader;
}

/**
 * Builds the final prompt from a context snapshot.
 * Formats via Provider SDK, then applies a markdown template.
 */
export class PromptManager {
  private readonly log = rootLogger.child("Workflow");
  private readonly formatter: (snapshot: ContextSnapshot) => string;
  private readonly templates: TemplateLoader;

  constructor(
    formatterOrOptions?:
      | ((snapshot: ContextSnapshot) => string)
      | PromptManagerOptions,
  ) {
    if (typeof formatterOrOptions === "function") {
      this.formatter = formatterOrOptions;
      this.templates = defaultTemplateLoader;
    } else {
      this.formatter = formatterOrOptions?.formatter ?? formatSnapshotAsMarkdown;
      this.templates = formatterOrOptions?.templates ?? defaultTemplateLoader;
    }
  }

  build(
    snapshot: ContextSnapshot,
    templateId: PromptTemplateId = "sendContext",
  ): PromptBuildResult {
    const formattedContext = this.formatter(snapshot);
    const prompt = this.templates.render(templateId, {
      formattedContext,
      projectName: snapshot.workspace.name,
      snapshotId: snapshot.id,
      languages: snapshot.workspace.languages.join(", "),
    });

    this.log.debug("Prompt built", {
      snapshotId: snapshot.id,
      projectName: snapshot.workspace.name,
      templateId,
      length: prompt.length,
    });

    return {
      prompt,
      projectName: snapshot.workspace.name,
      snapshotId: snapshot.id,
      templateId,
    };
  }
}

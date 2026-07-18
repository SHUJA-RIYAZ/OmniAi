import { TEMPLATE_SOURCES, type PromptTemplateId } from "./templates/sources";

export type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

export interface TemplateLoader {
  load(id: PromptTemplateId): string;
  render(id: PromptTemplateId, variables: TemplateVariables): string;
  renderSource(source: string, variables: TemplateVariables): string;
  ids(): PromptTemplateId[];
}

/**
 * Loads markdown prompt templates and substitutes `{{variable}}` placeholders.
 * No AI — pure string templating.
 */
export class MarkdownTemplateLoader implements TemplateLoader {
  constructor(
    private readonly sources: Record<PromptTemplateId, string> = TEMPLATE_SOURCES,
  ) {}

  ids(): PromptTemplateId[] {
    return Object.keys(this.sources) as PromptTemplateId[];
  }

  load(id: PromptTemplateId): string {
    const source = this.sources[id];
    if (source === undefined) {
      throw new Error(`Unknown prompt template: ${id}`);
    }
    // Normalize editor/file trailing newlines so `{{formattedContext}}` alone
    // does not append an accidental blank line to the prompt.
    return source.replace(/^\uFEFF/, "").trimEnd();
  }

  render(id: PromptTemplateId, variables: TemplateVariables): string {
    return this.renderSource(this.load(id), variables);
  }

  renderSource(source: string, variables: TemplateVariables): string {
    return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
      const value = variables[key];
      if (value === undefined || value === null) return "";
      return String(value);
    });
  }
}

export const defaultTemplateLoader: TemplateLoader = new MarkdownTemplateLoader();

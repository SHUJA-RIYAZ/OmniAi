import type { ContextSnapshot } from "@ai-context-bridge/shared";
import type { ProviderAdapter } from "./provider";
import { formatSnapshotAsMarkdown } from "./markdownFormatter";

function makeAdapter(
  id: string,
  displayName: string,
  hosts: string[],
  inputSelectors: string[],
): ProviderAdapter {
  return {
    id,
    displayName,
    inputSelectors,
    matchesUrl(url: string): boolean {
      try {
        const host = new URL(url).hostname;
        return hosts.some((h) => host === h || host.endsWith(`.${h}`));
      } catch {
        return false;
      }
    },
    formatContext(snapshot: ContextSnapshot): string {
      return formatSnapshotAsMarkdown(snapshot);
    },
  };
}

export const claudeAdapter = makeAdapter(
  "claude",
  "Claude",
  ["claude.ai"],
  ['div[contenteditable="true"]', "textarea"],
);

export const chatgptAdapter = makeAdapter(
  "chatgpt",
  "ChatGPT",
  ["chatgpt.com", "chat.openai.com"],
  ["#prompt-textarea", 'div[contenteditable="true"]', "textarea"],
);

export const geminiAdapter = makeAdapter(
  "gemini",
  "Gemini",
  ["gemini.google.com"],
  ['div[contenteditable="true"]', "textarea"],
);

export const builtInAdapters: ProviderAdapter[] = [claudeAdapter, chatgptAdapter, geminiAdapter];

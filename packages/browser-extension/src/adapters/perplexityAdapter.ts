import { BaseAdapter } from "./baseAdapter";
import { CHAT_UPLOAD_CAPABILITIES } from "./capabilities";
import type { AdapterDescriptor } from "./types";

export class PerplexityAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "perplexity",
      displayName: "Perplexity",
      hosts: ["www.perplexity.ai", "perplexity.ai"],
      promptSelectors: [
        "textarea#ask-input",
        "textarea[placeholder]",
        'div[contenteditable="true"]',
        "textarea",
      ],
      sendButtonSelectors: [
        'button[aria-label="Submit"]',
        'button[aria-label*="Submit"]',
        'button[type="submit"]',
      ],
      uploadButtonSelectors: [
        'button[aria-label*="Attach"]',
        'button[aria-label*="Upload"]',
        'input[type="file"]',
      ],
      capabilities: CHAT_UPLOAD_CAPABILITIES,
    });
  }
}

export const perplexityDescriptor: AdapterDescriptor = {
  id: "perplexity",
  displayName: "Perplexity",
  hosts: ["www.perplexity.ai", "perplexity.ai"],
  capabilities: CHAT_UPLOAD_CAPABILITIES,
  supportsFileUpload: CHAT_UPLOAD_CAPABILITIES.fileUpload,
  create: () => new PerplexityAdapter(),
};

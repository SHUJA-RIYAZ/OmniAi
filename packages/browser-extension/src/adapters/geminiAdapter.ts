import { BaseAdapter } from "./baseAdapter";
import { CHAT_UPLOAD_CAPABILITIES } from "./capabilities";
import type { AdapterDescriptor } from "./types";

export class GeminiAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "gemini",
      displayName: "Gemini",
      hosts: ["gemini.google.com"],
      promptSelectors: [
        'div[contenteditable="true"][aria-label]',
        'rich-textarea div[contenteditable="true"]',
        'div[contenteditable="true"]',
        "textarea",
      ],
      sendButtonSelectors: [
        'button[aria-label="Send message"]',
        'button[aria-label*="Send"]',
        'button[mattooltip*="Send"]',
      ],
      uploadButtonSelectors: [
        'button[aria-label*="Upload"]',
        'button[aria-label*="Open upload"]',
        'input[type="file"]',
      ],
      capabilities: CHAT_UPLOAD_CAPABILITIES,
    });
  }
}

export const geminiDescriptor: AdapterDescriptor = {
  id: "gemini",
  displayName: "Gemini",
  hosts: ["gemini.google.com"],
  capabilities: CHAT_UPLOAD_CAPABILITIES,
  supportsFileUpload: CHAT_UPLOAD_CAPABILITIES.fileUpload,
  create: () => new GeminiAdapter(),
};

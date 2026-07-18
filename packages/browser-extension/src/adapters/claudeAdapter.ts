import { BaseAdapter } from "./baseAdapter";
import { CHAT_UPLOAD_CAPABILITIES } from "./capabilities";
import type { AdapterDescriptor } from "./types";

export class ClaudeAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "claude",
      displayName: "Claude",
      hosts: ["claude.ai"],
      promptSelectors: [
        'div[contenteditable="true"].ProseMirror',
        'div[contenteditable="true"][data-testid]',
        'div[contenteditable="true"]',
        "fieldset textarea",
        "textarea",
      ],
      sendButtonSelectors: [
        'button[aria-label="Send Message"]',
        'button[aria-label="Send message"]',
        'button[type="button"][aria-label*="Send"]',
      ],
      uploadButtonSelectors: [
        'button[aria-label="Attach file"]',
        'button[aria-label*="Upload"]',
        'input[type="file"]',
      ],
      capabilities: CHAT_UPLOAD_CAPABILITIES,
    });
  }
}

export const claudeDescriptor: AdapterDescriptor = {
  id: "claude",
  displayName: "Claude",
  hosts: ["claude.ai"],
  capabilities: CHAT_UPLOAD_CAPABILITIES,
  supportsFileUpload: CHAT_UPLOAD_CAPABILITIES.fileUpload,
  create: () => new ClaudeAdapter(),
};

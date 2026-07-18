import { BaseAdapter } from "./baseAdapter";
import { CHAT_UPLOAD_CAPABILITIES } from "./capabilities";
import type { AdapterDescriptor } from "./types";

export class DeepSeekAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "deepseek",
      displayName: "DeepSeek",
      hosts: ["chat.deepseek.com", "deepseek.com"],
      promptSelectors: [
        "textarea#chat-input",
        "textarea[placeholder]",
        'div[contenteditable="true"]',
        "textarea",
      ],
      sendButtonSelectors: [
        'button[type="submit"]',
        'div[role="button"][aria-label*="Send"]',
        'button[aria-label*="Send"]',
      ],
      uploadButtonSelectors: ['button[aria-label*="Upload"]', 'input[type="file"]'],
      capabilities: CHAT_UPLOAD_CAPABILITIES,
    });
  }
}

export const deepseekDescriptor: AdapterDescriptor = {
  id: "deepseek",
  displayName: "DeepSeek",
  hosts: ["chat.deepseek.com", "deepseek.com"],
  capabilities: CHAT_UPLOAD_CAPABILITIES,
  supportsFileUpload: CHAT_UPLOAD_CAPABILITIES.fileUpload,
  create: () => new DeepSeekAdapter(),
};

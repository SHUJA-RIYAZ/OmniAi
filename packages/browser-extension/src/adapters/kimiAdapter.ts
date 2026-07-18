import { BaseAdapter } from "./baseAdapter";
import { CHAT_UPLOAD_CAPABILITIES } from "./capabilities";
import type { AdapterDescriptor } from "./types";

export class KimiAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "kimi",
      displayName: "Kimi",
      hosts: ["kimi.moonshot.cn", "www.kimi.com", "kimi.com", "kimi.ai"],
      promptSelectors: [
        'div[contenteditable="true"].chat-input',
        'div[contenteditable="true"]',
        "textarea.chat-input",
        "textarea",
      ],
      sendButtonSelectors: [
        'button[aria-label*="Send"]',
        "button.send-button",
        'div[role="button"].send-button',
      ],
      uploadButtonSelectors: ['button[aria-label*="Upload"]', 'input[type="file"]'],
      capabilities: CHAT_UPLOAD_CAPABILITIES,
    });
  }
}

export const kimiDescriptor: AdapterDescriptor = {
  id: "kimi",
  displayName: "Kimi",
  hosts: ["kimi.moonshot.cn", "www.kimi.com", "kimi.com", "kimi.ai"],
  capabilities: CHAT_UPLOAD_CAPABILITIES,
  supportsFileUpload: CHAT_UPLOAD_CAPABILITIES.fileUpload,
  create: () => new KimiAdapter(),
};

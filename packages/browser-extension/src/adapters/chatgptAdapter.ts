import { BaseAdapter } from "./baseAdapter";
import { CHAT_UPLOAD_CAPABILITIES } from "./capabilities";
import type { AdapterDescriptor } from "./types";

export class ChatGptAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "chatgpt",
      displayName: "ChatGPT",
      hosts: ["chatgpt.com", "chat.openai.com"],
      promptSelectors: [
        "#prompt-textarea",
        'div[contenteditable="true"]#prompt-textarea',
        'div[contenteditable="true"][data-placeholder]',
        'div[contenteditable="true"]',
        "textarea",
      ],
      sendButtonSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send message"]',
        'form button[type="submit"]',
      ],
      uploadButtonSelectors: [
        'button[aria-label="Attach files"]',
        'button[aria-label="Upload files"]',
        'input[type="file"]',
      ],
      capabilities: CHAT_UPLOAD_CAPABILITIES,
    });
  }
}

export const chatgptDescriptor: AdapterDescriptor = {
  id: "chatgpt",
  displayName: "ChatGPT",
  hosts: ["chatgpt.com", "chat.openai.com"],
  capabilities: CHAT_UPLOAD_CAPABILITIES,
  supportsFileUpload: CHAT_UPLOAD_CAPABILITIES.fileUpload,
  create: () => new ChatGptAdapter(),
};

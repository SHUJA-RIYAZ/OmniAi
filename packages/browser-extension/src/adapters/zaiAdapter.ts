import { BaseAdapter } from "./baseAdapter";
import { DEFAULT_CAPABILITIES } from "./capabilities";
import type { AdapterDescriptor } from "./types";

export class ZaiAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "zai",
      displayName: "Z.ai",
      hosts: ["chat.z.ai", "z.ai", "www.z.ai"],
      promptSelectors: [
        "textarea[placeholder]",
        'div[contenteditable="true"]',
        "textarea",
      ],
      sendButtonSelectors: [
        'button[type="submit"]',
        'button[aria-label*="Send"]',
        'div[role="button"][aria-label*="Send"]',
      ],
      uploadButtonSelectors: ['button[aria-label*="Upload"]', 'input[type="file"]'],
      capabilities: DEFAULT_CAPABILITIES,
    });
  }
}

export const zaiDescriptor: AdapterDescriptor = {
  id: "zai",
  displayName: "Z.ai",
  hosts: ["chat.z.ai", "z.ai", "www.z.ai"],
  capabilities: DEFAULT_CAPABILITIES,
  supportsFileUpload: DEFAULT_CAPABILITIES.fileUpload,
  create: () => new ZaiAdapter(),
};

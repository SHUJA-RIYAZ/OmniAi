/**
 * Declared provider feature surface. Callers must use this instead of
 * hardcoded provider-id checks.
 */
export interface ProviderCapabilities {
  promptInjection: boolean;
  autoSend: boolean;
  fileUpload: boolean;
  multipleFiles: boolean;
  markdown: boolean;
  images: boolean;
  readConversation: boolean;
  conversationSync: boolean;
}

export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  promptInjection: true,
  autoSend: true,
  fileUpload: false,
  multipleFiles: false,
  markdown: true,
  images: false,
  readConversation: false,
  conversationSync: false,
};

/** Common capability profile for major chat UIs with attachment support. */
export const CHAT_UPLOAD_CAPABILITIES: ProviderCapabilities = {
  ...DEFAULT_CAPABILITIES,
  fileUpload: true,
  multipleFiles: true,
  images: true,
};

export function mergeCapabilities(
  partial: Partial<ProviderCapabilities>,
): ProviderCapabilities {
  return { ...DEFAULT_CAPABILITIES, ...partial };
}

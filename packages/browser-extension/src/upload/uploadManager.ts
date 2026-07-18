import type { AIAdapter } from "../adapters/types";
import { ExtensionError } from "../types/errors";
import { rootLogger } from "../utils/logger";

export interface UploadCapability {
  supported: boolean;
  providerId: string;
  hasUploadControl: boolean;
}

/**
 * Phase 3: capability discovery only.
 * Actual automatic uploads land in Phase 4.
 */
export class UploadManager {
  private readonly log = rootLogger.child("Provider");

  getCapability(adapter: AIAdapter): UploadCapability {
    const supported = adapter.capabilities().fileUpload;
    const hasUploadControl = supported && adapter.getUploadButton() != null;
    this.log.debug("Upload capability", {
      providerId: adapter.id(),
      supported,
      hasUploadControl,
    });
    return {
      supported,
      providerId: adapter.id(),
      hasUploadControl,
    };
  }

  async uploadFiles(adapter: AIAdapter, files: File[]): Promise<void> {
    const capability = this.getCapability(adapter);
    if (!capability.supported) {
      throw new ExtensionError(
        "UPLOAD_UNSUPPORTED",
        `${adapter.displayName()} does not support file uploads.`,
        { providerId: adapter.id() },
      );
    }
    // Delegate to adapter stub (throws until Phase 4).
    await adapter.uploadFiles(files);
  }
}

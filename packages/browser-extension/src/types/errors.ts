/** Typed errors for the browser orchestration layer. */
export type ExtensionErrorCode =
  | "BRIDGE_OFFLINE"
  | "UNSUPPORTED_WEBSITE"
  | "PROMPT_NOT_FOUND"
  | "PROVIDER_CHANGED"
  | "DOM_CHANGED"
  | "TIMEOUT"
  | "NO_CONTEXT"
  | "UPLOAD_UNSUPPORTED"
  | "SEND_FAILED"
  | "UNKNOWN";

export class ExtensionError extends Error {
  readonly code: ExtensionErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ExtensionErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ExtensionError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function isExtensionError(err: unknown): err is ExtensionError {
  return err instanceof ExtensionError;
}

export function toErrorMessage(err: unknown): string {
  if (isExtensionError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function toErrorCode(err: unknown): ExtensionErrorCode {
  if (isExtensionError(err)) return err.code;
  return "UNKNOWN";
}

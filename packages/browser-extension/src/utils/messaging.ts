import type { ExtensionMessage, MessageResult } from "../types/messages";
import { toErrorMessage } from "../types/errors";

/** Send a typed runtime message and unwrap the MessageResult envelope. */
export async function sendMessage<T>(
  message: ExtensionMessage,
): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as MessageResult<T> | undefined;
  if (!response) {
    throw new Error("No response from extension background.");
  }
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

/** Wrap an async handler into a chrome.runtime message response. */
export function asMessageResult<T>(
  fn: () => Promise<T>,
): Promise<MessageResult<T>> {
  return fn()
    .then((data): MessageResult<T> => ({ ok: true, data }))
    .catch((err: unknown): MessageResult<T> => {
      const result: MessageResult<T> = {
        ok: false,
        error: toErrorMessage(err),
      };
      if (err && typeof err === "object" && "code" in err && typeof err.code === "string") {
        result.code = err.code;
      }
      return result;
    });
}

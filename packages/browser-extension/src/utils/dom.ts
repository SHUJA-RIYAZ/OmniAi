/**
 * DOM helpers for adapters. No provider-specific logic lives here.
 */

/** Query the first matching element from an ordered selector list. */
export function queryFirst<T extends Element = Element>(
  selectors: readonly string[],
  root: ParentNode = document,
): T | null {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el as T;
  }
  return null;
}

/** Insert text into a textarea/input or contenteditable, notifying frameworks. */
export function insertTextIntoElement(el: HTMLElement, text: string): void {
  el.focus();

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) {
      descriptor.set.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  // contenteditable
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);

  let inserted = false;
  if (typeof document.execCommand === "function") {
    inserted = document.execCommand("insertText", false, text);
  }
  if (!inserted) {
    el.textContent = text;
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }),
    );
  }
}

/** Click an element if present and enabled. */
export function clickElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLButtonElement && el.disabled) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  el.click();
  return true;
}

/**
 * Wait until `predicate` returns a truthy value, using MutationObserver
 * (no polling timers for DOM inspection beyond a single timeout).
 */
export function waitForElement<T>(
  predicate: () => T | null | undefined,
  options: { timeoutMs?: number; root?: Node } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const root = options.root ?? document.documentElement;

  const immediate = predicate();
  if (immediate != null) return Promise.resolve(immediate);

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(value);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      reject(err);
    };

    const observer = new MutationObserver(() => {
      const value = predicate();
      if (value != null) finish(value);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const timer = setTimeout(() => {
      fail(new Error(`Timed out after ${timeoutMs}ms waiting for DOM element`));
    }, timeoutMs);
  });
}

/** Hostname match helper: exact or subdomain. */
export function hostMatches(hostname: string, hosts: readonly string[]): boolean {
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

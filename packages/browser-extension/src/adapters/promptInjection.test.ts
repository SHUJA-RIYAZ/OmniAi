/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExtensionError } from "../types/errors";
import { ChatGptAdapter } from "./chatgptAdapter";
import { ClaudeAdapter } from "./claudeAdapter";

describe("prompt injection (DOM adapters)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("inserts into ChatGPT textarea via native value path", async () => {
    document.body.innerHTML = `
      <textarea id="prompt-textarea"></textarea>
      <button data-testid="send-button">Send</button>
    `;
    const adapter = new ChatGptAdapter();
    await adapter.insertPrompt("hello from bridge");
    const el = document.querySelector("#prompt-textarea") as HTMLTextAreaElement;
    expect(el.value).toBe("hello from bridge");
  });

  it("inserts into Claude contenteditable", async () => {
    document.body.innerHTML = `
      <div contenteditable="true" class="ProseMirror"></div>
      <button aria-label="Send Message">Send</button>
    `;
    const adapter = new ClaudeAdapter();
    await adapter.insertPrompt("claude context");
    const el = document.querySelector(".ProseMirror") as HTMLElement;
    expect(el.textContent).toContain("claude context");
  });

  it("throws PROMPT_NOT_FOUND when input is missing", async () => {
    document.body.innerHTML = `<div>no input</div>`;
    const adapter = new ChatGptAdapter();
    vi.spyOn(adapter, "waitUntilReady").mockRejectedValue(
      new ExtensionError("TIMEOUT", "timed out"),
    );
    await expect(adapter.insertPrompt("x")).rejects.toMatchObject({
      code: "PROMPT_NOT_FOUND",
    });
  });

  it("clicks send when requested", async () => {
    let clicks = 0;
    document.body.innerHTML = `
      <textarea id="prompt-textarea"></textarea>
      <button data-testid="send-button">Send</button>
    `;
    document.querySelector("button")!.addEventListener("click", () => {
      clicks += 1;
    });
    const adapter = new ChatGptAdapter();
    await adapter.insertPrompt("go");
    await adapter.send();
    expect(clicks).toBe(1);
  });
});

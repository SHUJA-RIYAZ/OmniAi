import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../types/settings";
import type { ExtensionStatus } from "../types/messages";
import { deriveStatusLabels } from "./statusView";

function baseStatus(overrides: Partial<ExtensionStatus> = {}): ExtensionStatus {
  return {
    bridge: { online: true, version: "0.1.0" },
    provider: {
      id: "chatgpt",
      displayName: "ChatGPT",
      url: "https://chatgpt.com/",
      isChatPage: true,
      supportsFileUpload: true,
    },
    projectName: "demo",
    snapshotId: "s1",
    conversation: null,
    settings: DEFAULT_SETTINGS,
    tabUrl: "https://chatgpt.com/",
    ...overrides,
  };
}

describe("popup status view", () => {
  it("shows ready state when bridge and provider are available", () => {
    const labels = deriveStatusLabels(baseStatus());
    expect(labels.bridge).toEqual({ text: "Online (v0.1.0)", kind: "ok" });
    expect(labels.provider.text).toBe("ChatGPT");
    expect(labels.project.text).toBe("demo");
    expect(labels.connection).toEqual({ text: "Ready", kind: "ok" });
    expect(labels.sendEnabled).toBe(true);
  });

  it("marks bridge offline and disables readiness", () => {
    const labels = deriveStatusLabels(
      baseStatus({
        bridge: { online: false, error: "down" },
      }),
    );
    expect(labels.bridge).toEqual({ text: "Offline", kind: "err" });
    expect(labels.connection.kind).toBe("warn");
  });

  it("handles unsupported pages", () => {
    const labels = deriveStatusLabels(
      baseStatus({
        provider: null,
        projectName: null,
      }),
    );
    expect(labels.provider).toEqual({ text: "Unsupported page", kind: "warn" });
    expect(labels.currentAi).toEqual({ text: "—", kind: "muted" });
    expect(labels.project.text).toBe("No snapshot");
    expect(labels.sendEnabled).toBe(false);
  });
});

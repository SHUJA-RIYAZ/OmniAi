import { describe, expect, it } from "vitest";
import {
  BROWSER_FEATURE_FLAGS,
  DEFAULT_BROWSER_FLAGS,
  InMemoryFeatureFlags,
} from "./featureFlags";

describe("FeatureFlags", () => {
  it("defaults all future flags to false", () => {
    const flags = new InMemoryFeatureFlags();
    for (const flag of Object.values(BROWSER_FEATURE_FLAGS)) {
      expect(flags.isEnabled(flag)).toBe(false);
    }
    expect(flags.getAll()).toEqual(DEFAULT_BROWSER_FLAGS);
  });

  it("allows overrides for future enablement", () => {
    const flags = new InMemoryFeatureFlags({ replyReading: true });
    expect(flags.isEnabled("replyReading")).toBe(true);
    expect(flags.isEnabled("automaticFileUpload")).toBe(false);

    flags.set("workflowAutomation", true);
    expect(flags.isEnabled("workflowAutomation")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { HeuristicTokenEstimator } from "@ai-context-bridge/context-engine";
import { ContextSelectionService } from "@ai-context-bridge/context-engine";
import { renderInspectorHtml } from "./inspectorView";
import {
  LineAnalyzer,
  makeFileSystem,
  makeInput,
} from "../../../context-engine/src/context-selection/testing/fixtures";

async function makeData() {
  const service = new ContextSelectionService({
    fs: makeFileSystem(),
    estimator: new HeuristicTokenEstimator(),
    analyzer: new LineAnalyzer(),
  });
  const { selection, prompt } = await service.select(makeInput(), { maxTokens: 8000 });
  return { selection, prompt, collectionTimeMs: 42 };
}

describe("renderInspectorHtml", () => {
  it("renders budget, files, symbols, and action buttons", async () => {
    const html = renderInspectorHtml(await makeData());

    expect(html).toContain("Context Inspector — hybrid strategy");
    expect(html).toContain("8,000 tokens");
    expect(html).toContain("main.py");
    expect(html).toContain('id="refresh"');
    expect(html).toContain('id="copy"');
    expect(html).toContain('id="export"');
    expect(html).toContain("Selection time");
    expect(html).toContain("Collection time");
    expect(html).toContain("login"); // top symbol
  });

  it("escapes HTML in file paths and symbols", async () => {
    const data = await makeData();
    data.selection.items[0]!.filePath = "<script>alert(1)</script>.py";
    const html = renderInspectorHtml(data);
    expect(html).not.toContain("<script>alert(1)</script>.py");
    expect(html).toContain("&lt;script&gt;");
  });
});

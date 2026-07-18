import { describe, expect, it } from "vitest";
import { PromptManager } from "./promptManager";
import { MarkdownTemplateLoader } from "./templateLoader";

describe("TemplateLoader", () => {
  it("substitutes template variables", () => {
    const loader = new MarkdownTemplateLoader({
      sendContext: "Hello {{projectName}}\n\n{{formattedContext}}",
      copyContext: "{{formattedContext}}",
      fixError: "",
      reviewCode: "",
      generateTests: "",
      continueConversation: "",
    });

    expect(
      loader.render("sendContext", {
        projectName: "demo",
        formattedContext: "BODY",
      }),
    ).toBe("Hello demo\n\nBODY");
  });

  it("loads built-in sendContext/copyContext templates", () => {
    const loader = new MarkdownTemplateLoader();
    expect(loader.ids()).toContain("sendContext");
    expect(loader.ids()).toContain("fixError");
    expect(loader.load("sendContext")).toContain("{{formattedContext}}");
  });

  it("PromptManager applies templates around formatter output", () => {
    const loader = new MarkdownTemplateLoader({
      sendContext: "TPL:{{formattedContext}}",
      copyContext: "COPY:{{formattedContext}}",
      fixError: "",
      reviewCode: "",
      generateTests: "",
      continueConversation: "",
    });

    const manager = new PromptManager({
      formatter: (s) => `F:${s.workspace.name}`,
      templates: loader,
    });

    const built = manager.build(
      {
        id: "1",
        createdAt: "2026-01-01T00:00:00.000Z",
        schemaVersion: 2,
        workspace: {
          name: "demo",
          rootPath: "/",
          languages: [],
          manifests: [],
        },
        diagnostics: [],
      },
      "sendContext",
    );

    expect(built.prompt).toBe("TPL:F:demo");
    expect(built.templateId).toBe("sendContext");
  });
});

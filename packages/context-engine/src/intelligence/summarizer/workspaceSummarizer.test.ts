import { describe, expect, it } from "vitest";
import { ManifestWorkspaceSummarizer } from "./workspaceSummarizer";
import { InMemoryFileSystem } from "../testing/inMemoryFileSystem";

describe("ManifestWorkspaceSummarizer", () => {
  it("detects a FastAPI backend project", async () => {
    const fs = new InMemoryFileSystem({
      "pyproject.toml": '[project]\ndependencies = ["fastapi>=0.111", "sqlalchemy>=2"]',
      "requirements.txt": "",
      "uv.lock": "",
    });
    const summary = await new ManifestWorkspaceSummarizer(fs).summarize(["python"]);

    expect(summary.projectType).toBe("backend");
    expect(summary.frameworks.backend).toBe("FastAPI");
    expect(summary.frameworks.database).toBe("SQLAlchemy");
    expect(summary.frameworks.packageManager).toBe("uv");
    expect(summary.languages).toEqual(["python"]);
  });

  it("detects a Next.js frontend and prefers Next.js over React", async () => {
    const fs = new InMemoryFileSystem({
      "package.json": '{"dependencies": {"next": "14", "react": "18"}}',
      "pnpm-lock.yaml": "",
    });
    const summary = await new ManifestWorkspaceSummarizer(fs).summarize(["typescript"]);

    expect(summary.projectType).toBe("frontend");
    expect(summary.frameworks.frontend).toBe("Next.js");
    expect(summary.frameworks.packageManager).toBe("pnpm");
  });

  it("detects fullstack when both sides are present", async () => {
    const fs = new InMemoryFileSystem({
      "package.json": '{"dependencies": {"react": "18"}, "devDependencies": {"vite": "5"}}',
      "requirements.txt": "django==5.0",
    });
    const summary = await new ManifestWorkspaceSummarizer(fs).summarize([]);

    expect(summary.projectType).toBe("fullstack");
    expect(summary.frameworks.backend).toBe("Django");
    expect(summary.frameworks.buildTool).toBe("Vite");
  });

  it("detects Spring Boot via pom.xml", async () => {
    const fs = new InMemoryFileSystem({
      "pom.xml": "<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>",
    });
    const summary = await new ManifestWorkspaceSummarizer(fs).summarize(["java"]);
    expect(summary.frameworks.backend).toBe("Spring Boot");
    expect(summary.frameworks.packageManager).toBe("maven");
    expect(summary.projectType).toBe("backend");
  });

  it("detects Laravel via composer.json", async () => {
    const fs = new InMemoryFileSystem({
      "composer.json": '{"require": {"laravel/framework": "^11.0"}}',
    });
    const summary = await new ManifestWorkspaceSummarizer(fs).summarize(["php"]);
    expect(summary.frameworks.backend).toBe("Laravel");
    expect(summary.frameworks.packageManager).toBe("composer");
  });

  it("detects ASP.NET via appsettings.json", async () => {
    const fs = new InMemoryFileSystem({ "appsettings.json": "{}" });
    const summary = await new ManifestWorkspaceSummarizer(fs).summarize(["csharp"]);
    expect(summary.frameworks.backend).toBe("ASP.NET");
  });

  it("detects NestJS before Express", async () => {
    const fs = new InMemoryFileSystem({
      "package.json": '{"dependencies": {"@nestjs/core": "10", "express": "4"}}',
    });
    const summary = await new ManifestWorkspaceSummarizer(fs).summarize(["typescript"]);
    expect(summary.frameworks.backend).toBe("NestJS");
  });

  it("degrades to unknown for empty workspaces", async () => {
    const summary = await new ManifestWorkspaceSummarizer(new InMemoryFileSystem()).summarize([]);
    expect(summary.projectType).toBe("unknown");
    expect(summary.frameworks).toEqual({});
  });
});

import { describe, expect, it } from "vitest";
import type { ImportInfo } from "@ai-context-bridge/shared";
import { PythonModuleResolver } from "./pythonModuleResolver";
import { InMemoryFileSystem } from "../testing/inMemoryFileSystem";

const fs = new InMemoryFileSystem({
  "app/main.py": "",
  "app/__init__.py": "",
  "app/models/user.py": "",
  "app/models/__init__.py": "",
  "app/services/users.py": "",
  "src/utils/helpers.py": "",
});

const resolver = new PythonModuleResolver(fs);

function imp(partial: Partial<ImportInfo>): ImportInfo {
  return { module: "", names: [], isRelative: false, level: 0, line: 1, ...partial };
}

describe("PythonModuleResolver", () => {
  it("resolves absolute module imports to files and packages", async () => {
    expect(await resolver.resolve(imp({ module: "app.models.user" }), "app/main.py")).toEqual([
      "app/models/user.py",
    ]);
    expect(await resolver.resolve(imp({ module: "app.models" }), "app/main.py")).toEqual([
      "app/models/__init__.py",
    ]);
  });

  it("resolves `from pkg import submodule` where the name is a module", async () => {
    const result = await resolver.resolve(
      imp({ module: "app.models", names: [{ name: "user" }] }),
      "app/main.py",
    );
    expect(result).toContain("app/models/user.py");
  });

  it("resolves relative imports", async () => {
    // from .user import User — inside app/services/users.py? use models dir
    const single = await resolver.resolve(
      imp({ module: "user", isRelative: true, level: 1 }),
      "app/models/__init__.py",
    );
    expect(single).toEqual(["app/models/user.py"]);

    // from ..models.user import User — from app/services/users.py
    const double = await resolver.resolve(
      imp({ module: "models.user", isRelative: true, level: 2 }),
      "app/services/users.py",
    );
    expect(double).toEqual(["app/models/user.py"]);
  });

  it("checks configured source roots for absolute imports", async () => {
    expect(await resolver.resolve(imp({ module: "utils.helpers" }), "app/main.py")).toEqual([
      "src/utils/helpers.py",
    ]);
  });

  it("resolves third-party imports to nothing", async () => {
    expect(await resolver.resolve(imp({ module: "fastapi" }), "app/main.py")).toEqual([]);
  });
});

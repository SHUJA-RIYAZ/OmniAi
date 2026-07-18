import type { ContextSnapshot, FileAnalysis } from "@ai-context-bridge/shared";
import type { ILanguageAnalyzer } from "../../intelligence/interfaces";
import { makeAnalysis, makeCall, makeFunction } from "../../intelligence/testing/fakes";
import { InMemoryFileSystem } from "../../intelligence/testing/inMemoryFileSystem";
import type { SelectionInput } from "../models";

/** Line-based analyzer for tests: extracts `def name(...)` signatures. */
export class LineAnalyzer implements ILanguageAnalyzer {
  supports = (languageId: string) => languageId === "python";

  async analyze(source: string, _lang: string, path?: string): Promise<FileAnalysis> {
    const functions = [];
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const def = /^def (\w+)\(/.exec(lines[i] as string);
      if (def) {
        functions.push(
          makeFunction({
            name: def[1] as string,
            startLine: i + 1,
            endLine: i + 2,
            ...(path ? { id: `python://${path}/${def[1]}` } : {}),
          }),
        );
      }
    }
    return makeAnalysis({ functions });
  }
}

/**
 * Canonical Phase 3 test workspace:
 *
 *   main.py (current; login() calls jwt.create_token + database.get_db)
 *     ├─ imports jwt.py        (call target)
 *     ├─ imports database.py   (call target)
 *     └─ imports models.py ─── imports config.py   (depth 2)
 *   utils.py    only has a diagnostic
 *   changed.py  only appears in the git diff
 */

export const SOURCES: Record<string, string> = {
  "main.py": [
    "from jwt import create_token",
    "from database import get_db",
    "import models",
    "",
    "",
    "def login(user: str) -> dict:",
    '    """Log a user in."""',
    "    token = create_token(user)",
    "    db = get_db()",
    "    return {'token': token}",
  ].join("\n"),
  "jwt.py": "def create_token(user):\n    return 'token-' + user\n",
  "database.py": "def get_db():\n    return object()\n",
  "models.py": "import config\n\nclass User:\n    name: str\n",
  "config.py": "DEBUG = True\n" + "OPTIONS = {\n" + "    'a': 1,\n".repeat(20) + "}\n",
  "utils.py": "def helper():\n    pass\n",
  "changed.py": "def new_feature():\n    pass\n",
};

export function makeFileSystem(): InMemoryFileSystem {
  return new InMemoryFileSystem(SOURCES);
}

export function makeSnapshot(): ContextSnapshot {
  const currentFunction = makeFunction({
    name: "login",
    startLine: 6,
    endLine: 10,
    docstring: "Log a user in.",
    calls: [
      makeCall("jwt.create_token", { module: "jwt", type: "workspace", resolved: true }),
      makeCall("database.get_db", { module: "database", type: "workspace", resolved: true }),
    ],
  });

  return {
    id: "phase3-fixture",
    createdAt: "2026-07-16T00:00:00Z",
    schemaVersion: 2,
    workspace: {
      name: "demo-app",
      rootPath: "/demo",
      languages: ["python"],
      manifests: ["pyproject.toml"],
    },
    activeFile: {
      filePath: "main.py",
      languageId: "python",
      content: SOURCES["main.py"] as string,
      truncated: false,
      lineCount: 10,
    },
    diagnostics: [
      { filePath: "utils.py", line: 1, column: 1, severity: "error", message: "boom" },
      { filePath: "main.py", line: 8, column: 5, severity: "warning", message: "hmm" },
    ],
    gitDiff: {
      diff: [
        "diff --git a/changed.py b/changed.py",
        "+def new_feature():",
        "diff --git a/main.py b/main.py",
        "+    db = get_db()",
      ].join("\n"),
      truncated: false,
      branch: "main",
    },
    intelligence: {
      currentFunction,
      fileAnalysis: makeAnalysis({
        imports: [
          { module: "jwt", names: [{ name: "create_token" }], isRelative: false, level: 0, line: 1 },
          { module: "database", names: [{ name: "get_db" }], isRelative: false, level: 0, line: 2 },
          { module: "models", names: [], isRelative: false, level: 0, line: 3 },
        ],
        functions: [currentFunction],
      }),
      dependencyGraph: {
        rootFile: "main.py",
        files: ["main.py", "jwt.py", "database.py", "models.py", "config.py"],
        edges: [
          { from: "main.py", to: "jwt.py", type: "import" },
          { from: "main.py", to: "jwt.py", type: "call" },
          { from: "main.py", to: "database.py", type: "import" },
          { from: "main.py", to: "database.py", type: "call" },
          { from: "main.py", to: "models.py", type: "import" },
          { from: "models.py", to: "config.py", type: "import" },
        ],
        maxDepth: 3,
        truncated: false,
      },
      workspaceSummary: {
        projectType: "backend",
        frameworks: { backend: "FastAPI", packageManager: "uv" },
        languages: ["python"],
      },
      relatedFiles: [
        { filePath: "main.py", reason: "current", priority: 100, depth: 0 },
        { filePath: "jwt.py", reason: "calls", priority: 95, depth: 1, symbols: ["create_token"] },
        { filePath: "database.py", reason: "calls", priority: 94, depth: 1, symbols: ["get_db"] },
        { filePath: "models.py", reason: "imported", priority: 80, depth: 1 },
      ],
    },
  };
}

export function makeInput(currentTask?: string): SelectionInput {
  return { snapshot: makeSnapshot(), ...(currentTask ? { currentTask } : {}) };
}

import type { DetectedFrameworks, WorkspaceSummary } from "@ai-context-bridge/shared";
import type { IFileSystem, IWorkspaceSummarizer } from "../interfaces";

interface Detection {
  /** Substring to look for in the dependency source text. */
  needle: string;
  label: string;
}

// Order matters: more specific frameworks first (Next.js before React).
const FRONTEND: Detection[] = [
  { needle: '"next"', label: "Next.js" },
  { needle: '"@angular/core"', label: "Angular" },
  { needle: '"vue"', label: "Vue" },
  { needle: '"svelte"', label: "Svelte" },
  { needle: '"react"', label: "React" },
];

const NODE_BACKEND: Detection[] = [
  { needle: '"@nestjs/core"', label: "NestJS" },
  { needle: '"fastify"', label: "Fastify" },
  { needle: '"express"', label: "Express" },
];

const PYTHON_BACKEND: Detection[] = [
  { needle: "fastapi", label: "FastAPI" },
  { needle: "django", label: "Django" },
  { needle: "flask", label: "Flask" },
];

const DATABASE: Detection[] = [
  { needle: '"prisma"', label: "Prisma" },
  { needle: '"mongoose"', label: "Mongoose" },
  { needle: "sqlalchemy", label: "SQLAlchemy" },
  { needle: "psycopg", label: "PostgreSQL (psycopg)" },
  { needle: "pymongo", label: "MongoDB (pymongo)" },
];

const BUILD_TOOL: Detection[] = [
  { needle: '"vite"', label: "Vite" },
  { needle: '"webpack"', label: "Webpack" },
  { needle: '"esbuild"', label: "esbuild" },
];

const PACKAGE_MANAGER_FILES: Array<[string, string]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["poetry.lock", "poetry"],
  ["uv.lock", "uv"],
  ["requirements.txt", "pip"],
];

/**
 * Detects project type, frameworks, database layer, build tool, and package
 * manager by inspecting manifests at the workspace root. Purely heuristic
 * and read-only; unknown stacks degrade to empty fields, never errors.
 */
export class ManifestWorkspaceSummarizer implements IWorkspaceSummarizer {
  constructor(private readonly fs: IFileSystem) {}

  async summarize(languages: string[]): Promise<WorkspaceSummary> {
    const packageJson = (await this.fs.readFile("package.json")) ?? "";
    const pythonDeps = [
      (await this.fs.readFile("pyproject.toml")) ?? "",
      (await this.fs.readFile("requirements.txt")) ?? "",
    ]
      .join("\n")
      .toLowerCase();

    const frameworks: DetectedFrameworks = {};

    const frontend = detect(FRONTEND, packageJson);
    if (frontend) frameworks.frontend = frontend;

    const backend = detect(PYTHON_BACKEND, pythonDeps) ?? detect(NODE_BACKEND, packageJson);
    if (backend) frameworks.backend = backend;

    const database = detect(DATABASE, packageJson) ?? detect(DATABASE, pythonDeps);
    if (database) frameworks.database = database;

    const buildTool = detect(BUILD_TOOL, packageJson);
    if (buildTool) frameworks.buildTool = buildTool;

    for (const [file, manager] of PACKAGE_MANAGER_FILES) {
      if (await this.fs.exists(file)) {
        frameworks.packageManager = manager;
        break;
      }
    }

    return {
      projectType: projectType(frameworks, packageJson, pythonDeps),
      frameworks,
      languages,
    };
  }
}

function detect(detections: Detection[], haystack: string): string | undefined {
  return detections.find((d) => haystack.includes(d.needle))?.label;
}

function projectType(
  frameworks: DetectedFrameworks,
  packageJson: string,
  pythonDeps: string,
): WorkspaceSummary["projectType"] {
  if (frameworks.backend && frameworks.frontend) return "fullstack";
  if (frameworks.backend) return "backend";
  if (frameworks.frontend) return "frontend";
  if (packageJson.trim() || pythonDeps.trim()) return "library";
  return "unknown";
}

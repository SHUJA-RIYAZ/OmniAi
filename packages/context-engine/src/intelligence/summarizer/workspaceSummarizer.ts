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

const JAVA_BACKEND: Detection[] = [
  { needle: "spring-boot", label: "Spring Boot" },
  { needle: "springframework", label: "Spring" },
];

const PHP_BACKEND: Detection[] = [{ needle: "laravel/framework", label: "Laravel" }];

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
  ["pom.xml", "maven"],
  ["build.gradle", "gradle"],
  ["composer.json", "composer"],
  ["go.mod", "go modules"],
  ["Cargo.toml", "cargo"],
];

/**
 * Detects project type, frameworks, database layer, build tool, and package
 * manager by inspecting manifests at the workspace root. Purely heuristic
 * and read-only; unknown stacks degrade to empty fields, never errors.
 */
export class ManifestWorkspaceSummarizer implements IWorkspaceSummarizer {
  constructor(private readonly fs: IFileSystem) {}

  async summarize(languages: string[]): Promise<WorkspaceSummary> {
    const read = async (file: string) => (await this.fs.readFile(file)) ?? "";
    const packageJson = await read("package.json");
    const pythonDeps = [await read("pyproject.toml"), await read("requirements.txt")]
      .join("\n")
      .toLowerCase();
    const pomXml = (await read("pom.xml")) + (await read("build.gradle"));
    const composerJson = await read("composer.json");

    const frameworks: DetectedFrameworks = {};

    const frontend = detect(FRONTEND, packageJson);
    if (frontend) frameworks.frontend = frontend;

    const backend =
      detect(PYTHON_BACKEND, pythonDeps) ??
      detect(NODE_BACKEND, packageJson) ??
      detect(JAVA_BACKEND, pomXml) ??
      detect(PHP_BACKEND, composerJson) ??
      // .csproj names vary; appsettings.json is the stable ASP.NET marker.
      ((await this.fs.exists("appsettings.json")) ? "ASP.NET" : undefined);
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
      projectType: projectType(frameworks, [packageJson, pythonDeps, pomXml, composerJson]),
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
  manifestTexts: string[],
): WorkspaceSummary["projectType"] {
  if (frameworks.backend && frameworks.frontend) return "fullstack";
  if (frameworks.backend) return "backend";
  if (frameworks.frontend) return "frontend";
  if (manifestTexts.some((text) => text.trim().length > 0)) return "library";
  return "unknown";
}

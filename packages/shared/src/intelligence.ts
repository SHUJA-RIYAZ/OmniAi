/**
 * Phase 2 wire types: structured code intelligence attached to a
 * {@link ContextSnapshot} as the optional `intelligence` field.
 * Mirrored in Python by `apps/local-bridge/bridge/analysis/models.py`.
 */

export type Visibility = "public" | "protected" | "private";

/** One import statement. Covers `import x`, `import x as y`, `from a.b import c as d`, relative imports. */
export interface ImportInfo {
  /** Dotted module path; empty string for `from . import x`. */
  module: string;
  /** Alias for plain `import module as alias`. */
  alias?: string;
  /** Symbols brought in by `from module import ...`; empty for plain imports. */
  names: ImportedName[];
  isRelative: boolean;
  /** Number of leading dots for relative imports; 0 otherwise. */
  level: number;
  line: number;
}

export interface ImportedName {
  name: string;
  alias?: string;
}

export interface ArgumentInfo {
  name: string;
  type?: string;
  default?: string;
}

/** Where a call target lives, as far as static analysis can tell. */
export type CallTargetType = "local" | "workspace" | "builtin" | "thirdparty" | "unknown";

/**
 * One call site inside a function body (schema v2; v1 stored bare dotted
 * strings — see `migrateSnapshot`). The analyzer classifies what it can
 * from a single file; the engine's `CallResolver` upgrades `unknown` calls
 * to `workspace`/`thirdparty` using module resolution.
 */
export interface CallInfo {
  /** Bare callable name, e.g. "create_token". */
  name: string;
  /** Dotted name as written or resolved, e.g. "jwt.create_token". */
  qualifiedName: string;
  /** Module the callable comes from, when known. */
  module?: string;
  /** 1-based line of the call site. */
  line: number;
  /** True once the target has been located (same file, or a workspace file). */
  resolved: boolean;
  type: CallTargetType;
}

export interface FunctionInfo {
  /** Stable symbol id: `python://<filePath>/<qualifiedName>` (see ContextSchema.md). */
  id?: string;
  name: string;
  /** `ClassName.method` for methods, otherwise same as `name`. */
  qualifiedName: string;
  args: ArgumentInfo[];
  returnType?: string;
  decorators: string[];
  docstring?: string;
  startLine: number;
  endLine: number;
  /** Call sites inside the body, deduplicated by qualified name, in order. */
  calls: CallInfo[];
  /** Exception names raised in the body. */
  raises: string[];
  /** Names of directly nested function definitions. */
  nestedFunctions: string[];
  isMethod: boolean;
}

export interface PropertyInfo {
  /** Stable symbol id: `python://<filePath>/<ClassName>.<name>`. */
  id?: string;
  name: string;
  type?: string;
  visibility: Visibility;
  line: number;
}

export interface ClassInfo {
  /** Stable symbol id: `python://<filePath>/<name>`. */
  id?: string;
  name: string;
  baseClasses: string[];
  decorators: string[];
  docstring?: string;
  startLine: number;
  endLine: number;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  visibility: Visibility;
}

/** Full structural analysis of one source file. */
export interface FileAnalysis {
  language: string;
  imports: ImportInfo[];
  /** Top-level functions only; methods live under their class. */
  functions: FunctionInfo[];
  classes: ClassInfo[];
}

export type DependencyEdgeType = "import" | "call" | "inherits" | "uses";

export interface DependencyEdge {
  /** Workspace-relative path of the importing file. */
  from: string;
  /** Workspace-relative path of the imported file. */
  to: string;
  /** Relationship kind; absent means "import" (v1 compatibility). */
  type?: DependencyEdgeType;
}

/** Graph node, kept file-granular today; `kind` reserves room for symbol nodes. */
export interface GraphNode {
  /** Stable id, currently the workspace-relative file path. */
  id: string;
  filePath: string;
  kind: "file";
}

export interface DependencyGraphData {
  rootFile: string;
  /** All files reached, including the root. */
  files: string[];
  edges: DependencyEdge[];
  maxDepth: number;
  /** True if traversal stopped at maxDepth with unexplored files remaining. */
  truncated: boolean;
  /** Typed nodes for visualization; absent in v1 graphs. */
  nodes?: GraphNode[];
  /** True when the import graph contains at least one cycle. */
  hasCycles?: boolean;
}

export type RelatedFileReason = "current" | "imported" | "calls";

export interface RelatedFile {
  filePath: string;
  reason: RelatedFileReason;
  /** 0–100; higher = more relevant. current=100, call-defining≈95, imports≈80. */
  priority?: number;
  /** Import-graph distance from the current file (current=0, direct import=1). */
  depth?: number;
  /** Symbols that make this file relevant (called functions, imported names). */
  symbols?: string[];
}

export interface DetectedFrameworks {
  backend?: string;
  frontend?: string;
  database?: string;
  buildTool?: string;
  packageManager?: string;
}

export interface WorkspaceSummary {
  projectType: "backend" | "frontend" | "fullstack" | "library" | "unknown";
  frameworks: DetectedFrameworks;
  languages: string[];
}

export type TokenEstimateLevel = "ok" | "warning" | "compressionRecommended";

export interface TokenEstimate {
  characters: number;
  estimatedTokens: number;
  level: TokenEstimateLevel;
}

/** Where the cursor sits, structurally. */
export interface CursorContext {
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  /** Enclosing function name, if any. */
  symbol?: string;
  /** Enclosing class name, if any. */
  className?: string;
  scope: "module" | "class" | "function";
  selectionLength: number;
}

/** Non-fatal problem encountered while building intelligence. Never thrown. */
export interface IntelligenceWarning {
  code:
    | "unsupported-language"
    | "parse-failed"
    | "bridge-unreachable"
    | "missing-file"
    | "cyclic-dependency"
    | "summary-failed";
  message: string;
}

/** Timings and cache statistics for one intelligence build. */
export interface PerformanceMetrics {
  parseTimeMs: number;
  dependencyTimeMs: number;
  contextBuildTimeMs: number;
  totalTimeMs: number;
  filesParsed: number;
  filesCached: number;
  /** 0–1; parses served from cache over total parse requests. */
  cacheHitRate: number;
  memoryUsageMb?: number;
}

/**
 * Structured intelligence attached to a snapshot. Every field is optional
 * (except relatedFiles) because each is gated by its own feature flag and
 * each producer may fail independently.
 */
export interface IntelligenceContext {
  currentFunction?: FunctionInfo;
  fileAnalysis?: FileAnalysis;
  dependencyGraph?: DependencyGraphData;
  relatedFiles: RelatedFile[];
  workspaceSummary?: WorkspaceSummary;
  tokenEstimate?: TokenEstimate;
  cursor?: CursorContext;
  /** Non-fatal problems; empty/absent means a clean build. */
  warnings?: IntelligenceWarning[];
  metrics?: PerformanceMetrics;
  /** Wall-clock time spent producing this object. */
  collectionTimeMs?: number;
}

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

export interface FunctionInfo {
  name: string;
  /** `ClassName.method` for methods, otherwise same as `name`. */
  qualifiedName: string;
  args: ArgumentInfo[];
  returnType?: string;
  decorators: string[];
  docstring?: string;
  startLine: number;
  endLine: number;
  /** Dotted names of functions called inside the body, deduplicated, in order. */
  calls: string[];
  /** Exception names raised in the body. */
  raises: string[];
  /** Names of directly nested function definitions. */
  nestedFunctions: string[];
  isMethod: boolean;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  visibility: Visibility;
  line: number;
}

export interface ClassInfo {
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

export interface DependencyEdge {
  /** Workspace-relative path of the importing file. */
  from: string;
  /** Workspace-relative path of the imported file. */
  to: string;
}

export interface DependencyGraphData {
  rootFile: string;
  /** All files reached, including the root. */
  files: string[];
  edges: DependencyEdge[];
  maxDepth: number;
  /** True if traversal stopped at maxDepth with unexplored files remaining. */
  truncated: boolean;
}

export type RelatedFileReason = "current" | "imported" | "calls";

export interface RelatedFile {
  filePath: string;
  reason: RelatedFileReason;
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
  /** Wall-clock time spent producing this object. */
  collectionTimeMs?: number;
}

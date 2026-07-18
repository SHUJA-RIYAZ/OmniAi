/**
 * Intelligence data models.
 *
 * The wire-format types live in `@ai-context-bridge/shared` (they travel
 * through the bridge); this module re-exports them for consumers of the
 * intelligence subsystem and adds engine-local types that never cross the
 * wire.
 */

export type {
  ArgumentInfo,
  ClassInfo,
  DependencyEdge,
  DependencyGraphData,
  DetectedFrameworks,
  FileAnalysis,
  FunctionInfo,
  ImportInfo,
  ImportedName,
  IntelligenceContext,
  PropertyInfo,
  RelatedFile,
  RelatedFileReason,
  TokenEstimate,
  TokenEstimateLevel,
  Visibility,
  WorkspaceSummary,
} from "@ai-context-bridge/shared";

/** Tuning knobs for intelligence collection. All values are injected — no hardcoded limits. */
export interface IntelligenceOptions {
  /** Dependency graph traversal depth. */
  maxDepth: number;
  /** Cap on related files (including the current file). */
  maxRelatedFiles: number;
}

export const DEFAULT_INTELLIGENCE_OPTIONS: IntelligenceOptions = {
  maxDepth: 2,
  maxRelatedFiles: 5,
};

/** Input to the intelligence builder, decoupled from any editor API. */
export interface IntelligenceInput {
  /** Workspace-relative path of the active file. */
  filePath: string;
  languageId: string;
  source: string;
  /** 1-based cursor line, if a cursor is available. */
  cursorLine?: number;
  /** 1-based cursor column. */
  cursorColumn?: number;
  /** Length of the active selection in characters (0 = no selection). */
  selectionLength?: number;
  /** Detected workspace languages (from workspace metadata). */
  workspaceLanguages: string[];
  /** Text whose token footprint should be estimated (usually the serialized snapshot). */
  estimateTarget?: string;
}

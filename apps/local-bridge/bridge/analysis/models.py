"""Pydantic models for code intelligence.

Mirrors `packages/shared/src/intelligence.ts` — the two files must change
together (see ADR-0001 on manual contract mirroring).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Visibility = Literal["public", "protected", "private"]

CallTargetType = Literal["local", "workspace", "builtin", "thirdparty", "unknown"]


class CallInfo(BaseModel):
    """One call site (schema v2). v1 snapshots stored bare strings; the
    validator on FunctionInfo.calls upgrades them on ingest."""

    name: str
    qualifiedName: str
    module: Optional[str] = None
    line: int = 0
    resolved: bool = False
    type: CallTargetType = "unknown"


def _coerce_call(value: object) -> object:
    if isinstance(value, str):
        return CallInfo(
            name=value.rsplit(".", 1)[-1],
            qualifiedName=value,
            line=0,
            resolved=False,
            type="unknown",
        )
    return value


class ImportedName(BaseModel):
    name: str
    alias: Optional[str] = None


class ImportInfo(BaseModel):
    module: str
    alias: Optional[str] = None
    names: list[ImportedName] = Field(default_factory=list)
    isRelative: bool = False
    level: int = 0
    line: int


class ArgumentInfo(BaseModel):
    name: str
    type: Optional[str] = None
    default: Optional[str] = None


class FunctionInfo(BaseModel):
    id: Optional[str] = None
    name: str
    qualifiedName: str
    args: list[ArgumentInfo] = Field(default_factory=list)
    returnType: Optional[str] = None
    decorators: list[str] = Field(default_factory=list)
    docstring: Optional[str] = None
    startLine: int
    endLine: int
    calls: list[CallInfo] = Field(default_factory=list)
    raises: list[str] = Field(default_factory=list)
    nestedFunctions: list[str] = Field(default_factory=list)
    isMethod: bool = False

    @field_validator("calls", mode="before")
    @classmethod
    def _upgrade_v1_calls(cls, value: object) -> object:
        if isinstance(value, list):
            return [_coerce_call(item) for item in value]
        return value


class PropertyInfo(BaseModel):
    id: Optional[str] = None
    name: str
    type: Optional[str] = None
    visibility: Visibility = "public"
    line: int


class ClassInfo(BaseModel):
    id: Optional[str] = None
    name: str
    baseClasses: list[str] = Field(default_factory=list)
    decorators: list[str] = Field(default_factory=list)
    docstring: Optional[str] = None
    startLine: int
    endLine: int
    methods: list[FunctionInfo] = Field(default_factory=list)
    properties: list[PropertyInfo] = Field(default_factory=list)
    visibility: Visibility = "public"


class FileAnalysis(BaseModel):
    language: str
    imports: list[ImportInfo] = Field(default_factory=list)
    functions: list[FunctionInfo] = Field(default_factory=list)
    classes: list[ClassInfo] = Field(default_factory=list)


class DependencyEdge(BaseModel):
    from_: str = Field(alias="from")
    to: str
    type: Optional[Literal["import", "call", "inherits", "uses"]] = None

    model_config = {"populate_by_name": True}


class GraphNode(BaseModel):
    id: str
    filePath: str
    kind: Literal["file"] = "file"


class DependencyGraphData(BaseModel):
    rootFile: str
    files: list[str] = Field(default_factory=list)
    edges: list[DependencyEdge] = Field(default_factory=list)
    maxDepth: int
    truncated: bool = False
    nodes: Optional[list[GraphNode]] = None
    hasCycles: Optional[bool] = None


class RelatedFile(BaseModel):
    filePath: str
    reason: Literal["current", "imported", "calls"]
    priority: Optional[int] = None
    depth: Optional[int] = None
    symbols: Optional[list[str]] = None


class CursorContext(BaseModel):
    line: int
    column: int
    symbol: Optional[str] = None
    className: Optional[str] = None
    scope: Literal["module", "class", "function"]
    selectionLength: int = 0


class IntelligenceWarning(BaseModel):
    code: Literal[
        "unsupported-language",
        "parse-failed",
        "bridge-unreachable",
        "missing-file",
        "cyclic-dependency",
        "summary-failed",
    ]
    message: str


class PerformanceMetrics(BaseModel):
    parseTimeMs: float
    dependencyTimeMs: float
    contextBuildTimeMs: float
    totalTimeMs: float
    filesParsed: int
    filesCached: int
    cacheHitRate: float
    memoryUsageMb: Optional[float] = None


class DetectedFrameworks(BaseModel):
    backend: Optional[str] = None
    frontend: Optional[str] = None
    database: Optional[str] = None
    buildTool: Optional[str] = None
    packageManager: Optional[str] = None


class WorkspaceSummary(BaseModel):
    projectType: Literal["backend", "frontend", "fullstack", "library", "unknown"]
    frameworks: DetectedFrameworks = Field(default_factory=DetectedFrameworks)
    languages: list[str] = Field(default_factory=list)


class TokenEstimate(BaseModel):
    characters: int
    estimatedTokens: int
    level: Literal["ok", "warning", "compressionRecommended"]


class IntelligenceContext(BaseModel):
    currentFunction: Optional[FunctionInfo] = None
    fileAnalysis: Optional[FileAnalysis] = None
    dependencyGraph: Optional[DependencyGraphData] = None
    relatedFiles: list[RelatedFile] = Field(default_factory=list)
    workspaceSummary: Optional[WorkspaceSummary] = None
    tokenEstimate: Optional[TokenEstimate] = None
    cursor: Optional[CursorContext] = None
    warnings: Optional[list[IntelligenceWarning]] = None
    metrics: Optional[PerformanceMetrics] = None
    collectionTimeMs: Optional[float] = None


class AnalyzeRequest(BaseModel):
    source: str
    language: Literal["python"] = "python"
    # Workspace-relative path; used to mint stable symbol ids.
    path: Optional[str] = None

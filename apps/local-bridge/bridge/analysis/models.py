"""Pydantic models for code intelligence.

Mirrors `packages/shared/src/intelligence.ts` — the two files must change
together (see ADR-0001 on manual contract mirroring).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Visibility = Literal["public", "protected", "private"]


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
    name: str
    qualifiedName: str
    args: list[ArgumentInfo] = Field(default_factory=list)
    returnType: Optional[str] = None
    decorators: list[str] = Field(default_factory=list)
    docstring: Optional[str] = None
    startLine: int
    endLine: int
    calls: list[str] = Field(default_factory=list)
    raises: list[str] = Field(default_factory=list)
    nestedFunctions: list[str] = Field(default_factory=list)
    isMethod: bool = False


class PropertyInfo(BaseModel):
    name: str
    type: Optional[str] = None
    visibility: Visibility = "public"
    line: int


class ClassInfo(BaseModel):
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

    model_config = {"populate_by_name": True}


class DependencyGraphData(BaseModel):
    rootFile: str
    files: list[str] = Field(default_factory=list)
    edges: list[DependencyEdge] = Field(default_factory=list)
    maxDepth: int
    truncated: bool = False


class RelatedFile(BaseModel):
    filePath: str
    reason: Literal["current", "imported", "calls"]


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
    collectionTimeMs: Optional[float] = None


class AnalyzeRequest(BaseModel):
    source: str
    language: Literal["python"] = "python"

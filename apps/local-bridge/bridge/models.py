"""Pydantic models mirroring the TypeScript contract types in packages/shared.

These are the single Python-side source of truth for the wire format.
Field names use camelCase to match the JSON produced by the extension.
"""

from __future__ import annotations

from typing import Generic, Literal, Optional, TypeVar

from pydantic import BaseModel, Field

from .analysis.models import IntelligenceContext

T = TypeVar("T")


class DiagnosticItem(BaseModel):
    filePath: str
    line: int
    column: int
    severity: Literal["error", "warning", "information", "hint"]
    message: str
    source: Optional[str] = None
    code: Optional[str] = None


class WorkspaceMetadata(BaseModel):
    name: str
    rootPath: str
    languages: list[str] = Field(default_factory=list)
    manifests: list[str] = Field(default_factory=list)


class ActiveFileContext(BaseModel):
    filePath: str
    languageId: str
    content: str
    truncated: bool
    lineCount: int


class SelectionContext(BaseModel):
    filePath: str
    startLine: int
    endLine: int
    text: str


class TerminalContext(BaseModel):
    name: str
    lines: list[str]


class GitDiffContext(BaseModel):
    diff: str
    truncated: bool
    branch: str


class ContextSnapshot(BaseModel):
    id: str
    createdAt: str
    schemaVersion: Literal[1]
    workspace: WorkspaceMetadata
    activeFile: Optional[ActiveFileContext] = None
    selection: Optional[SelectionContext] = None
    diagnostics: list[DiagnosticItem] = Field(default_factory=list)
    terminal: Optional[TerminalContext] = None
    gitDiff: Optional[GitDiffContext] = None
    intelligence: Optional[IntelligenceContext] = None


class BridgeResponse(BaseModel, Generic[T]):
    ok: bool
    data: Optional[T] = None
    error: Optional[str] = None

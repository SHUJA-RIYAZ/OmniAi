"""Code analysis subsystem: language analyzers behind a common interface."""

from .python_analyzer import PythonAnalyzer

__all__ = ["PythonAnalyzer"]

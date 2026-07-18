"""Python source analysis built on the standard-library `ast` module.

This is the reference implementation behind the language-independent
`ILanguageAnalyzer` interface defined in
`packages/context-engine/src/intelligence/interfaces/`. Other languages get
their own analyzer class exposed through the same endpoint family.
"""

from __future__ import annotations

import ast
import builtins
from dataclasses import dataclass, field
from typing import Optional, Union

from .models import (
    ArgumentInfo,
    CallInfo,
    ClassInfo,
    FileAnalysis,
    FunctionInfo,
    ImportedName,
    ImportInfo,
    PropertyInfo,
    Visibility,
)

FunctionNode = Union[ast.FunctionDef, ast.AsyncFunctionDef]
_FUNCTION_TYPES = (ast.FunctionDef, ast.AsyncFunctionDef)

_BUILTIN_NAMES = frozenset(dir(builtins))


@dataclass
class _ModuleContext:
    """Single-file facts used to classify call targets and mint symbol ids."""

    path: str
    #: names defined at module level (functions, classes) or as methods
    local_defs: frozenset[str] = frozenset()
    #: bound name -> (module, is_relative), e.g. {"np": ("numpy", False)}
    import_map: dict[str, tuple[str, bool]] = field(default_factory=dict)

    def symbol_id(self, qualified_name: str) -> str:
        return f"python://{self.path}/{qualified_name}"


def _visibility(name: str) -> Visibility:
    if name.startswith("__") and not name.endswith("__"):
        return "private"
    if name.startswith("_"):
        return "protected"
    return "public"


def _dotted_name(node: ast.expr) -> Optional[str]:
    """Render `a.b.c` style names; None for anything more dynamic."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = _dotted_name(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    return None


def _unparse(node: Optional[ast.expr]) -> Optional[str]:
    return ast.unparse(node) if node is not None else None


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


class PythonAnalyzer:
    """Extracts imports, functions, and classes from Python source.

    Raises `SyntaxError` for unparseable source; callers translate that
    into a validation error at the API boundary.
    """

    language = "python"

    def analyze(self, source: str, path: Optional[str] = None) -> FileAnalysis:
        tree = ast.parse(source)
        imports = [imp for node in ast.walk(tree) for imp in self._imports(node)]
        ctx = self._module_context(tree, imports, path)
        functions = [
            self._function(node, ctx)
            for node in tree.body
            if isinstance(node, _FUNCTION_TYPES)
        ]
        classes = [
            self._class(node, ctx) for node in tree.body if isinstance(node, ast.ClassDef)
        ]
        return FileAnalysis(
            language=self.language, imports=imports, functions=functions, classes=classes
        )

    def _module_context(
        self, tree: ast.Module, imports: list[ImportInfo], path: Optional[str]
    ) -> _ModuleContext:
        local_defs: set[str] = set()
        for node in tree.body:
            if isinstance(node, _FUNCTION_TYPES):
                local_defs.add(node.name)
            elif isinstance(node, ast.ClassDef):
                local_defs.add(node.name)
                for child in node.body:
                    if isinstance(child, _FUNCTION_TYPES):
                        local_defs.add(child.name)

        import_map: dict[str, tuple[str, bool]] = {}
        for imp in imports:
            if imp.names:  # from module import a as b, ...
                for name in imp.names:
                    import_map[name.alias or name.name] = (imp.module, imp.isRelative)
            else:  # import module [as alias]
                bound = imp.alias or imp.module.split(".", 1)[0]
                import_map[bound] = (imp.module, imp.isRelative)

        return _ModuleContext(
            path=path or "<unsaved>",
            local_defs=frozenset(local_defs),
            import_map=import_map,
        )

    def _classify_call(self, dotted: str, line: int, ctx: _ModuleContext) -> CallInfo:
        first, _, _rest = dotted.partition(".")
        name = dotted.rsplit(".", 1)[-1]

        if first in ("self", "cls"):
            return CallInfo(
                name=name,
                qualifiedName=dotted,
                line=line,
                resolved=name in ctx.local_defs,
                type="local",
            )
        if first in ctx.import_map:
            module, is_relative = ctx.import_map[first]
            # `from m import f` binds f directly (dotted == first);
            # `import m as x` binds the module (dotted == "x.attr...").
            qualified = (
                f"{module}.{dotted}" if dotted == first else module + dotted[len(first):]
            )
            return CallInfo(
                name=name,
                qualifiedName=qualified,
                module=module,
                line=line,
                # Workspace vs third-party needs filesystem knowledge the
                # analyzer lacks; the engine's CallResolver settles it.
                resolved=False,
                type="workspace" if is_relative else "unknown",
            )
        if "." not in dotted and dotted in ctx.local_defs:
            return CallInfo(
                name=dotted, qualifiedName=dotted, line=line, resolved=True, type="local"
            )
        if "." not in dotted and dotted in _BUILTIN_NAMES:
            return CallInfo(
                name=dotted,
                qualifiedName=f"builtins.{dotted}",
                module="builtins",
                line=line,
                resolved=True,
                type="builtin",
            )
        return CallInfo(name=name, qualifiedName=dotted, line=line, resolved=False, type="unknown")

    def _imports(self, node: ast.AST) -> list[ImportInfo]:
        if isinstance(node, ast.Import):
            return [
                ImportInfo(
                    module=alias.name,
                    alias=alias.asname,
                    names=[],
                    isRelative=False,
                    level=0,
                    line=node.lineno,
                )
                for alias in node.names
            ]
        if isinstance(node, ast.ImportFrom):
            return [
                ImportInfo(
                    module=node.module or "",
                    names=[
                        ImportedName(name=alias.name, alias=alias.asname)
                        for alias in node.names
                    ],
                    isRelative=node.level > 0,
                    level=node.level,
                    line=node.lineno,
                )
            ]
        return []

    def _function(
        self, node: FunctionNode, ctx: _ModuleContext, class_name: Optional[str] = None
    ) -> FunctionInfo:
        calls: list[CallInfo] = []
        seen_calls: set[str] = set()
        raises: list[str] = []
        for child in ast.walk(node):
            if child is node:
                continue
            if isinstance(child, ast.Call):
                dotted = _dotted_name(child.func)
                if dotted and dotted not in seen_calls:
                    seen_calls.add(dotted)
                    calls.append(self._classify_call(dotted, child.lineno, ctx))
            elif isinstance(child, ast.Raise) and child.exc is not None:
                exc = child.exc
                target = exc.func if isinstance(exc, ast.Call) else exc
                name = _dotted_name(target)
                if name:
                    raises.append(name)

        nested = [c.name for c in node.body if isinstance(c, _FUNCTION_TYPES)]
        qualified = f"{class_name}.{node.name}" if class_name else node.name

        return FunctionInfo(
            id=ctx.symbol_id(qualified),
            name=node.name,
            qualifiedName=qualified,
            args=self._arguments(node.args),
            returnType=_unparse(node.returns),
            decorators=[ast.unparse(d) for d in node.decorator_list],
            docstring=ast.get_docstring(node),
            startLine=node.lineno,
            endLine=node.end_lineno or node.lineno,
            calls=calls,
            raises=_dedupe(raises),
            nestedFunctions=nested,
            isMethod=class_name is not None,
        )

    def _arguments(self, args: ast.arguments) -> list[ArgumentInfo]:
        result: list[ArgumentInfo] = []

        positional = list(args.posonlyargs) + list(args.args)
        # Defaults align with the tail of the positional argument list.
        padding: list[Optional[ast.expr]] = [None] * (len(positional) - len(args.defaults))
        for arg, default in zip(positional, padding + list(args.defaults)):
            result.append(
                ArgumentInfo(
                    name=arg.arg,
                    type=_unparse(arg.annotation),
                    default=_unparse(default),
                )
            )
        if args.vararg:
            result.append(
                ArgumentInfo(name=f"*{args.vararg.arg}", type=_unparse(args.vararg.annotation))
            )
        for arg, default in zip(args.kwonlyargs, args.kw_defaults):
            result.append(
                ArgumentInfo(
                    name=arg.arg,
                    type=_unparse(arg.annotation),
                    default=_unparse(default),
                )
            )
        if args.kwarg:
            result.append(
                ArgumentInfo(name=f"**{args.kwarg.arg}", type=_unparse(args.kwarg.annotation))
            )
        return result

    def _class(self, node: ast.ClassDef, ctx: _ModuleContext) -> ClassInfo:
        methods: list[FunctionInfo] = []
        properties: list[PropertyInfo] = []

        def prop_id(name: str) -> str:
            return ctx.symbol_id(f"{node.name}.{name}")

        for child in node.body:
            if isinstance(child, _FUNCTION_TYPES):
                decorators = {_dotted_name(d) for d in child.decorator_list if _dotted_name(d)}
                if "property" in decorators:
                    properties.append(
                        PropertyInfo(
                            id=prop_id(child.name),
                            name=child.name,
                            type=_unparse(child.returns),
                            visibility=_visibility(child.name),
                            line=child.lineno,
                        )
                    )
                else:
                    methods.append(self._function(child, ctx, class_name=node.name))
            elif isinstance(child, ast.AnnAssign) and isinstance(child.target, ast.Name):
                properties.append(
                    PropertyInfo(
                        id=prop_id(child.target.id),
                        name=child.target.id,
                        type=_unparse(child.annotation),
                        visibility=_visibility(child.target.id),
                        line=child.lineno,
                    )
                )
            elif isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Name):
                        properties.append(
                            PropertyInfo(
                                id=prop_id(target.id),
                                name=target.id,
                                visibility=_visibility(target.id),
                                line=child.lineno,
                            )
                        )

        return ClassInfo(
            id=ctx.symbol_id(node.name),
            name=node.name,
            baseClasses=[ast.unparse(b) for b in node.bases],
            decorators=[ast.unparse(d) for d in node.decorator_list],
            docstring=ast.get_docstring(node),
            startLine=node.lineno,
            endLine=node.end_lineno or node.lineno,
            methods=methods,
            properties=properties,
            visibility=_visibility(node.name),
        )

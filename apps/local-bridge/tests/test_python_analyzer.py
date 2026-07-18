import pytest

from bridge.analysis import PythonAnalyzer

SAMPLE = '''
import os
import numpy as np
from pathlib import Path
from typing import Optional as Opt, List
from . import sibling
from ..pkg.mod import thing


def create_user(name: str, age: int = 18, *tags, admin: bool = False, **extra) -> "User":
    """Create a user and persist it."""
    validate(name)
    repo = UserRepository()
    user = repo.create(name, age)
    if not user:
        raise ValueError("could not create")

    def audit():
        log.info("created")

    audit()
    return user


class _Base:
    pass


@dataclass
class User(_Base, Serializable):
    """A user."""

    name: str
    age: int = 18
    _internal: bool
    __secret = None

    @property
    def display_name(self) -> str:
        return self.name.title()

    def save(self) -> None:
        db.session.add(self)

    def _validate(self):
        pass
'''


@pytest.fixture(scope="module")
def analysis():
    return PythonAnalyzer().analyze(SAMPLE)


def test_plain_and_aliased_imports(analysis):
    plain = {i.module: i for i in analysis.imports if not i.names}
    assert "os" in plain
    assert plain["numpy"].alias == "np"


def test_from_imports_with_aliases(analysis):
    typing_import = next(i for i in analysis.imports if i.module == "typing")
    names = {n.name: n.alias for n in typing_import.names}
    assert names == {"Optional": "Opt", "List": None}


def test_relative_imports(analysis):
    relative = [i for i in analysis.imports if i.isRelative]
    assert {(i.module, i.level) for i in relative} == {("", 1), ("pkg.mod", 2)}


def test_function_signature(analysis):
    fn = next(f for f in analysis.functions if f.name == "create_user")
    args = {a.name: a for a in fn.args}
    assert args["name"].type == "str"
    assert args["age"].default == "18"
    assert "*tags" in args
    assert args["admin"].default == "False"
    assert "**extra" in args
    assert fn.returnType == "'User'"
    assert fn.docstring == "Create a user and persist it."
    assert fn.startLine < fn.endLine
    assert fn.isMethod is False


def test_function_calls_raises_nested(analysis):
    fn = next(f for f in analysis.functions if f.name == "create_user")
    by_qualified = {c.qualifiedName: c for c in fn.calls}
    assert "validate" in by_qualified
    assert "repo.create" in by_qualified
    assert by_qualified["repo.create"].name == "create"
    assert by_qualified["repo.create"].line > 0
    assert fn.raises == ["ValueError"]
    assert fn.nestedFunctions == ["audit"]


def test_class_extraction(analysis):
    user = next(c for c in analysis.classes if c.name == "User")
    assert user.baseClasses == ["_Base", "Serializable"]
    assert user.decorators == ["dataclass"]
    assert user.docstring == "A user."

    methods = {m.name for m in user.methods}
    assert methods == {"save", "_validate"}
    save = next(m for m in user.methods if m.name == "save")
    assert save.isMethod is True
    assert save.qualifiedName == "User.save"


def test_property_and_visibility(analysis):
    user = next(c for c in analysis.classes if c.name == "User")
    props = {p.name: p for p in user.properties}
    assert props["display_name"].type == "str"  # @property
    assert props["name"].visibility == "public"
    assert props["_internal"].visibility == "protected"
    assert props["__secret"].visibility == "private"

    base = next(c for c in analysis.classes if c.name == "_Base")
    assert base.visibility == "protected"


CALLS_SAMPLE = '''
import numpy as np
from database import get_db
from .jwt import create_token


def helper():
    pass


class Service:
    def run(self):
        self.helper_method()
        return helper()

    def helper_method(self):
        pass


def main():
    helper()
    print("hi")
    np.linalg.solve(a, b)
    get_db()
    create_token()
    mystery()
'''


@pytest.fixture(scope="module")
def calls():
    analysis = PythonAnalyzer().analyze(CALLS_SAMPLE, path="app/main.py")
    fn = next(f for f in analysis.functions if f.name == "main")
    return {c.name: c for c in fn.calls}


def test_call_classification_local(calls):
    assert calls["helper"].type == "local"
    assert calls["helper"].resolved is True
    assert calls["helper"].qualifiedName == "helper"


def test_call_classification_builtin(calls):
    assert calls["print"].type == "builtin"
    assert calls["print"].qualifiedName == "builtins.print"
    assert calls["print"].resolved is True


def test_call_classification_module_alias(calls):
    solve = calls["solve"]
    assert solve.module == "numpy"
    assert solve.qualifiedName == "numpy.linalg.solve"
    assert solve.type == "unknown"  # workspace vs third-party settled by the engine


def test_call_classification_from_import(calls):
    assert calls["get_db"].qualifiedName == "database.get_db"
    assert calls["get_db"].module == "database"


def test_call_classification_relative_import_is_workspace(calls):
    assert calls["create_token"].type == "workspace"
    assert calls["create_token"].module == "jwt"


def test_call_classification_unknown(calls):
    assert calls["mystery"].type == "unknown"
    assert calls["mystery"].resolved is False


def test_self_calls_are_local():
    analysis = PythonAnalyzer().analyze(CALLS_SAMPLE, path="app/main.py")
    service = next(c for c in analysis.classes if c.name == "Service")
    run = next(m for m in service.methods if m.name == "run")
    self_call = next(c for c in run.calls if c.name == "helper_method")
    assert self_call.type == "local"
    assert self_call.resolved is True


def test_symbol_ids_are_stable_and_path_based():
    analysis = PythonAnalyzer().analyze(CALLS_SAMPLE, path="app/main.py")
    fn = next(f for f in analysis.functions if f.name == "main")
    assert fn.id == "python://app/main.py/main"

    service = next(c for c in analysis.classes if c.name == "Service")
    assert service.id == "python://app/main.py/Service"
    run = next(m for m in service.methods if m.name == "run")
    assert run.id == "python://app/main.py/Service.run"

    again = PythonAnalyzer().analyze(CALLS_SAMPLE, path="app/main.py")
    assert next(f for f in again.functions if f.name == "main").id == fn.id


def test_ids_without_path_use_placeholder():
    analysis = PythonAnalyzer().analyze("def f():\n    pass\n")
    assert analysis.functions[0].id == "python://<unsaved>/f"


def test_syntax_error_raises():
    with pytest.raises(SyntaxError):
        PythonAnalyzer().analyze("def broken(:")


def test_empty_source():
    result = PythonAnalyzer().analyze("")
    assert result.imports == []
    assert result.functions == []
    assert result.classes == []

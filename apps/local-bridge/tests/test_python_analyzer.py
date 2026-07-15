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
    assert "validate" in fn.calls
    assert "repo.create" in fn.calls
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


def test_syntax_error_raises():
    with pytest.raises(SyntaxError):
        PythonAnalyzer().analyze("def broken(:")


def test_empty_source():
    result = PythonAnalyzer().analyze("")
    assert result.imports == []
    assert result.functions == []
    assert result.classes == []

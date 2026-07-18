from fastapi.testclient import TestClient

from bridge.main import create_app
from bridge.store import InMemorySnapshotStore


def client() -> TestClient:
    return TestClient(create_app(InMemorySnapshotStore()))


def test_analyze_python_ok():
    res = client().post(
        "/api/v1/analyze/python",
        json={
            "source": "from a.b import c\n\ndef f(x: int) -> str:\n    return c(x)\n",
            "path": "pkg/mod.py",
        },
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["language"] == "python"
    assert data["imports"][0]["module"] == "a.b"
    fn = data["functions"][0]
    assert fn["name"] == "f"
    assert fn["returnType"] == "str"
    assert fn["id"] == "python://pkg/mod.py/f"
    call = fn["calls"][0]
    assert call["qualifiedName"] == "a.b.c"
    assert call["module"] == "a.b"
    assert call["line"] == 4


def test_v1_snapshot_with_string_calls_still_accepted():
    """Schema v1 stored calls as strings; the bridge upgrades them on ingest."""
    c = client()
    snapshot = {
        "id": "v1-compat",
        "createdAt": "2026-07-15T00:00:00Z",
        "schemaVersion": 1,
        "workspace": {"name": "demo", "rootPath": "/d", "languages": [], "manifests": []},
        "diagnostics": [],
        "intelligence": {
            "relatedFiles": [],
            "currentFunction": {
                "name": "login",
                "qualifiedName": "login",
                "startLine": 1,
                "endLine": 5,
                "calls": ["jwt.create_token", "get_db"],
            },
        },
    }
    assert c.post("/api/v1/context", json=snapshot).status_code == 201

    stored = c.get("/api/v1/context/v1-compat").json()["data"]
    calls = stored["intelligence"]["currentFunction"]["calls"]
    assert calls[0]["qualifiedName"] == "jwt.create_token"
    assert calls[0]["name"] == "create_token"
    assert calls[0]["type"] == "unknown"
    assert calls[1]["name"] == "get_db"


def test_analyze_python_syntax_error():
    res = client().post("/api/v1/analyze/python", json={"source": "def broken(:"})
    assert res.status_code == 422
    assert "syntax error" in res.json()["error"].lower()


def test_snapshot_with_intelligence_round_trips():
    c = client()
    snapshot = {
        "id": "intel-1",
        "createdAt": "2026-07-15T00:00:00Z",
        "schemaVersion": 1,
        "workspace": {"name": "demo", "rootPath": "/d", "languages": [], "manifests": []},
        "diagnostics": [],
        "intelligence": {
            "relatedFiles": [{"filePath": "a.py", "reason": "current"}],
            "dependencyGraph": {
                "rootFile": "a.py",
                "files": ["a.py", "b.py"],
                "edges": [{"from": "a.py", "to": "b.py"}],
                "maxDepth": 2,
                "truncated": False,
            },
            "tokenEstimate": {"characters": 400, "estimatedTokens": 100, "level": "ok"},
        },
    }
    assert c.post("/api/v1/context", json=snapshot).status_code == 201

    body = c.get("/api/v1/context/latest").json()["data"]
    intel = body["intelligence"]
    assert intel["relatedFiles"][0]["reason"] == "current"
    # The "from" alias must survive the round trip for the TS side.
    assert intel["dependencyGraph"]["edges"][0]["from"] == "a.py"


def test_snapshot_without_intelligence_still_works():
    c = client()
    snapshot = {
        "id": "plain-1",
        "createdAt": "2026-07-15T00:00:00Z",
        "schemaVersion": 1,
        "workspace": {"name": "demo", "rootPath": "/d", "languages": [], "manifests": []},
        "diagnostics": [],
    }
    assert c.post("/api/v1/context", json=snapshot).status_code == 201
    assert c.get("/api/v1/context/latest").json()["data"]["intelligence"] is None

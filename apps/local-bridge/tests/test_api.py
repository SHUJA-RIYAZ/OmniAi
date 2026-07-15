from fastapi.testclient import TestClient

from bridge.main import create_app
from bridge.store import InMemorySnapshotStore


def make_snapshot(snapshot_id: str = "snap-1") -> dict:
    return {
        "id": snapshot_id,
        "createdAt": "2026-01-01T00:00:00Z",
        "schemaVersion": 1,
        "workspace": {
            "name": "demo",
            "rootPath": "/demo",
            "languages": ["python"],
            "manifests": ["pyproject.toml"],
        },
        "diagnostics": [
            {
                "filePath": "app.py",
                "line": 3,
                "column": 1,
                "severity": "error",
                "message": "undefined name 'foo'",
            }
        ],
        "selection": {
            "filePath": "app.py",
            "startLine": 1,
            "endLine": 5,
            "text": "print(foo)",
        },
    }


def client() -> TestClient:
    return TestClient(create_app(InMemorySnapshotStore()))


def test_health():
    res = client().get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_push_and_get_latest():
    c = client()
    res = c.post("/api/v1/context", json=make_snapshot())
    assert res.status_code == 201
    assert res.json()["data"]["id"] == "snap-1"

    res = c.get("/api/v1/context/latest")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["data"]["workspace"]["name"] == "demo"
    assert body["data"]["diagnostics"][0]["severity"] == "error"


def test_get_by_id_and_missing():
    c = client()
    c.post("/api/v1/context", json=make_snapshot("abc"))

    assert c.get("/api/v1/context/abc").status_code == 200
    res = c.get("/api/v1/context/nope")
    assert res.status_code == 404
    assert res.json()["ok"] is False


def test_latest_returns_most_recent():
    c = client()
    c.post("/api/v1/context", json=make_snapshot("first"))
    c.post("/api/v1/context", json=make_snapshot("second"))
    assert c.get("/api/v1/context/latest").json()["data"]["id"] == "second"


def test_latest_404_when_empty():
    res = client().get("/api/v1/context/latest")
    assert res.status_code == 404


def test_rejects_invalid_snapshot():
    res = client().post("/api/v1/context", json={"id": "x"})
    assert res.status_code == 422


def test_store_evicts_oldest():
    store = InMemorySnapshotStore(max_size=2)
    c = TestClient(create_app(store))
    for sid in ("a", "b", "c"):
        c.post("/api/v1/context", json=make_snapshot(sid))
    assert c.get("/api/v1/context/a").status_code == 404
    assert c.get("/api/v1/context/c").status_code == 200

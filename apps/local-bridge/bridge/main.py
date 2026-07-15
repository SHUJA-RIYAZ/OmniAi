"""FastAPI application for the local bridge.

Run with:  uvicorn bridge.main:app --host 127.0.0.1 --port 8765

Security posture (MVP): binds to localhost only; CORS allows any origin so
browser extensions (whose origins are extension-scheme URLs) can call it,
but the server is unreachable from the network by construction.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .analysis import PythonAnalyzer
from .analysis.models import AnalyzeRequest, FileAnalysis
from .models import BridgeResponse, ContextSnapshot
from .store import InMemorySnapshotStore, SnapshotStore

API_PREFIX = "/api/v1"


def create_app(store: SnapshotStore | None = None) -> FastAPI:
    """App factory so tests can inject their own store."""
    app = FastAPI(
        title="AI Context Bridge — Local Bridge",
        version="0.1.0",
        docs_url="/docs",
    )
    app.state.store = store or InMemorySnapshotStore()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.get(f"{API_PREFIX}/health")
    def health() -> BridgeResponse[dict]:
        return BridgeResponse(ok=True, data={"status": "healthy", "version": "0.1.0"})

    @app.post(f"{API_PREFIX}/context", status_code=201)
    def push_context(snapshot: ContextSnapshot) -> BridgeResponse[dict]:
        app.state.store.put(snapshot)
        return BridgeResponse(ok=True, data={"id": snapshot.id})

    @app.get(f"{API_PREFIX}/context/latest")
    def latest_context():
        snapshot = app.state.store.latest()
        if snapshot is None:
            return JSONResponse(
                status_code=404,
                content=BridgeResponse[dict](
                    ok=False, error="No context snapshot available yet."
                ).model_dump(),
            )
        return BridgeResponse[ContextSnapshot](ok=True, data=snapshot)

    analyzer = PythonAnalyzer()

    @app.post(f"{API_PREFIX}/analyze/python")
    def analyze_python(request: AnalyzeRequest):
        try:
            analysis = analyzer.analyze(request.source)
        except SyntaxError as exc:
            return JSONResponse(
                status_code=422,
                content=BridgeResponse[dict](
                    ok=False, error=f"Python syntax error: {exc.msg} (line {exc.lineno})"
                ).model_dump(),
            )
        return BridgeResponse[FileAnalysis](ok=True, data=analysis)

    @app.get(f"{API_PREFIX}/context/{{snapshot_id}}")
    def get_context(snapshot_id: str):
        snapshot = app.state.store.get(snapshot_id)
        if snapshot is None:
            return JSONResponse(
                status_code=404,
                content=BridgeResponse[dict](
                    ok=False, error=f"Snapshot not found: {snapshot_id}"
                ).model_dump(),
            )
        return BridgeResponse[ContextSnapshot](ok=True, data=snapshot)

    return app


app = create_app()

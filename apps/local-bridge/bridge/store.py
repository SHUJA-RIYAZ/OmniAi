"""Snapshot storage.

The MVP uses a bounded in-memory store; the abstract base class exists so a
persistent store (SQLite for project memory) can replace it in a later
milestone without touching the API layer.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections import OrderedDict
from threading import Lock
from typing import Optional

from .models import ContextSnapshot


class SnapshotStore(ABC):
    @abstractmethod
    def put(self, snapshot: ContextSnapshot) -> None: ...

    @abstractmethod
    def get(self, snapshot_id: str) -> Optional[ContextSnapshot]: ...

    @abstractmethod
    def latest(self) -> Optional[ContextSnapshot]: ...


class InMemorySnapshotStore(SnapshotStore):
    """Thread-safe LRU-style store keeping the most recent `max_size` snapshots."""

    def __init__(self, max_size: int = 50) -> None:
        self._snapshots: OrderedDict[str, ContextSnapshot] = OrderedDict()
        self._max_size = max_size
        self._lock = Lock()

    def put(self, snapshot: ContextSnapshot) -> None:
        with self._lock:
            self._snapshots.pop(snapshot.id, None)
            self._snapshots[snapshot.id] = snapshot
            while len(self._snapshots) > self._max_size:
                self._snapshots.popitem(last=False)

    def get(self, snapshot_id: str) -> Optional[ContextSnapshot]:
        with self._lock:
            return self._snapshots.get(snapshot_id)

    def latest(self) -> Optional[ContextSnapshot]:
        with self._lock:
            if not self._snapshots:
                return None
            return next(reversed(self._snapshots.values()))

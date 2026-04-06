# Implements: REQ-R-ABG3-LINEAGE
"""
lineage — Work identity and parent/child lineage.

WorkInstance, spawn, _discover_children, active_work_keys.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from genesis.binding import ExecutableJob

from .events import EventStream


@dataclass(frozen=True)
class WorkInstance:
    """
    The scheduler's dispatch unit: an (executable_job, work_key) pair with attempt identity.

    Scheduler creates work instances from `(job, work_key)` pairs.
    """
    executable_job: ExecutableJob
    work_key: str | None = None
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))


def spawn(parent_key: str, segment: str) -> str:
    """
    Create child work_key by appending a segment to the parent key.

    Example: spawn("INT-001/REQ-042", "module.auth") → "INT-001/REQ-042/module.auth"
    """
    return f"{parent_key}/{segment}"


def _discover_children(events: list[dict], work_key: str) -> set[str]:
    """Discover child work_keys from work_spawned events in the stream."""
    children: set[str] = set()
    for e in events:
        if (e.get("event_type") == "work_spawned"
                and e.get("data", {}).get("parent_key") == work_key):
            child_key = e["data"].get("child_key")
            if child_key:
                children.add(child_key)
    return children


# Public alias for external callers
discover_children = _discover_children


def active_work_keys(workspace: Path, stream: Optional[EventStream] = None) -> list[str]:
    """
    Enumerate work_keys from active feature vectors and spawned children.

    Sources:
    1. Active feature YAMLs — work_key == feature_id
    2. work_spawned events in stream — ADR-025: child work_keys from spawn()
    """
    keys: set[str] = set()

    features_dir = workspace / ".ai-workspace" / "features" / "active"
    if features_dir.exists():
        keys.update(f.stem for f in features_dir.glob("*.yml"))

    if stream is not None:
        for e in stream.all_events():
            event_work_key = e.get("data", {}).get("work_key")
            if event_work_key:
                keys.add(event_work_key)
            if e.get("event_type") == "work_spawned":
                child_key = e.get("data", {}).get("child_key")
                if child_key:
                    keys.add(child_key)

    return sorted(keys)

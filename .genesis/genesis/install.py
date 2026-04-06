# Implements: REQ-R-ABG3-EVENTS
"""
install — Bootstrap and workspace scaffolding.

workspace_bootstrap scaffolds .ai-workspace/ and returns a bound EventStream.
"""
from __future__ import annotations

from pathlib import Path

from .events import EventStream, init_stream


def workspace_bootstrap(path: Path) -> EventStream:
    """
    Scaffold the .ai-workspace/ directory structure and return a bound EventStream.

    Idempotent — safe to call on an existing workspace.
    Binds the module-level stream so emit() becomes available.
    """
    ai_ws = path / ".ai-workspace"
    directories = [
        ai_ws / "events",
        ai_ws / "features" / "active",
        ai_ws / "features" / "completed",
        ai_ws / "context",
        ai_ws / "reviews" / "pending",
        ai_ws / "reviews" / "proxy-log",
        ai_ws / "comments" / "claude",
        ai_ws / "agents",
    ]
    for d in directories:
        d.mkdir(parents=True, exist_ok=True)

    events_file = ai_ws / "events" / "events.jsonl"
    if not events_file.exists():
        events_file.touch()

    stream = EventStream(events_file)
    init_stream(stream)
    return stream

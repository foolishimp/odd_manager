# Implements: REQ-R-ABG3-EVENTS
"""
events — EventStream, emit, init_stream, init_snapshot.

Append-only event substrate. The foundational medium.

Rules (ADR-005):
  - emit() is the only write path to events.jsonl
  - event_time is system-assigned — no caller can pass it
  - Corrupted event log lines fail visibly — no silent skipping
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# ── EventStream ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class EventContext:
    """Explicit event annotation context for runtime provenance surfaces."""
    workflow_version: str = "unknown"
    work_key: Optional[str] = None
    run_id: Optional[str] = None
    aggregate_type: Optional[str] = None
    aggregate_id: Optional[str] = None
    parent_aggregate_id: Optional[str] = None
    causation_event_id: Optional[str] = None
    correlation_id: Optional[str] = None
    job_id: Optional[str] = None
    graph_function_id: Optional[str] = None
    materialization_id: Optional[str] = None
    call_id: Optional[str] = None
    frame_attempt_id: Optional[str] = None
    frame_lineage_id: Optional[str] = None
    vector_id: Optional[str] = None


_VECTOR_LOCAL_EVENT_TYPES = frozenset(
    {
        "vector_started",
        "edge_converged",
        "fp_dispatched",
        "fh_gate_pending",
        "found",
        "assessed",
        "proof_passed",
        "proof_failed",
        "closure_passed",
        "closure_failed",
    }
)

_FRAME_EVENT_TYPES = frozenset(
    {
        "frame_opened",
        "frame_step_started",
        "frame_step_completed",
        "frame_state_updated",
        "frame_suspended",
        "frame_resumed",
        "foldback_opened",
        "frame_rebound",
        "frame_closed",
        "work_spawned",
    }
)


def _event_value(data: dict[str, Any], key: str) -> Any:
    return data.get(key)


def _infer_aggregate_identity(
    event_type: str,
    data: dict[str, Any],
    *,
    context: EventContext | None = None,
) -> tuple[str | None, str | None, str | None]:
    aggregate_type = context.aggregate_type if context is not None else None
    aggregate_id = context.aggregate_id if context is not None else None
    parent_aggregate_id = context.parent_aggregate_id if context is not None else None
    if aggregate_type is not None and aggregate_id is not None:
        return aggregate_type, aggregate_id, parent_aggregate_id

    run_id = _event_value(data, "run_id")
    call_id = _event_value(data, "call_id")
    continuation_id = _event_value(data, "continuation_id")
    frame_attempt_id = _event_value(data, "frame_attempt_id") or _event_value(data, "frame_id")

    if continuation_id and event_type.startswith("continuation_"):
        return "continuation", str(continuation_id), parent_aggregate_id or (str(run_id) if run_id else None)

    if frame_attempt_id and (
        event_type in _FRAME_EVENT_TYPES
        or (event_type in _VECTOR_LOCAL_EVENT_TYPES and _event_value(data, "frame_attempt_id") is not None)
    ):
        parent = parent_aggregate_id
        if parent is None and call_id:
            parent = str(call_id)
        elif parent is None and run_id:
            parent = str(run_id)
        return "frame", str(frame_attempt_id), parent

    if run_id and (event_type == "run_bound" or event_type.startswith("run_")):
        return "run", str(run_id), parent_aggregate_id

    if call_id and (
        event_type.startswith("graph_call_")
        or event_type.startswith("worker_turn_")
        or event_type in _VECTOR_LOCAL_EVENT_TYPES
    ):
        return "graph_call", str(call_id), parent_aggregate_id or (str(run_id) if run_id else None)

    return aggregate_type, aggregate_id, parent_aggregate_id


class EventStream:
    """
    Append-only event log. The foundational medium.

    Assets are projections of this stream — never stored objects.
    System assigns event_time at append — no caller can override it.
    Runtime provenance is supplied explicitly per append via EventContext.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self._events_cache: list[dict] | None = None
        self._events_cache_stat: tuple[int, int] | None = None

    @classmethod
    def open(cls, workspace: Path) -> "EventStream":
        """Open (or create) the canonical event log for a workspace."""
        events_path = workspace / ".ai-workspace" / "events" / "events.jsonl"
        events_path.parent.mkdir(parents=True, exist_ok=True)
        return cls(events_path)

    def append(
        self,
        event_type: str,
        data: dict,
        *,
        context: EventContext | None = None,
    ) -> dict:
        """
        Write one event. Returns the written record.

        event_time is assigned from the system clock — not from the caller.
        Business times (effective_at, completed_at) live in data.
        """
        if self._events_cache is not None:
            try:
                stat = self.path.stat()
                current_stat = (stat.st_mtime_ns, stat.st_size)
            except FileNotFoundError:
                current_stat = None
            if current_stat != self._events_cache_stat:
                self._events_cache = None
                self._events_cache_stat = None
        record_data = {**data}
        if context is not None:
            if context.workflow_version != "unknown":
                record_data.setdefault("workflow_version", context.workflow_version)
            if context.work_key is not None:
                record_data.setdefault("work_key", context.work_key)
            if context.run_id is not None:
                record_data.setdefault("run_id", context.run_id)
            if context.job_id is not None:
                record_data.setdefault("job_id", context.job_id)
            if context.graph_function_id is not None:
                record_data.setdefault("graph_function_id", context.graph_function_id)
            if context.materialization_id is not None:
                record_data.setdefault("materialization_id", context.materialization_id)
            if context.call_id is not None:
                record_data.setdefault("call_id", context.call_id)
            if context.frame_attempt_id is not None:
                record_data.setdefault("frame_attempt_id", context.frame_attempt_id)
            if context.frame_lineage_id is not None:
                record_data.setdefault("frame_lineage_id", context.frame_lineage_id)
            if context.vector_id is not None:
                record_data.setdefault("vector_id", context.vector_id)

        def _top_level(name: str) -> Any:
            explicit = data.get(name)
            if explicit is not None:
                return explicit
            if context is None:
                return None
            return getattr(context, name)

        inferred_type, inferred_id, inferred_parent = _infer_aggregate_identity(
            event_type,
            record_data,
            context=context,
        )

        record = {
            "event_id": uuid.uuid4().hex,
            "event_time": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "aggregate_type": _top_level("aggregate_type") or inferred_type,
            "aggregate_id": _top_level("aggregate_id") or inferred_id,
            "parent_aggregate_id": _top_level("parent_aggregate_id") or inferred_parent,
            "causation_event_id": _top_level("causation_event_id"),
            "correlation_id": _top_level("correlation_id"),
            "workflow_version": _top_level("workflow_version") or record_data.get("workflow_version", "unknown"),
            "work_key": _top_level("work_key"),
            "run_id": _top_level("run_id"),
            "job_id": _top_level("job_id"),
            "graph_function_id": _top_level("graph_function_id"),
            "materialization_id": _top_level("materialization_id"),
            "frame_attempt_id": _top_level("frame_attempt_id"),
            "frame_lineage_id": _top_level("frame_lineage_id"),
            "vector_id": _top_level("vector_id"),
            "data": record_data,
        }
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
        if self._events_cache is not None:
            self._events_cache.append(json.loads(json.dumps(record)))
            try:
                stat = self.path.stat()
                self._events_cache_stat = (stat.st_mtime_ns, stat.st_size)
            except FileNotFoundError:
                self._events_cache_stat = None
        return record

    def all_events(self) -> list[dict]:
        """
        Read all events from the log.

        Fails visibly on corrupted lines — corrupted event logs are not
        silently skipped. Replay integrity depends on every line being valid.
        """
        if not self.path.exists():
            self._events_cache = []
            self._events_cache_stat = None
            return []

        try:
            stat = self.path.stat()
            current_stat = (stat.st_mtime_ns, stat.st_size)
        except FileNotFoundError:
            self._events_cache = []
            self._events_cache_stat = None
            return []

        if self._events_cache is not None and self._events_cache_stat == current_stat:
            return self._events_cache

        events: list[dict] = []
        with self.path.open(encoding="utf-8") as f:
            for lineno, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"Corrupted event log at {self.path}:{lineno}: {exc}\n"
                        f"  line: {line!r}\n"
                        "Replay is not possible until the corrupted line is repaired."
                    ) from exc
        self._events_cache = events
        self._events_cache_stat = current_stat
        return self._events_cache

    def replay(self, asset_type: str, instance_id: str) -> dict:
        """Reconstruct asset state from the event stream. Convenience wrapper."""
        from .projection import project
        return project(self, asset_type, instance_id)


# ── emit — the only write path ───────────────────────────────────────────────

# Module-level stream reference. Set by workspace_bootstrap() or init_stream().
_stream: Optional[EventStream] = None

# Module-level snapshot ID. Set by init_snapshot() at engine startup.
_active_snapshot_id: Optional[str] = None

# Work event types that must carry package_snapshot_id (PackageSnapshot.work_binding).
_WORK_EVENT_TYPES = frozenset({
    "vector_started", "edge_converged", "assessed", "approved", "revoked",
})
_USE_ACTIVE_SNAPSHOT = object()


def init_stream(stream: EventStream) -> None:
    """Bind the module-level stream. Called by workspace_bootstrap."""
    global _stream
    _stream = stream


def init_snapshot(snapshot_id: str) -> None:
    """Bind the active package snapshot ID. Called at engine startup."""
    global _active_snapshot_id
    _active_snapshot_id = snapshot_id


def emit(
    event_type: str,
    data: dict,
    *,
    stream: EventStream | None = None,
    context: EventContext | None = None,
    package_snapshot_id: object | str | None = _USE_ACTIVE_SNAPSHOT,
) -> dict:
    """
    F_D event logger. The ONLY admissible write to events.jsonl.

    event_time is assigned from the system clock — no caller can pass it.
    F_P constructs content; the F_D engine calls emit(). Never the reverse.

    `assessed{kind: fp}` events must carry `spec_hash`.
    Prime event validation: approved and revoked must carry kind.

    Optional explicit stream/context support pre-stack command surfaces while
    preserving emit() as the single lawful write path.

    Raises RuntimeError if no stream is available.
    Raises ValueError if a prime event payload fails validation.
    Returns the written event record.
    """
    active_stream = stream or _stream
    if active_stream is None:
        raise RuntimeError(
            "emit() called without an active EventStream. "
            "Call workspace_bootstrap(path) first or pass stream=..."
        )
    payload = dict(data)
    if event_type == "assessed" and payload.get("kind") == "fp" and "spec_hash" not in payload:
        raise ValueError(
            "assessed{kind: fp} events must include 'spec_hash'. "
            "Use bind.req_hash(package.requirements) to compute it."
        )
    if event_type in ("approved", "revoked") and "kind" not in payload:
        raise ValueError(
            f"{event_type} events must include 'kind' field. "
            "Without kind, the event is silently ignored by the projection layer."
        )
    if event_type == "reset":
        scope = payload.get("scope")
        if scope not in ("workspace", "work_key", "edge"):
            raise ValueError(
                f"reset events must include 'scope' field with value "
                f"workspace, work_key, or edge — got {scope!r}"
            )
        if scope in ("work_key", "edge") and "work_key" not in payload:
            raise ValueError(
                f"reset with scope={scope!r} requires 'work_key' field"
            )
        if scope == "edge" and "edge" not in payload:
            raise ValueError(
                "reset with scope='edge' requires 'edge' field"
            )
    snapshot_id = (
        _active_snapshot_id
        if package_snapshot_id is _USE_ACTIVE_SNAPSHOT
        else package_snapshot_id
    )
    if event_type in _WORK_EVENT_TYPES and snapshot_id is not None:
        payload.setdefault("package_snapshot_id", snapshot_id)
    record = active_stream.append(event_type, payload, context=context)
    if event_type == "reset":
        from .correction import emit_reset_followups

        emit_reset_followups(active_stream, record)
    return record

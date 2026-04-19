# Implements: REQ-R-ABG3-RUN
# Implements: REQ-R-ABG3-PROJECTION
"""
live_status — operator-grade live run status projection.
"""
from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .continuation import continuation_state
from .events import EventStream
from .fulfillment_ledger import latest_fp_assessed_event, resolve_published_fulfillment_ledger
from .graph_call import project_graph_call
from .proof_hold import project_proof_hold
from .run import ACTIVE_RUN_STATES, project_run
from .transport import inspect_result_artifact


PROGRESS_EVENT_TYPES = frozenset(
    {
        "fp_dispatched",
        "worker_turn_started",
        "worker_turn_progress",
        "result_artifact_observed",
        "worker_turn_salvage_candidate",
        "worker_turn_salvaged",
        "worker_turn_succeeded",
        "worker_turn_failed",
        "worker_turn_stalled",
        "graph_call_closed",
        "graph_call_failed",
        "run_yielded",
        "run_completed",
        "run_failed",
    }
)


def _event_value(event: dict[str, Any], key: str) -> Any:
    value = event.get(key)
    if value is not None:
        return value
    return event.get("data", {}).get(key)


def _parse_event_time(value: str | None) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _latest_run_id(events: list[dict[str, Any]]) -> str | None:
    for event in reversed(events):
        run_id = _event_value(event, "run_id")
        if isinstance(run_id, str) and run_id:
            return run_id
    return None


def _call_ids_for_run(events: list[dict[str, Any]], run_id: str) -> list[str]:
    call_ids: list[str] = []
    for event in events:
        if _event_value(event, "run_id") != run_id:
            continue
        call_id = _event_value(event, "call_id")
        if isinstance(call_id, str) and call_id and call_id not in call_ids:
            call_ids.append(call_id)
    return call_ids


def _latest_progress_event(
    events: list[dict[str, Any]],
    *,
    run_id: str,
    call_id: str | None,
) -> dict[str, Any] | None:
    for event in reversed(events):
        if event.get("event_type") not in PROGRESS_EVENT_TYPES:
            continue
        if _event_value(event, "run_id") == run_id:
            return event
        if call_id is not None and _event_value(event, "call_id") == call_id:
            return event
    return None


def _latest_manifest_id(
    events: list[dict[str, Any]],
    *,
    run_id: str,
    call_id: str | None,
) -> str | None:
    for event in reversed(events):
        if _event_value(event, "run_id") != run_id and (
            call_id is None or _event_value(event, "call_id") != call_id
        ):
            continue
        manifest_id = _event_value(event, "manifest_id")
        if isinstance(manifest_id, str) and manifest_id:
            return manifest_id
    return None


def _read_manifest(workspace: Path, manifest_id: str | None) -> dict[str, Any]:
    if not isinstance(manifest_id, str) or not manifest_id:
        return {}
    manifest_path = workspace / ".ai-workspace" / "fp_manifests" / f"{manifest_id}.json"
    if not manifest_path.exists():
        return {}
    try:
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return dict(raw) if isinstance(raw, Mapping) else {}


def _dispatch_mode(events: list[dict[str, Any]], *, run_id: str, call_id: str | None) -> str | None:
    for event in reversed(events):
        if event.get("event_type") != "worker_turn_started":
            continue
        if _event_value(event, "run_id") == run_id or (
            call_id is not None and _event_value(event, "call_id") == call_id
        ):
            mode = _event_value(event, "dispatch_mode")
            if isinstance(mode, str) and mode:
                return mode
    return None


def _open_continuations(events: list[dict[str, Any]], *, run_id: str) -> list[dict[str, Any]]:
    continuation_ids: list[str] = []
    for event in events:
        continuation_id = _event_value(event, "continuation_id")
        if _event_value(event, "run_id") != run_id:
            continue
        if isinstance(continuation_id, str) and continuation_id and continuation_id not in continuation_ids:
            continuation_ids.append(continuation_id)

    open_items: list[dict[str, Any]] = []
    for continuation_id in continuation_ids:
        state = continuation_state(events, continuation_id)
        if state is None or state.state != "open":
            continue
        open_items.append(
            {
                "continuation_id": continuation_id,
                "continuation_kind": state.continuation_kind,
                "call_id": state.call_id,
                "status": state.state,
            }
        )
    return open_items


def _lease_timeout_seconds(manifest: Mapping[str, Any]) -> int:
    resolved_policy = manifest.get("resolved_policy")
    if isinstance(resolved_policy, Mapping):
        dispatch = resolved_policy.get("dispatch")
        if isinstance(dispatch, Mapping):
            config = dispatch.get("config")
            if isinstance(config, Mapping):
                timeout = config.get("timeout")
                if isinstance(timeout, int) and timeout > 0:
                    return timeout
    return 300


def project_live_run_status(
    workspace: Path,
    run_id: str | None = None,
    *,
    runtime_config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    stream = EventStream.open(workspace)
    events = stream.all_events()
    resolved_run_id = run_id or _latest_run_id(events)
    if resolved_run_id is None:
        return {
            "asset_type": "run_status",
            "status": "not_started",
            "workspace": str(workspace),
            "event_count": 0,
        }

    run_projection = project_run(events, resolved_run_id)
    call_ids = _call_ids_for_run(events, resolved_run_id)
    call_id = call_ids[-1] if call_ids else None
    graph_call = project_graph_call(events, call_id) if call_id else None
    progress_event = _latest_progress_event(events, run_id=resolved_run_id, call_id=call_id)
    manifest_id = run_projection.get("manifest_id") or _latest_manifest_id(
        events,
        run_id=resolved_run_id,
        call_id=call_id,
    )
    manifest = _read_manifest(workspace, manifest_id if isinstance(manifest_id, str) else None)
    latest_ledger_event = latest_fp_assessed_event(
        events,
        run_id=resolved_run_id,
        call_id=call_id,
    )
    published_ledger = resolve_published_fulfillment_ledger(
        events,
        run_id=resolved_run_id,
        call_id=call_id,
        edge=run_projection.get("edge") if isinstance(run_projection.get("edge"), str) else None,
        work_key=run_projection.get("work_key") if isinstance(run_projection.get("work_key"), str) else None,
        spec_hash=manifest.get("spec_hash") if isinstance(manifest.get("spec_hash"), str) else None,
        current_workflow_version=manifest.get("workflow_version") if isinstance(manifest.get("workflow_version"), str) else "unknown",
        workspace=workspace,
        ledger_ref=(
            latest_ledger_event.get("data", {}).get("published_ledger_ref")
            if isinstance(latest_ledger_event, Mapping)
            else None
        ),
    ) or {}
    result_path = manifest.get("result_path") if isinstance(manifest.get("result_path"), str) else None
    artifact = inspect_result_artifact(
        result_path,
        manifest=manifest,
    ) if result_path else None

    progress_time = _parse_event_time(progress_event.get("event_time") if isinstance(progress_event, Mapping) else None)
    lease_timeout_seconds = _lease_timeout_seconds(manifest)
    live_state = run_projection.get("status", "not_started")
    if live_state in ACTIVE_RUN_STATES:
        if progress_time is not None:
            age = (datetime.now(timezone.utc) - progress_time.astimezone(timezone.utc)).total_seconds()
            if age > lease_timeout_seconds:
                live_state = "stalled"
            else:
                live_state = "active" if live_state != "yielded" else "yielded"
        else:
            live_state = "active" if live_state != "yielded" else "yielded"

    edge = run_projection.get("edge")
    if not isinstance(edge, str) or not edge:
        if isinstance(progress_event, Mapping):
            maybe_edge = _event_value(progress_event, "edge")
            if isinstance(maybe_edge, str):
                edge = maybe_edge

    proof_hold = project_proof_hold(
        workspace,
        edge=edge if isinstance(edge, str) else None,
        work_key=run_projection.get("work_key") if isinstance(run_projection.get("work_key"), str) else None,
        spec_hash=manifest.get("spec_hash") if isinstance(manifest.get("spec_hash"), str) else None,
        workflow_version=manifest.get("workflow_version") if isinstance(manifest.get("workflow_version"), str) else None,
        manifest_id=manifest_id if isinstance(manifest_id, str) else None,
        runtime_config=runtime_config,
        all_events=events,
    )

    return {
        "asset_type": "run_status",
        "workspace": str(workspace),
        "run_id": resolved_run_id,
        "live_state": live_state,
        "run_status": run_projection.get("status"),
        "active_edge": edge,
        "active_call_id": call_id,
        "graph_call_status": graph_call.get("status") if isinstance(graph_call, Mapping) else None,
        "failure_class": run_projection.get("failure_class"),
        "dispatch_mode": _dispatch_mode(events, run_id=resolved_run_id, call_id=call_id),
        "manifest_id": manifest_id,
        "result_path": result_path,
        "result_artifact_status": artifact.status if artifact is not None else None,
        "result_artifact_failure_class": artifact.failure_class if artifact is not None else None,
        "result_artifact_valid": artifact.valid if artifact is not None else False,
        "published_fulfillment_ledger_ref": published_ledger.get("published_ledger_ref"),
        "published_fulfillment_admitted": (
            published_ledger.get("admitted") if published_ledger else None
        ),
        "published_fulfillment_edge_converged": (
            published_ledger.get("edge_converged") if published_ledger else None
        ),
        "proof_hold": proof_hold,
        "proof_hold_active": bool(proof_hold.get("held")),
        "last_progress_event_type": progress_event.get("event_type") if isinstance(progress_event, Mapping) else None,
        "last_progress_at": progress_event.get("event_time") if isinstance(progress_event, Mapping) else None,
        "open_continuations": _open_continuations(events, run_id=resolved_run_id),
        "event_count": run_projection.get("event_count", 0),
    }

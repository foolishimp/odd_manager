# Implements: REQ-R-ABG3-EVENTS
from __future__ import annotations

from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any
import uuid

from .events import EventContext, EventStream, emit
from .fulfillment_ledger import (
    coerce_published_fulfillment_ledger_ref,
    latest_fp_assessed_event,
    load_published_fulfillment_ledger,
    published_fulfillment_ledger_path_from_ref,
    update_published_fulfillment_ledger_admission,
)


def _event_value(event: Mapping[str, Any], key: str) -> Any:
    value = event.get(key)
    if value is not None:
        return value
    data = event.get("data", {})
    if isinstance(data, Mapping):
        return data.get(key)
    return None


def _workspace_root(stream: EventStream) -> Path:
    return stream.path.parent.parent.parent


def _target_asset(edge: str, manifest: Mapping[str, Any], vector_id: str | None) -> str:
    target_asset = manifest.get("target_asset")
    if isinstance(target_asset, str) and target_asset.strip():
        return target_asset
    if "→" in edge:
        return edge.split("→", 1)[1].strip()
    if vector_id:
        return vector_id
    return ""


def _event_context_from_assessed(
    assessed_event: Mapping[str, Any],
    *,
    call_id: str | None,
    aggregate_type: str | None = None,
    aggregate_id: str | None = None,
    parent_aggregate_id: str | None = None,
    causation_event_id: str | None = None,
) -> EventContext:
    return EventContext(
        workflow_version=str(_event_value(assessed_event, "workflow_version") or "unknown"),
        work_key=_event_value(assessed_event, "work_key"),
        run_id=_event_value(assessed_event, "run_id"),
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        parent_aggregate_id=parent_aggregate_id,
        causation_event_id=causation_event_id,
        job_id=_event_value(assessed_event, "job_id"),
        graph_function_id=_event_value(assessed_event, "graph_function_id"),
        materialization_id=_event_value(assessed_event, "materialization_id"),
        call_id=call_id,
        vector_id=_event_value(assessed_event, "vector_id"),
    )


def _emit_event(
    stream: EventStream,
    event_type: str,
    data: dict[str, Any],
    *,
    assessed_event: Mapping[str, Any],
    call_id: str | None,
    causation_event_id: str | None,
) -> dict[str, Any]:
    run_id = _event_value(assessed_event, "run_id")
    aggregate_type = None
    aggregate_id = None
    parent_aggregate_id = None
    if call_id:
        aggregate_type = "graph_call"
        aggregate_id = call_id
        parent_aggregate_id = run_id or None
    elif isinstance(run_id, str) and run_id:
        aggregate_type = "run"
        aggregate_id = run_id
    return emit(
        event_type,
        data,
        stream=stream,
        context=_event_context_from_assessed(
            assessed_event,
            call_id=call_id,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            parent_aggregate_id=parent_aggregate_id,
            causation_event_id=causation_event_id,
        ),
    )


def _write_event(
    stream: EventStream,
    event_type: str,
    data: dict[str, Any],
    *,
    assessed_event: Mapping[str, Any],
    call_id: str | None,
    causation_event_id: str | None,
    emit_event: Callable[..., Any] | None = None,
    aggregate_type: str | None = None,
    aggregate_id: str | None = None,
    parent_aggregate_id: str | None = None,
) -> dict[str, Any]:
    if emit_event is None:
        return emit(
            event_type,
            data,
            stream=stream,
            context=_event_context_from_assessed(
                assessed_event,
                call_id=call_id,
                aggregate_type=aggregate_type,
                aggregate_id=aggregate_id,
                parent_aggregate_id=parent_aggregate_id,
                causation_event_id=causation_event_id,
            ),
        )
    result = emit_event(
        _workspace_root(stream),
        event_type,
        data,
        workflow_version=str(_event_value(assessed_event, "workflow_version") or "unknown"),
        work_key=_event_value(assessed_event, "work_key"),
        run_id=_event_value(assessed_event, "run_id"),
    )
    if isinstance(result, Mapping):
        return dict(result)
    return {}


def _open_continuation_ids(
    stream: EventStream,
    *,
    run_id: str | None,
    call_id: str | None,
) -> list[str]:
    from .continuation import continuation_state

    continuation_ids: set[str] = set()
    for event in stream.all_events():
        continuation_id = event.get("aggregate_id")
        if event.get("aggregate_type") != "continuation":
            continuation_id = event.get("data", {}).get("continuation_id")
        if not isinstance(continuation_id, str) or not continuation_id:
            continue
        continuation_ids.add(continuation_id)

    open_ids: list[str] = []
    for continuation_id in continuation_ids:
        state = continuation_state(stream.all_events(), continuation_id)
        if state is None or state.state != "open":
            continue
        if run_id is not None and state.run_id != run_id:
            continue
        if call_id is not None and state.call_id not in (None, call_id):
            continue
        open_ids.append(continuation_id)
    return open_ids


def _resolve_open_continuations(
    stream: EventStream,
    *,
    assessed_event: Mapping[str, Any],
    call_id: str | None,
    latest_event_id: str | None,
) -> str | None:
    run_id = _event_value(assessed_event, "run_id")
    for continuation_id in _open_continuation_ids(
        stream,
        run_id=run_id if isinstance(run_id, str) and run_id else None,
        call_id=call_id,
    ):
        resolved = emit(
            "continuation_resolved",
            {
                "continuation_id": continuation_id,
                "call_id": call_id or None,
                "caused_by_event_id": latest_event_id,
            },
            stream=stream,
            context=_event_context_from_assessed(
                assessed_event,
                call_id=call_id,
                aggregate_type="continuation",
                aggregate_id=continuation_id,
                parent_aggregate_id=run_id if isinstance(run_id, str) and run_id else None,
                causation_event_id=latest_event_id,
            ),
        )
        latest_event_id = resolved.get("event_id")
    return latest_event_id


def _matching_workflow_version(
    trigger_event: Mapping[str, Any],
    ledger_data: Mapping[str, Any],
    manifest: Mapping[str, Any] | None,
) -> bool:
    ledger_workflow_version = ledger_data.get("workflow_version")
    trigger_workflow_version = _event_value(trigger_event, "workflow_version")
    if not isinstance(ledger_workflow_version, str) or not ledger_workflow_version:
        return True
    if not isinstance(trigger_workflow_version, str) or not trigger_workflow_version:
        return False
    if trigger_workflow_version == ledger_workflow_version:
        return True
    if not isinstance(manifest, Mapping):
        return False
    carry_forward = manifest.get("approved_carry_forward")
    if not isinstance(carry_forward, list):
        return False
    trigger_edge = _event_value(trigger_event, "edge")
    trigger_work_key = _event_value(trigger_event, "work_key")
    for carry in carry_forward:
        if not isinstance(carry, Mapping):
            continue
        if carry.get("edge") != trigger_edge:
            continue
        if carry.get("from_version") != trigger_workflow_version:
            continue
        if carry.get("work_key", None) != (trigger_work_key or None):
            continue
        return True
    return False


def _manifest_for_ledger(
    stream: EventStream,
    assessed_event: Mapping[str, Any],
    ledger_data: Mapping[str, Any],
) -> dict[str, Any] | None:
    from .result_ingest import _read_json

    manifest_id = _event_value(assessed_event, "manifest_id") or ledger_data.get("manifest_id")
    if not isinstance(manifest_id, str) or not manifest_id:
        manifest_id = ""
    if manifest_id:
        manifest_path = _workspace_root(stream) / ".ai-workspace" / "fp_manifests" / f"{manifest_id}.json"
        if manifest_path.exists():
            return _read_json(manifest_path, label=f"manifest file {manifest_path}")

    workflow_version = ledger_data.get("workflow_version")
    if not isinstance(workflow_version, str) or "@" not in workflow_version:
        return None
    workflow, version = workflow_version.split("@", 1)
    parts = workflow.split(".", 1)
    pkg_name = parts[0]
    variant = parts[1] if len(parts) > 1 else "default"
    version_dir = "v" + version.replace(".", "_")
    workflow_manifest = (
        _workspace_root(stream)
        / ".genesis"
        / "workflows"
        / pkg_name
        / variant
        / version_dir
        / "manifest.json"
    )
    if not workflow_manifest.exists():
        return None
    manifest = _read_json(workflow_manifest, label=f"workflow manifest {workflow_manifest}")
    manifest.setdefault("manifest_id", manifest_id)
    return manifest


def _approval_basis(trigger_event: Mapping[str, Any]) -> str:
    kind = _event_value(trigger_event, "kind")
    if isinstance(kind, str) and kind:
        return f"approved_{kind}"
    return "approved_fh_review"


def _emit_success_lifecycle(
    stream: EventStream,
    *,
    assessed_event: Mapping[str, Any],
    ledger_data: Mapping[str, Any],
    latest_event_id: str | None,
    emit_event: Callable[..., Any] | None = None,
) -> None:
    edge = str(ledger_data.get("edge") or _event_value(assessed_event, "edge") or "")
    manifest_id = str(ledger_data.get("manifest_id") or _event_value(assessed_event, "manifest_id") or "")
    call_id = _event_value(assessed_event, "call_id")
    call_id = call_id if isinstance(call_id, str) and call_id else None
    work_key = _event_value(assessed_event, "work_key")
    work_key = work_key if isinstance(work_key, str) and work_key else None
    run_id = _event_value(assessed_event, "run_id")
    run_id = run_id if isinstance(run_id, str) and run_id else None
    graph_call_terminal = bool(ledger_data.get("graph_call_terminal_on_result", True))

    proof_event = _write_event(
        stream,
        "proof_passed",
        {
            "call_id": call_id,
            "edge": edge,
            "manifest_id": manifest_id,
            "spec_hash": _event_value(assessed_event, "spec_hash"),
            "policy_mode": "default",
        },
        assessed_event=assessed_event,
        call_id=call_id,
        causation_event_id=latest_event_id,
        emit_event=emit_event,
    )
    latest_event_id = proof_event.get("event_id")

    latest_event_id = _resolve_open_continuations(
        stream,
        assessed_event=assessed_event,
        call_id=call_id,
        latest_event_id=latest_event_id,
    )

    closure_event = _write_event(
        stream,
        "closure_passed",
        {
            "call_id": call_id,
            "edge": edge,
            "manifest_id": manifest_id,
            "policy_mode": "default",
        },
        assessed_event=assessed_event,
        call_id=call_id,
        causation_event_id=latest_event_id,
        emit_event=emit_event,
    )
    latest_event_id = closure_event.get("event_id")

    target = str(ledger_data.get("target_asset") or _target_asset(edge, {}, _event_value(assessed_event, "vector_id")))
    if target:
        edge_converged = _write_event(
            stream,
            "edge_converged",
            {
                "edge": edge,
                "vector_id": _event_value(assessed_event, "vector_id") or "",
                "target": target,
                "work_key": work_key,
                "delta": 0,
                "certified_by": "published_fulfillment_ledger",
            },
            assessed_event=assessed_event,
            call_id=call_id,
            causation_event_id=latest_event_id,
            emit_event=emit_event,
        )
        latest_event_id = edge_converged.get("event_id")

    if call_id and graph_call_terminal:
        graph_call_closed = _write_event(
            stream,
            "graph_call_closed",
            {
                "call_id": call_id,
                "edge": edge,
                "manifest_id": manifest_id,
            },
            assessed_event=assessed_event,
            call_id=call_id,
            causation_event_id=latest_event_id,
            emit_event=emit_event,
        )
        latest_event_id = graph_call_closed.get("event_id")

    if run_id:
        _write_event(
            stream,
            "run_completed",
            {
                "call_id": call_id,
                "edge": edge,
            },
            assessed_event=assessed_event,
            call_id=call_id,
            causation_event_id=latest_event_id,
            emit_event=emit_event,
            aggregate_type="run",
            aggregate_id=run_id,
        )


def _emit_reopen_lifecycle(
    stream: EventStream,
    *,
    assessed_event: Mapping[str, Any],
    ledger_data: Mapping[str, Any],
    latest_event_id: str | None,
    emit_event: Callable[..., Any] | None = None,
) -> None:
    edge = str(ledger_data.get("edge") or _event_value(assessed_event, "edge") or "")
    manifest_id = str(ledger_data.get("manifest_id") or _event_value(assessed_event, "manifest_id") or "")
    call_id = _event_value(assessed_event, "call_id")
    call_id = call_id if isinstance(call_id, str) and call_id else None
    run_id = _event_value(assessed_event, "run_id")
    run_id = run_id if isinstance(run_id, str) and run_id else None
    work_key = _event_value(assessed_event, "work_key")
    work_key = work_key if isinstance(work_key, str) and work_key else None
    proof_event = _write_event(
        stream,
        "proof_failed",
        {
            "call_id": call_id,
            "edge": edge,
            "manifest_id": manifest_id,
            "spec_hash": _event_value(assessed_event, "spec_hash"),
            "policy_mode": "default",
            "policy_reason": str(ledger_data.get("admission_basis") or "pending_fh_review"),
        },
        assessed_event=assessed_event,
        call_id=call_id,
        causation_event_id=latest_event_id,
        emit_event=emit_event,
    )
    latest_event_id = proof_event.get("event_id")
    closure_event = _write_event(
        stream,
        "closure_failed",
        {
            "call_id": call_id,
            "edge": edge,
            "manifest_id": manifest_id,
            "policy_mode": "default",
            "policy_reason": str(ledger_data.get("admission_basis") or "pending_fh_review"),
        },
        assessed_event=assessed_event,
        call_id=call_id,
        causation_event_id=latest_event_id,
        emit_event=emit_event,
    )
    latest_event_id = closure_event.get("event_id")
    target = _target_asset(edge, {}, _event_value(assessed_event, "vector_id"))
    if target:
        edge_reopened = _write_event(
            stream,
            "edge_reopened",
            {
                "edge": edge,
                "vector_id": _event_value(assessed_event, "vector_id") or "",
                "target": target,
                "work_key": work_key,
                "delta": 1,
                "reopened_by": "published_fulfillment_ledger",
            },
            assessed_event=assessed_event,
            call_id=call_id,
            causation_event_id=latest_event_id,
            emit_event=emit_event,
        )
        latest_event_id = edge_reopened.get("event_id")
    if call_id:
        graph_call_failed = _write_event(
            stream,
            "graph_call_failed",
            {
                "call_id": call_id,
                "edge": edge,
                "failure_class": "probabilistic_non_convergence",
                "manifest_id": manifest_id,
            },
            assessed_event=assessed_event,
            call_id=call_id,
            causation_event_id=latest_event_id,
            emit_event=emit_event,
        )
        latest_event_id = graph_call_failed.get("event_id")
    if not _open_continuation_ids(stream, run_id=run_id, call_id=call_id):
        continuation_id = f"cont-{uuid.uuid4().hex}"
        continuation_opened = emit(
            "continuation_opened",
            {
                "continuation_id": continuation_id,
                "continuation_kind": "fh_review",
                "call_id": call_id,
                "caused_by_event_id": latest_event_id,
            },
            stream=stream,
            context=_event_context_from_assessed(
                assessed_event,
                call_id=call_id,
                aggregate_type="continuation",
                aggregate_id=continuation_id,
                parent_aggregate_id=run_id,
                causation_event_id=latest_event_id,
            ),
        )
        latest_event_id = continuation_opened.get("event_id")
    if run_id:
        _write_event(
            stream,
            "run_failed",
            {
                "failure_class": "probabilistic_non_convergence",
                "call_id": call_id,
                "edge": edge,
            },
            assessed_event=assessed_event,
            call_id=call_id,
            causation_event_id=latest_event_id,
            emit_event=emit_event,
            aggregate_type="run",
            aggregate_id=run_id,
        )


def emit_fulfillment_transition_followups(stream: EventStream, trigger_event: Mapping[str, Any]) -> None:
    trigger_type = trigger_event.get("event_type")
    trigger_kind = _event_value(trigger_event, "kind")
    if trigger_type == "approved":
        if trigger_kind not in ("fh_review", "fh_intent"):
            return
    elif trigger_type == "revoked":
        if trigger_kind != "fh_approval":
            return
    else:
        return

    edge = _event_value(trigger_event, "edge")
    if not isinstance(edge, str) or not edge:
        return
    work_key = _event_value(trigger_event, "work_key")
    if work_key is not None and not isinstance(work_key, str):
        return

    all_events = stream.all_events()
    latest_assessed = latest_fp_assessed_event(
        all_events,
        edge=edge,
        work_key=work_key if isinstance(work_key, str) else None,
    )
    if latest_assessed is None:
        return

    try:
        ledger_ref = coerce_published_fulfillment_ledger_ref(
            _event_value(latest_assessed, "published_ledger_ref")
        )
    except ValueError:
        return
    ledger_path = published_fulfillment_ledger_path_from_ref(_workspace_root(stream), ledger_ref)
    stored_ledger = load_published_fulfillment_ledger(ledger_path)
    if stored_ledger is None or not bool(stored_ledger.get("admission_required")):
        return
    manifest = _manifest_for_ledger(stream, latest_assessed, stored_ledger)
    if not _matching_workflow_version(trigger_event, stored_ledger, manifest):
        return

    previous_edge_converged = bool(stored_ledger.get("edge_converged"))
    previous_admitted = bool(stored_ledger.get("admitted"))
    if trigger_type == "approved":
        next_admitted = True
        next_basis = _approval_basis(trigger_event)
    else:
        next_admitted = False
        next_basis = "revoked_fh_approval"
    if previous_admitted == next_admitted and stored_ledger.get("admission_basis") == next_basis:
        return

    updated_ledger = update_published_fulfillment_ledger_admission(
        _workspace_root(stream),
        ledger_ref,
        admitted=next_admitted,
        admission_basis=next_basis,
    )
    if updated_ledger is None:
        return
    current_edge_converged = bool(updated_ledger.get("edge_converged"))
    latest_event_id = trigger_event.get("event_id")

    if previous_edge_converged == current_edge_converged:
        return
    if not previous_edge_converged and current_edge_converged:
        _emit_success_lifecycle(
            stream,
            assessed_event=latest_assessed,
            ledger_data=updated_ledger,
            latest_event_id=latest_event_id,
        )
        return
    _emit_reopen_lifecycle(
        stream,
        assessed_event=latest_assessed,
        ledger_data=updated_ledger,
        latest_event_id=latest_event_id,
    )

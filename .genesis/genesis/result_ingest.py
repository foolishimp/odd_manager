# Implements: REQ-R-ABG3-INTERPRET
# Implements: REQ-R-ABG3-EVENTS
# Implements: REQ-R-ABG3-PROVENANCE
"""
result_ingest — engine-owned F_P result ingestion and assessed-event emission.
"""
from __future__ import annotations

import json
import uuid
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

from .events import EventContext, EventStream, emit
from .continuation import continuation_state
from .policy import materialize_policy_concern, resolve_policy_bundle
from .provenance import _read_workflow_version


def validate_fp_result_payload(payload: Any) -> bool:
    """Return True when the payload satisfies the F_P result contract."""
    if not isinstance(payload, Mapping):
        return False
    if not isinstance(payload.get("edge"), str) or not payload.get("edge"):
        return False
    if not isinstance(payload.get("actor"), str) or not payload.get("actor"):
        return False
    assessments = payload.get("assessments")
    if not isinstance(assessments, list) or not assessments:
        return False
    for assessment in assessments:
        if not isinstance(assessment, Mapping):
            return False
        evaluator = assessment.get("evaluator")
        result = assessment.get("result")
        if not isinstance(evaluator, str) or not evaluator:
            return False
        if result not in ("pass", "fail"):
            return False
    return True


def _emit_workspace_event(
    workspace: Path,
    event_type: str,
    data: dict[str, Any],
    *,
    workflow_version: str = "unknown",
    work_key: str | None = None,
    run_id: str | None = None,
    aggregate_type: str | None = None,
    aggregate_id: str | None = None,
    parent_aggregate_id: str | None = None,
    causation_event_id: str | None = None,
    job_id: str | None = None,
    graph_function_id: str | None = None,
    materialization_id: str | None = None,
    call_id: str | None = None,
    frame_attempt_id: str | None = None,
    frame_lineage_id: str | None = None,
    vector_id: str | None = None,
) -> dict:
    return emit(
        event_type,
        data,
        stream=EventStream.open(workspace),
        context=EventContext(
            workflow_version=workflow_version,
            work_key=work_key,
            run_id=run_id,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            parent_aggregate_id=parent_aggregate_id,
            causation_event_id=causation_event_id,
            job_id=job_id,
            graph_function_id=graph_function_id,
            materialization_id=materialization_id,
            call_id=call_id,
            frame_attempt_id=frame_attempt_id,
            frame_lineage_id=frame_lineage_id,
            vector_id=vector_id,
        ),
    )


def _read_json(path: Path, *, label: str) -> dict[str, Any]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} is not valid JSON: {exc}") from exc
    if not isinstance(raw, Mapping):
        raise ValueError(f"{label} must contain a JSON object")
    return dict(raw)


def _read_provenance(*values: object) -> str:
    for value in values:
        if isinstance(value, str) and value:
            return value
    return ""


def _policy_bundle(manifest: Mapping[str, Any]) -> dict[str, Any]:
    resolved = manifest.get("resolved_policy")
    if isinstance(resolved, Mapping):
        return dict(resolved)
    return resolve_policy_bundle()


def _event_writer(
    workspace: Path,
    emit_event: Callable[..., Any] | None,
    event_type: str,
    data: dict[str, Any],
    *,
    workflow_version: str,
    work_key: str | None,
    run_id: str | None,
    aggregate_type: str | None = None,
    aggregate_id: str | None = None,
    parent_aggregate_id: str | None = None,
    causation_event_id: str | None = None,
    job_id: str | None = None,
    graph_function_id: str | None = None,
    materialization_id: str | None = None,
    call_id: str | None = None,
    frame_attempt_id: str | None = None,
    frame_lineage_id: str | None = None,
    vector_id: str | None = None,
) -> dict[str, Any]:
    if emit_event is None:
        return _emit_workspace_event(
            workspace,
            event_type,
            data,
            workflow_version=workflow_version,
            work_key=work_key,
            run_id=run_id,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            parent_aggregate_id=parent_aggregate_id,
            causation_event_id=causation_event_id,
            job_id=job_id,
            graph_function_id=graph_function_id,
            materialization_id=materialization_id,
            call_id=call_id,
            frame_attempt_id=frame_attempt_id,
            frame_lineage_id=frame_lineage_id,
            vector_id=vector_id,
        )
    result = emit_event(
        workspace,
        event_type,
        data,
        workflow_version=workflow_version,
        work_key=work_key,
        run_id=run_id,
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


def ingest_fp_result(
    result_path: str | Path,
    workspace: Path,
    *,
    manifest_data: Mapping[str, Any] | None = None,
    active_workflow_path: str | None = None,
    emit_event: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    """
    Ingest one F_P result JSON file and emit assessed{kind: fp} events.

    Returns a structured summary. Raises ValueError on malformed inputs.
    """
    result_file = Path(result_path)
    if not result_file.exists():
        raise ValueError(f"result file not found: {result_file}")
    result_data = _read_json(result_file, label=f"result file {result_file}")
    if not validate_fp_result_payload(result_data):
        raise ValueError("result file does not satisfy the F_P result contract")

    manifest_id = result_file.stem
    manifest = dict(manifest_data or {})
    if not manifest:
        manifest_file = workspace / ".ai-workspace" / "fp_manifests" / f"{manifest_id}.json"
        if not manifest_file.exists():
            raise ValueError(f"matching manifest not found: {manifest_file}")
        manifest = _read_json(manifest_file, label=f"manifest file {manifest_file}")

    spec_hash = manifest.get("spec_hash")
    if not isinstance(spec_hash, str) or not spec_hash:
        raise ValueError("manifest must provide non-empty spec_hash for assessed{kind: fp}")

    manifest_run_id = manifest.get("run_id") if isinstance(manifest.get("run_id"), str) else ""
    manifest_work_key = manifest.get("work_key") if isinstance(manifest.get("work_key"), str) else ""
    call_id = manifest.get("call_id") if isinstance(manifest.get("call_id"), str) and manifest.get("call_id") else ""
    graph_call_terminal = bool(manifest.get("graph_call_terminal_on_result", True))
    workflow_version = _read_provenance(
        manifest.get("workflow_version"),
        _read_workflow_version(workspace, active_workflow_path),
    ) or "unknown"
    graph_function_id = _read_provenance(manifest.get("graph_function_id"))
    materialization_id = _read_provenance(manifest.get("materialization_id"))
    vector_id = _read_provenance(manifest.get("vector_id"))
    job_id = _read_provenance(manifest.get("job_id"))

    selected_worker_id = _read_provenance(
        result_data.get("selected_worker_id"),
        result_data.get("worker_id"),
        manifest.get("selected_worker_id"),
        manifest.get("worker_id"),
    )
    selected_backend = _read_provenance(
        result_data.get("selected_backend"),
        result_data.get("backend_id"),
        manifest.get("selected_backend"),
        manifest.get("backend_id"),
    )
    role_id = _read_provenance(result_data.get("role_id"), manifest.get("role_id"))
    authority_ref = _read_provenance(result_data.get("authority_ref"), manifest.get("authority_ref"))
    assignment_source = _read_provenance(
        result_data.get("assignment_source"),
        manifest.get("assignment_source"),
    )
    resolved_runtime_ref = _read_provenance(
        result_data.get("resolved_runtime_ref"),
        manifest.get("resolved_runtime_ref"),
    )
    resolved_policy = _policy_bundle(manifest)
    proof_policy = materialize_policy_concern(resolved_policy, "proof")
    closure_policy = materialize_policy_concern(resolved_policy, "closure")

    stream = EventStream.open(workspace)
    emitted: list[dict[str, str]] = []
    emitted_count = 0
    latest_event_id: str | None = None
    for assessment in result_data["assessments"]:
        event_data: dict[str, Any] = {
            "kind": "fp",
            "edge": result_data["edge"],
            "evaluator": assessment["evaluator"],
            "result": assessment["result"],
            "evidence": assessment.get("evidence", ""),
            "actor": result_data["actor"],
            "spec_hash": spec_hash,
            "manifest_id": manifest_id,
            "workflow_version": workflow_version,
        }
        if selected_worker_id:
            event_data["selected_worker_id"] = selected_worker_id
        if selected_backend:
            event_data["backend_id"] = selected_backend
            event_data["selected_backend"] = selected_backend
        if role_id:
            event_data["role_id"] = role_id
        if authority_ref:
            event_data["authority_ref"] = authority_ref
        if assignment_source:
            event_data["assignment_source"] = assignment_source
        if resolved_runtime_ref:
            event_data["resolved_runtime_ref"] = resolved_runtime_ref

        written = _event_writer(
            workspace,
            emit_event,
            "assessed",
            event_data,
            workflow_version=workflow_version,
            work_key=manifest_work_key or None,
            run_id=manifest_run_id or None,
            aggregate_type="graph_call" if call_id else ("run" if manifest_run_id else None),
            aggregate_id=call_id or (manifest_run_id or None),
            parent_aggregate_id=(manifest_run_id or None) if call_id else None,
            job_id=job_id or None,
            graph_function_id=graph_function_id or None,
            materialization_id=materialization_id or None,
            call_id=call_id or None,
            vector_id=vector_id or None,
        )
        latest_event_id = written.get("event_id")
        emitted_count += 1
        emitted.append(
            {
                "evaluator": assessment["evaluator"],
                "result": assessment["result"],
            }
        )

    proof_passed = all(assessment["result"] == "pass" for assessment in result_data["assessments"])
    if proof_passed:
        proof_event = _event_writer(
            workspace,
            emit_event,
            "proof_passed",
            {
                "call_id": call_id or None,
                "edge": result_data["edge"],
                "manifest_id": manifest_id,
                "policy_mode": proof_policy.get("mode"),
            },
            workflow_version=workflow_version,
            work_key=manifest_work_key or None,
            run_id=manifest_run_id or None,
            aggregate_type="graph_call" if call_id else ("run" if manifest_run_id else None),
            aggregate_id=call_id or (manifest_run_id or None),
            parent_aggregate_id=(manifest_run_id or None) if call_id else None,
            causation_event_id=latest_event_id,
            job_id=job_id or None,
            graph_function_id=graph_function_id or None,
            materialization_id=materialization_id or None,
            call_id=call_id or None,
            vector_id=vector_id or None,
        )
        emitted_count += 1
        latest_event_id = proof_event.get("event_id")

        closure_config = closure_policy.get("config", {})
        closure_passed = not (isinstance(closure_config, Mapping) and bool(closure_config.get("force_fail")))
        if not closure_passed:
            closure_event = _event_writer(
                workspace,
                emit_event,
                "closure_failed",
                {
                    "call_id": call_id or None,
                    "edge": result_data["edge"],
                    "manifest_id": manifest_id,
                    "policy_mode": closure_policy.get("mode"),
                },
                workflow_version=workflow_version,
                work_key=manifest_work_key or None,
                run_id=manifest_run_id or None,
                aggregate_type="graph_call" if call_id else ("run" if manifest_run_id else None),
                aggregate_id=call_id or (manifest_run_id or None),
                parent_aggregate_id=(manifest_run_id or None) if call_id else None,
                causation_event_id=latest_event_id,
                job_id=job_id or None,
                graph_function_id=graph_function_id or None,
                materialization_id=materialization_id or None,
                call_id=call_id or None,
                vector_id=vector_id or None,
            )
            emitted_count += 1
            latest_event_id = closure_event.get("event_id")

            graph_call_failed = None
            if call_id and graph_call_terminal:
                graph_call_failed = _event_writer(
                    workspace,
                    emit_event,
                    "graph_call_failed",
                    {
                        "call_id": call_id,
                        "edge": result_data["edge"],
                        "failure_class": "probabilistic_non_convergence",
                        "manifest_id": manifest_id,
                    },
                    workflow_version=workflow_version,
                    work_key=manifest_work_key or None,
                    run_id=manifest_run_id or None,
                    aggregate_type="graph_call",
                    aggregate_id=call_id,
                    parent_aggregate_id=manifest_run_id or None,
                    causation_event_id=latest_event_id,
                    job_id=job_id or None,
                    graph_function_id=graph_function_id or None,
                    materialization_id=materialization_id or None,
                    call_id=call_id,
                    vector_id=vector_id or None,
                )
                emitted_count += 1
                latest_event_id = graph_call_failed.get("event_id")

            continuation_id = f"cont-{uuid.uuid4().hex}"
            continuation_opened = _event_writer(
                workspace,
                emit_event,
                "continuation_opened",
                {
                    "continuation_id": continuation_id,
                    "continuation_kind": "fh_review",
                    "call_id": call_id or None,
                    "caused_by_event_id": latest_event_id,
                },
                workflow_version=workflow_version,
                work_key=manifest_work_key or None,
                run_id=manifest_run_id or None,
                aggregate_type="continuation",
                aggregate_id=continuation_id,
                parent_aggregate_id=manifest_run_id or None,
                causation_event_id=latest_event_id,
                call_id=call_id or None,
            )
            emitted_count += 1
            latest_event_id = continuation_opened.get("event_id")
            if manifest_run_id:
                _event_writer(
                    workspace,
                    emit_event,
                    "run_failed",
                    {
                        "failure_class": "probabilistic_non_convergence",
                        "call_id": call_id or None,
                        "edge": result_data["edge"],
                    },
                    workflow_version=workflow_version,
                    work_key=manifest_work_key or None,
                    run_id=manifest_run_id or None,
                    aggregate_type="run",
                    aggregate_id=manifest_run_id,
                    causation_event_id=latest_event_id,
                    job_id=job_id or None,
                    graph_function_id=graph_function_id or None,
                    materialization_id=materialization_id or None,
                    call_id=call_id or None,
                    vector_id=vector_id or None,
                )
                emitted_count += 1
            return {
                "status": "error",
                "result_path": str(result_file),
                "manifest_id": manifest_id,
                "spec_hash": spec_hash,
                "workflow_version": workflow_version,
                "events_emitted": emitted_count,
                "assessments": emitted,
                "failure_class": "probabilistic_non_convergence",
                "continuation_id": continuation_id,
            }

        closure_event = _event_writer(
            workspace,
            emit_event,
            "closure_passed",
            {
                "call_id": call_id or None,
                "edge": result_data["edge"],
                "manifest_id": manifest_id,
                "policy_mode": closure_policy.get("mode"),
            },
            workflow_version=workflow_version,
            work_key=manifest_work_key or None,
            run_id=manifest_run_id or None,
            aggregate_type="graph_call" if call_id else ("run" if manifest_run_id else None),
            aggregate_id=call_id or (manifest_run_id or None),
            parent_aggregate_id=(manifest_run_id or None) if call_id else None,
            causation_event_id=latest_event_id,
            job_id=job_id or None,
            graph_function_id=graph_function_id or None,
            materialization_id=materialization_id or None,
            call_id=call_id or None,
            vector_id=vector_id or None,
        )
        emitted_count += 1
        latest_event_id = closure_event.get("event_id")

        if call_id and graph_call_terminal:
            graph_call_closed = _event_writer(
                workspace,
                emit_event,
                "graph_call_closed",
                {
                    "call_id": call_id,
                    "edge": result_data["edge"],
                    "manifest_id": manifest_id,
                },
                workflow_version=workflow_version,
                work_key=manifest_work_key or None,
                run_id=manifest_run_id or None,
                aggregate_type="graph_call",
                aggregate_id=call_id,
                parent_aggregate_id=manifest_run_id or None,
                causation_event_id=latest_event_id,
                job_id=job_id or None,
                graph_function_id=graph_function_id or None,
                materialization_id=materialization_id or None,
                call_id=call_id,
                vector_id=vector_id or None,
            )
            emitted_count += 1
            latest_event_id = graph_call_closed.get("event_id")

        for continuation_id in _open_continuation_ids(
            stream,
            run_id=manifest_run_id or None,
            call_id=call_id or None,
        ):
            continuation_event = _event_writer(
                workspace,
                emit_event,
                "continuation_resolved",
                {
                    "continuation_id": continuation_id,
                    "call_id": call_id or None,
                    "caused_by_event_id": latest_event_id,
                },
                workflow_version=workflow_version,
                work_key=manifest_work_key or None,
                run_id=manifest_run_id or None,
                aggregate_type="continuation",
                aggregate_id=continuation_id,
                parent_aggregate_id=manifest_run_id or None,
                causation_event_id=latest_event_id,
                call_id=call_id or None,
            )
            emitted_count += 1
            latest_event_id = continuation_event.get("event_id")

        if manifest_run_id:
            _event_writer(
                workspace,
                emit_event,
                "run_completed",
                {
                    "call_id": call_id or None,
                    "edge": result_data["edge"],
                },
                workflow_version=workflow_version,
                work_key=manifest_work_key or None,
                run_id=manifest_run_id,
                aggregate_type="run",
                aggregate_id=manifest_run_id,
                causation_event_id=latest_event_id,
                job_id=job_id or None,
                graph_function_id=graph_function_id or None,
                materialization_id=materialization_id or None,
                call_id=call_id or None,
                vector_id=vector_id or None,
            )
            emitted_count += 1
    else:
        proof_event = _event_writer(
            workspace,
            emit_event,
            "proof_failed",
            {
                "call_id": call_id or None,
                "edge": result_data["edge"],
                "manifest_id": manifest_id,
                "policy_mode": proof_policy.get("mode"),
            },
            workflow_version=workflow_version,
            work_key=manifest_work_key or None,
            run_id=manifest_run_id or None,
            aggregate_type="graph_call" if call_id else ("run" if manifest_run_id else None),
            aggregate_id=call_id or (manifest_run_id or None),
            parent_aggregate_id=(manifest_run_id or None) if call_id else None,
            causation_event_id=latest_event_id,
            job_id=job_id or None,
            graph_function_id=graph_function_id or None,
            materialization_id=materialization_id or None,
            call_id=call_id or None,
            vector_id=vector_id or None,
        )
        emitted_count += 1
        latest_event_id = proof_event.get("event_id")

        if call_id and graph_call_terminal:
            graph_call_failed = _event_writer(
                workspace,
                emit_event,
                "graph_call_failed",
                {
                    "call_id": call_id,
                    "edge": result_data["edge"],
                    "failure_class": "proof_failure",
                    "manifest_id": manifest_id,
                },
                workflow_version=workflow_version,
                work_key=manifest_work_key or None,
                run_id=manifest_run_id or None,
                aggregate_type="graph_call",
                aggregate_id=call_id,
                parent_aggregate_id=manifest_run_id or None,
                causation_event_id=latest_event_id,
                job_id=job_id or None,
                graph_function_id=graph_function_id or None,
                materialization_id=materialization_id or None,
                call_id=call_id,
                vector_id=vector_id or None,
            )
            emitted_count += 1
            latest_event_id = graph_call_failed.get("event_id")

        continuation_id = f"cont-{uuid.uuid4().hex}"
        continuation_opened = _event_writer(
            workspace,
            emit_event,
            "continuation_opened",
            {
                "continuation_id": continuation_id,
                "continuation_kind": "repair",
                "call_id": call_id or None,
                "caused_by_event_id": latest_event_id,
            },
            workflow_version=workflow_version,
            work_key=manifest_work_key or None,
            run_id=manifest_run_id or None,
            aggregate_type="continuation",
            aggregate_id=continuation_id,
            parent_aggregate_id=manifest_run_id or None,
            causation_event_id=latest_event_id,
            call_id=call_id or None,
        )
        emitted_count += 1
        latest_event_id = continuation_opened.get("event_id")
        if manifest_run_id:
            _event_writer(
                workspace,
                emit_event,
                "run_failed",
                {
                    "failure_class": "proof_failure",
                    "call_id": call_id or None,
                    "edge": result_data["edge"],
                },
                workflow_version=workflow_version,
                work_key=manifest_work_key or None,
                run_id=manifest_run_id or None,
                aggregate_type="run",
                aggregate_id=manifest_run_id,
                causation_event_id=latest_event_id,
                job_id=job_id or None,
                graph_function_id=graph_function_id or None,
                materialization_id=materialization_id or None,
                call_id=call_id or None,
                vector_id=vector_id or None,
            )
            emitted_count += 1
        return {
            "status": "error",
            "result_path": str(result_file),
            "manifest_id": manifest_id,
            "spec_hash": spec_hash,
            "workflow_version": workflow_version,
            "events_emitted": emitted_count,
            "assessments": emitted,
            "failure_class": "proof_failure",
            "continuation_id": continuation_id,
        }

    return {
        "status": "ok",
        "result_path": str(result_file),
        "manifest_id": manifest_id,
        "spec_hash": spec_hash,
        "workflow_version": workflow_version,
        "events_emitted": emitted_count,
        "assessments": emitted,
    }

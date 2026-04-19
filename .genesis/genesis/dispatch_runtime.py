# Implements: REQ-R-ABG3-INTERPRET
# Implements: REQ-R-ABG3-TRANSPORT
# Implements: REQ-R-ABG3-CONTINUATION
# Implements: REQ-R-ABG3-GRAPHCALL
# Implements: REQ-R-ABG3-RUN
"""
dispatch_runtime — engine-owned F_P dispatch, transport classification, and result ingest.
"""
from __future__ import annotations

import json
import uuid
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from .events import EventContext, EventStream, emit
from .result_ingest import ingest_fp_result, validate_fp_result_payload
from .transport import (
    ArtifactObservation,
    classify_failure,
    dispatch_agent,
    dispatch_agent_supervised,
    inspect_result_artifact,
)


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _read_json(path: Path, *, label: str) -> dict[str, Any]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} is not valid JSON: {exc}") from exc
    if not isinstance(raw, Mapping):
        raise ValueError(f"{label} must contain a JSON object")
    return dict(raw)


def _normalize_agent(agent_ref: object) -> str:
    if not isinstance(agent_ref, str):
        return ""
    value = agent_ref.strip().lower()
    mapping = {
        "codex": "codex",
        "codex_cli": "codex",
        "claude": "claude",
        "claude_cli": "claude",
        "claude_code": "claude",
        "gemini": "gemini",
        "gemini_cli": "gemini",
    }
    return mapping.get(value, "")


def _dispatch_agent_id(manifest: Mapping[str, Any], config: Mapping[str, Any] | None) -> str:
    config_map = _mapping(config)
    candidates = (
        manifest.get("selected_backend"),
        manifest.get("backend_id"),
        config_map.get("runtime_backend"),
        manifest.get("selected_worker_id"),
        config_map.get("runtime_worker_id"),
    )
    for candidate in candidates:
        resolved = _normalize_agent(candidate)
        if resolved:
            return resolved
    return ""


def _event_context_for_manifest(
    manifest: Mapping[str, Any],
    *,
    aggregate_type: str,
    aggregate_id: str,
    parent_aggregate_id: str | None = None,
    causation_event_id: str | None = None,
) -> EventContext:
    return EventContext(
        workflow_version=manifest.get("workflow_version", "unknown"),
        work_key=manifest.get("work_key") if isinstance(manifest.get("work_key"), str) else None,
        run_id=manifest.get("run_id") if isinstance(manifest.get("run_id"), str) else None,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        parent_aggregate_id=parent_aggregate_id,
        causation_event_id=causation_event_id,
        correlation_id=manifest.get("manifest_id") if isinstance(manifest.get("manifest_id"), str) else None,
        job_id=manifest.get("job_id") if isinstance(manifest.get("job_id"), str) else None,
        graph_function_id=manifest.get("graph_function_id") if isinstance(manifest.get("graph_function_id"), str) else None,
        materialization_id=manifest.get("materialization_id") if isinstance(manifest.get("materialization_id"), str) else None,
        vector_id=manifest.get("vector_id") if isinstance(manifest.get("vector_id"), str) else None,
    )


def _run_failure_event_data(
    manifest: Mapping[str, Any],
    *,
    failure_class: str,
    call_id: str,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "failure_class": failure_class,
        "call_id": call_id,
    }
    for key in (
        "edge",
        "vector_id",
        "job_id",
        "worker_id",
        "role_id",
        "authority_ref",
        "selected_worker_id",
        "selected_backend",
        "backend_id",
        "assignment_source",
        "resolved_runtime_ref",
    ):
        value = manifest.get(key)
        if value is not None:
            data[key] = value
    return data


def _call_event_exists(stream: EventStream, call_id: str, event_type: str) -> bool:
    for event in stream.all_events():
        if event.get("event_type") != event_type:
            continue
        if event.get("aggregate_id") == call_id:
            return True
        if event.get("data", {}).get("call_id") == call_id:
            return True
    return False


def _ensure_graph_call_opened(
    stream: EventStream,
    manifest: Mapping[str, Any],
    *,
    call_id: str,
    run_id: str | None,
) -> None:
    if _call_event_exists(stream, call_id, "graph_call_opened"):
        return
    emit(
        "graph_call_opened",
        {
            "call_id": call_id,
            "edge": manifest.get("edge"),
            "manifest_id": manifest.get("manifest_id"),
        },
        stream=stream,
        context=_event_context_for_manifest(
            manifest,
            aggregate_type="graph_call",
            aggregate_id=call_id,
            parent_aggregate_id=run_id,
        ),
    )


def _emit_fail_closed_defect(
    stream: EventStream,
    manifest: Mapping[str, Any],
    *,
    failure_class: str,
    reason: str,
    call_id: str | None,
    run_id: str | None,
) -> dict[str, Any]:
    causation_event_id: str | None = None
    terminal_graph_call = bool(manifest.get("graph_call_terminal_on_result", True))
    if call_id and terminal_graph_call:
        _ensure_graph_call_opened(stream, manifest, call_id=call_id, run_id=run_id)
        graph_call_failed = emit(
            "graph_call_failed",
            {
                "call_id": call_id,
                "edge": manifest.get("edge"),
                "failure_class": failure_class,
                "reason": reason,
            },
            stream=stream,
            context=_event_context_for_manifest(
                manifest,
                aggregate_type="graph_call",
                aggregate_id=call_id,
                parent_aggregate_id=run_id,
            ),
        )
        causation_event_id = graph_call_failed["event_id"]
    if run_id:
        emit(
            "run_failed",
            _run_failure_event_data(
                manifest,
                failure_class=failure_class,
                call_id=call_id or "",
            ) | {"reason": reason},
            stream=stream,
            context=_event_context_for_manifest(
                manifest,
                aggregate_type="run",
                aggregate_id=run_id,
                causation_event_id=causation_event_id,
            ),
        )
    return {
        "status": "error",
        "stopped_by": "fp_runtime_failure",
        "failure_class": failure_class,
        "reason": reason,
        "call_id": call_id,
    }


def _emit_result_defect(
    result: Mapping[str, Any],
    workspace: Path,
    *,
    failure_class: str,
    reason: str,
) -> dict[str, Any]:
    stream = EventStream.open(workspace)
    run_id = result.get("run_id") if isinstance(result.get("run_id"), str) else None
    call_id = result.get("call_id") if isinstance(result.get("call_id"), str) else None
    manifest: dict[str, Any] = {
        "workflow_version": result.get("workflow_version", "unknown"),
        "work_key": result.get("work_key"),
        "run_id": run_id,
        "job_id": result.get("job_id"),
        "graph_function_id": result.get("graph_function_id"),
        "materialization_id": result.get("materialization_id"),
        "vector_id": result.get("vector_id"),
        "edge": result.get("edge"),
        "manifest_id": result.get("manifest_id"),
        "call_id": call_id,
    }
    return _emit_fail_closed_defect(
        stream,
        manifest,
        failure_class=failure_class,
        reason=reason,
        call_id=call_id,
        run_id=run_id,
    )


def _artifact_event_data(
    artifact: ArtifactObservation | None,
    *,
    result_path: str,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "result_path": result_path,
    }
    if artifact is None:
        data["artifact_status"] = "unknown"
        return data
    data["artifact_status"] = artifact.status
    if artifact.failure_class is not None:
        data["artifact_failure_class"] = artifact.failure_class
    if artifact.detail:
        data["artifact_detail"] = artifact.detail
    if artifact.size is not None:
        data["artifact_size"] = artifact.size
    if artifact.mtime_ns is not None:
        data["artifact_mtime_ns"] = artifact.mtime_ns
    return data


def _ingest_preserved_result(
    workspace: Path,
    manifest_map: Mapping[str, Any],
    *,
    result_path: str,
    emit_salvage_event: bool,
    salvage_mode: str,
) -> dict[str, Any]:
    stream = EventStream.open(workspace)
    call_id = manifest_map.get("call_id") if isinstance(manifest_map.get("call_id"), str) else None
    run_id = manifest_map.get("run_id") if isinstance(manifest_map.get("run_id"), str) else None
    if emit_salvage_event:
        emit(
            "worker_turn_salvaged",
            {
                "call_id": call_id,
                "edge": manifest_map.get("edge"),
                "result_path": result_path,
                "salvage_mode": salvage_mode,
            },
            stream=stream,
            context=_event_context_for_manifest(
                manifest_map,
                aggregate_type="graph_call",
                aggregate_id=call_id or f"call-{manifest_map.get('manifest_id')}",
                parent_aggregate_id=run_id,
            ),
        )
    ingest_summary = ingest_fp_result(
        result_path,
        workspace,
        manifest_data=manifest_map,
        active_workflow_path=(
            manifest_map.get("active_workflow")
            if isinstance(manifest_map.get("active_workflow"), str)
            else None
        ),
    )
    summary = dict(ingest_summary)
    summary["call_id"] = call_id
    summary["salvage_mode"] = salvage_mode
    return summary


def dispatch_bound_manifest_via_transport(
    manifest: Mapping[str, Any],
    workspace: Path,
    *,
    config: Mapping[str, Any] | None = None,
    hook_config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Dispatch one bound manifest through transport, classify failure, and ingest results.
    """
    manifest_map = dict(manifest)
    manifest_id = manifest_map.get("manifest_id")
    prompt = manifest_map.get("prompt")
    result_path = manifest_map.get("result_path")
    if not isinstance(manifest_id, str) or not manifest_id:
        raise ValueError("manifest must declare non-empty manifest_id")
    if not isinstance(prompt, str) or not prompt:
        raise ValueError("manifest must declare non-empty prompt")
    if not isinstance(result_path, str) or not result_path:
        raise ValueError("manifest must declare non-empty result_path")

    hook_config_map = _mapping(hook_config)
    timeout = hook_config_map.get("timeout")
    if not isinstance(timeout, int) or timeout <= 0:
        timeout = None
    dispatch_mode = hook_config_map.get("mode")
    if not isinstance(dispatch_mode, str) or not dispatch_mode:
        dispatch_mode = "supervised"

    stream = EventStream.open(workspace)
    call_id = manifest_map.get("call_id") if isinstance(manifest_map.get("call_id"), str) else f"call-{manifest_id}"
    manifest_map["call_id"] = call_id
    run_id = manifest_map.get("run_id") if isinstance(manifest_map.get("run_id"), str) else None

    agent = _dispatch_agent_id(manifest_map, config)
    if not agent:
        return _emit_fail_closed_defect(
            stream,
            manifest_map,
            failure_class="policy_config_defect",
            reason="no dispatch agent/backend could be resolved from manifest or runtime config",
            call_id=call_id,
            run_id=run_id,
        )

    _ensure_graph_call_opened(stream, manifest_map, call_id=call_id, run_id=run_id)
    call_context = _event_context_for_manifest(
        manifest_map,
        aggregate_type="graph_call",
        aggregate_id=call_id,
        parent_aggregate_id=run_id,
    )
    emit(
        "worker_turn_started",
        {
            "call_id": call_id,
            "edge": manifest_map.get("edge"),
            "agent": agent,
            "manifest_id": manifest_id,
            "dispatch_mode": dispatch_mode,
        },
        stream=stream,
        context=call_context,
    )

    def _progress_callback(data: dict[str, Any]) -> None:
        event_type = str(data.get("event_type") or "").strip()
        if not event_type:
            return
        payload = {
            "call_id": call_id,
            "edge": manifest_map.get("edge"),
            "agent": agent,
        }
        payload.update({key: value for key, value in data.items() if key != "event_type"})
        emit(
            event_type,
            payload,
            stream=stream,
            context=call_context,
        )

    if dispatch_mode == "raw":
        result = dispatch_agent(
            prompt,
            str(workspace),
            agent=agent,
            timeout=timeout or 300,
            config=config,
        )
    else:
        result = dispatch_agent_supervised(
            prompt,
            str(workspace),
            agent=agent,
            timeout=timeout or 300,
            config=config,
            result_path=result_path,
            payload_validator=validate_fp_result_payload,
            manifest=manifest_map,
            progress_callback=_progress_callback,
        )
    failure_class = classify_failure(
        result,
        result_path,
        payload_validator=validate_fp_result_payload,
        manifest=manifest_map,
    )
    artifact = inspect_result_artifact(
        result_path,
        payload_validator=validate_fp_result_payload,
        manifest=manifest_map,
    )
    if failure_class is None and artifact.valid and (result.timed_out or result.returncode != 0):
        return _ingest_preserved_result(
            workspace,
            manifest_map,
            result_path=result_path,
            emit_salvage_event=True,
            salvage_mode="transport_failure_preserved_artifact",
        )

    if failure_class is not None:
        diagnostic_output = result.stderr[:500] if result.stderr.strip() else result.stdout[:500]
        worker_failed = emit(
            "worker_turn_failed",
            {
                "call_id": call_id,
                "edge": manifest_map.get("edge"),
                "agent": agent,
                "failure_class": failure_class,
                "returncode": result.returncode,
                "timed_out": result.timed_out,
                "stderr": diagnostic_output,
                "dispatch_mode": dispatch_mode,
                "supervision_mode": result.supervision_mode,
                **_artifact_event_data(artifact, result_path=result_path),
            },
            stream=stream,
            context=call_context,
        )
        graph_call_failed = emit(
            "graph_call_failed",
            {
                "call_id": call_id,
                "edge": manifest_map.get("edge"),
                "failure_class": failure_class,
                "caused_by_event_id": worker_failed["event_id"],
            },
            stream=stream,
            context=_event_context_for_manifest(
                manifest_map,
                aggregate_type="graph_call",
                aggregate_id=call_id,
                parent_aggregate_id=run_id,
                causation_event_id=worker_failed["event_id"],
            ),
        )
        continuation_id = f"cont-{uuid.uuid4().hex}"
        emit(
            "continuation_opened",
            {
                "continuation_id": continuation_id,
                "continuation_kind": "retry",
                "call_id": call_id,
                "caused_by_event_id": graph_call_failed["event_id"],
                "recovery_state": artifact.status if artifact is not None else "missing_artifact",
            },
            stream=stream,
            context=_event_context_for_manifest(
                manifest_map,
                aggregate_type="continuation",
                aggregate_id=continuation_id,
                parent_aggregate_id=run_id,
                causation_event_id=graph_call_failed["event_id"],
            ),
        )
        if run_id:
            emit(
                "run_failed",
                _run_failure_event_data(
                    manifest_map,
                    failure_class=failure_class,
                    call_id=call_id,
                ),
                stream=stream,
                context=_event_context_for_manifest(
                    manifest_map,
                    aggregate_type="run",
                    aggregate_id=run_id,
                    causation_event_id=graph_call_failed["event_id"],
                ),
            )
        return {
            "status": "error",
            "stopped_by": "fp_runtime_failure",
            "failure_class": failure_class,
            "call_id": call_id,
            "continuation_id": continuation_id,
        }

    emit(
        "worker_turn_succeeded",
        {
            "call_id": call_id,
            "edge": manifest_map.get("edge"),
            "agent": agent,
            "returncode": result.returncode,
            "dispatch_mode": dispatch_mode,
            "supervision_mode": result.supervision_mode,
            "artifact_observed_live": result.artifact_observed_live,
            "salvaged_from_artifact": result.salvaged_from_artifact,
        },
        stream=stream,
        context=call_context,
    )
    ingest_summary = ingest_fp_result(
        result_path,
        workspace,
        manifest_data=manifest_map,
        active_workflow_path=(
            config.get("active_workflow")
            if isinstance(config, Mapping) and isinstance(config.get("active_workflow"), str)
            else None
        ),
    )
    summary = dict(ingest_summary)
    summary.update(
        {
            "call_id": call_id,
            "agent": agent,
        }
    )
    return summary


def dispatch_bound_manifest_via_supervised_transport(
    manifest: Mapping[str, Any],
    workspace: Path,
    *,
    config: Mapping[str, Any] | None = None,
    hook_config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Published supervised dispatch capability over the standard transport boundary."""
    merged_hook_config = dict(_mapping(hook_config))
    merged_hook_config["mode"] = "supervised"
    return dispatch_bound_manifest_via_transport(
        manifest,
        workspace,
        config=config,
        hook_config=merged_hook_config,
    )


def auto_dispatch_from_result(
    result: Mapping[str, Any],
    workspace: Path,
    *,
    config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Resolve the dispatch policy for one pending F_P manifest and execute it.
    """
    manifest_path_value = result.get("fp_manifest_path")
    manifest_path: Path | None = None
    if isinstance(manifest_path_value, str) and manifest_path_value:
        manifest_path = Path(manifest_path_value)
    else:
        manifest_id = result.get("manifest_id")
        if isinstance(manifest_id, str) and manifest_id:
            manifest_path = workspace / ".ai-workspace" / "fp_manifests" / f"{manifest_id}.json"
    if manifest_path is None:
        return _emit_result_defect(
            result,
            workspace,
            failure_class="policy_config_defect",
            reason="pending F_P result is missing fp_manifest_path",
        )
    if not manifest_path.exists():
        return _emit_result_defect(
            result,
            workspace,
            failure_class="policy_config_defect",
            reason=f"manifest does not exist: {manifest_path}",
        )

    manifest = _read_json(manifest_path, label=f"manifest file {manifest_path}")
    manifest_result_path = manifest.get("result_path")
    if isinstance(manifest_result_path, str) and manifest_result_path:
        artifact = inspect_result_artifact(
            manifest_result_path,
            payload_validator=validate_fp_result_payload,
            manifest=manifest,
        )
        if artifact.valid:
            return _ingest_preserved_result(
                workspace,
                manifest,
                result_path=manifest_result_path,
                emit_salvage_event=True,
                salvage_mode="idempotent_reentry",
            )
    resolved_policy = manifest.get("resolved_policy")
    if not isinstance(resolved_policy, Mapping):
        from .policy import resolve_policy_bundle

        resolved_policy = resolve_policy_bundle(runtime_config=config)
    dispatch_policy = resolved_policy.get("dispatch")
    if not isinstance(dispatch_policy, Mapping):
        return _emit_fail_closed_defect(
            EventStream.open(workspace),
            manifest,
            failure_class="policy_config_defect",
            reason="resolved policy is missing dispatch concern",
            call_id=manifest.get("call_id") if isinstance(manifest.get("call_id"), str) else None,
            run_id=manifest.get("run_id") if isinstance(manifest.get("run_id"), str) else None,
        )

    dispatch_ref = dispatch_policy.get("ref")
    if not isinstance(dispatch_ref, str) or not dispatch_ref:
        return _emit_fail_closed_defect(
            EventStream.open(workspace),
            manifest,
            failure_class="policy_config_defect",
            reason="dispatch policy must declare a non-empty ref",
            call_id=manifest.get("call_id") if isinstance(manifest.get("call_id"), str) else None,
            run_id=manifest.get("run_id") if isinstance(manifest.get("run_id"), str) else None,
        )

    from .policy import _import_ref  # local import to avoid cycle at module import time

    dispatch_fn = _import_ref(dispatch_ref)
    if not callable(dispatch_fn):
        return _emit_fail_closed_defect(
            EventStream.open(workspace),
            manifest,
            failure_class="policy_config_defect",
            reason=f"dispatch ref {dispatch_ref!r} did not resolve to a callable",
            call_id=manifest.get("call_id") if isinstance(manifest.get("call_id"), str) else None,
            run_id=manifest.get("run_id") if isinstance(manifest.get("run_id"), str) else None,
        )
    return dispatch_fn(
        manifest,
        workspace,
        config=config,
        hook_config=dispatch_policy.get("config"),
    )

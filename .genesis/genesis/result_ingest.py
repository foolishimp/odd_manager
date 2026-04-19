# Implements: REQ-R-ABG3-INTERPRET
# Implements: REQ-R-ABG3-EVENTS
# Implements: REQ-R-ABG3-PROVENANCE
"""
result_ingest — engine-owned F_P result ingestion and assessed-event emission.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

from gtl.obligation_ledger import (
    coerce_obligation_ledger_declaration,
    validate_declared_fulfillment_obligations,
)

from .events import EventContext, EventStream, emit
from .continuation import continuation_state
from .fulfillment_ledger import (
    make_published_fulfillment_ledger_ref,
    published_fulfillment_edge_converged,
    published_fulfillment_ledger_path,
    resolve_published_fulfillment_ledger,
    write_published_fulfillment_ledger,
)
from .policy import materialize_policy_concern, resolve_policy_bundle
from .provenance import _read_workflow_version


FULFILLMENT_STATUSES = frozenset({"fulfilled", "partial", "blocked", "unfulfilled"})


def _string_list(value: Any, *, field: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError(f"{field} must be a list of strings")
    items: list[str] = []
    for entry in value:
        if not isinstance(entry, str) or not entry.strip():
            raise ValueError(f"{field} entries must be non-empty strings")
        items.append(entry)
    return items


def expected_fulfillment_obligations(manifest: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    manifest_map = dict(manifest) if isinstance(manifest, Mapping) else {}
    raw_declared = manifest_map.get("fulfillment_obligations")
    declared: list[dict[str, Any]] = []
    if raw_declared is None:
        return declared
    if not isinstance(raw_declared, list):
        raise ValueError("fulfillment_obligations must be a list")
    for index, entry in enumerate(raw_declared):
        if not isinstance(entry, Mapping):
            raise ValueError(f"fulfillment_obligations[{index}] must be an object")
        obligation_id = entry.get("id")
        if not isinstance(obligation_id, str) or not obligation_id.strip():
            raise ValueError(f"fulfillment_obligations[{index}].id must be a non-empty string")
        evaluator = entry.get("evaluator")
        statement = entry.get("statement")
        declared.append(
            {
                "id": obligation_id,
                "evaluator": evaluator if isinstance(evaluator, str) and evaluator.strip() else obligation_id,
                "statement": statement if isinstance(statement, str) else "",
                "source_refs": _string_list(entry.get("source_refs"), field=f"fulfillment_obligations[{index}].source_refs"),
                "source_kind": (
                    entry.get("source_kind")
                    if isinstance(entry.get("source_kind"), str) and entry.get("source_kind").strip()
                    else "manifest_fulfillment_obligations"
                ),
            }
        )
    validate_declared_fulfillment_obligations(
        declared,
        field="fulfillment_obligations",
    )
    return declared


def expected_obligation_ledger_policy(manifest: Mapping[str, Any] | None) -> dict[str, Any] | None:
    manifest_map = dict(manifest) if isinstance(manifest, Mapping) else {}
    raw_policy = manifest_map.get("obligation_ledger_policy")
    if raw_policy is None:
        return None
    return coerce_obligation_ledger_declaration(raw_policy)


def normalize_fp_result_payload(payload: Any) -> dict[str, Any]:
    """Normalize legacy evaluator assessments into typed fulfillment entries."""
    if not isinstance(payload, Mapping):
        raise ValueError("payload must be an object")
    edge = payload.get("edge")
    actor = payload.get("actor")
    if not isinstance(edge, str) or not edge.strip():
        raise ValueError("edge must be a non-empty string")
    if not isinstance(actor, str) or not actor.strip():
        raise ValueError("actor must be a non-empty string")

    raw_fulfillment = payload.get("fulfillment_assessments")
    if raw_fulfillment is None:
        raise ValueError("payload must include fulfillment_assessments")
    raw_entries = raw_fulfillment
    if not isinstance(raw_entries, list) or not raw_entries:
        raise ValueError("fulfillment_assessments must be a non-empty list")

    normalized_entries: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, entry in enumerate(raw_entries):
        if not isinstance(entry, Mapping):
            raise ValueError(f"fulfillment_assessments[{index}] must be an object")
        obligation_id = entry.get("id")
        status = entry.get("fulfillment_status")
        if not isinstance(obligation_id, str) or not obligation_id.strip():
            raise ValueError(f"fulfillment_assessments[{index}].id must be a non-empty string")
        if status not in FULFILLMENT_STATUSES:
            raise ValueError(
                f"fulfillment_assessments[{index}].fulfillment_status must be one of "
                f"{sorted(FULFILLMENT_STATUSES)}"
            )
        detail = entry.get("fulfillment_detail", "")
        if detail is None:
            detail = ""
        if not isinstance(detail, str):
            raise ValueError(f"fulfillment_assessments[{index}].fulfillment_detail must be a string")
        evaluator = entry.get("evaluator")
        normalized_entry = {
            "id": obligation_id,
            "evaluator": evaluator if isinstance(evaluator, str) and evaluator.strip() else obligation_id,
            "fulfillment_status": status,
            "fulfillment_detail": detail,
            "blocking_reasons": _string_list(
                entry.get("blocking_reasons"),
                field=f"fulfillment_assessments[{index}].blocking_reasons",
            ),
            "evidence_refs": _string_list(
                entry.get("evidence_refs"),
                field=f"fulfillment_assessments[{index}].evidence_refs",
            ),
        }

        if normalized_entry["id"] in seen_ids:
            raise ValueError(f"duplicate fulfillment assessment id: {normalized_entry['id']}")
        seen_ids.add(normalized_entry["id"])
        normalized_entries.append(normalized_entry)

    normalized_payload = dict(payload)
    normalized_payload["edge"] = edge
    normalized_payload["actor"] = actor
    normalized_payload["fulfillment_assessments"] = normalized_entries
    return normalized_payload


def fulfillment_assessment_identity_issues(
    payload: Mapping[str, Any],
    manifest: Mapping[str, Any] | None,
) -> list[str]:
    try:
        expected = expected_fulfillment_obligations(manifest)
    except ValueError as exc:
        return [str(exc)]
    observed_entries = payload.get("fulfillment_assessments")
    if not isinstance(observed_entries, list):
        return ["fulfillment_assessments missing from payload"]
    if not expected:
        return ["manifest missing fulfillment_obligations"]
    observed_ids = [
        entry.get("id")
        for entry in observed_entries
        if isinstance(entry, Mapping) and isinstance(entry.get("id"), str)
    ]
    expected_ids = [entry["id"] for entry in expected]
    missing = sorted(set(expected_ids) - set(observed_ids))
    extra = sorted(set(observed_ids) - set(expected_ids))
    issues: list[str] = []
    if missing:
        issues.append(f"missing declared fulfillment assessments: {', '.join(missing)}")
    if extra:
        issues.append(f"unexpected fulfillment assessments: {', '.join(extra)}")
    return issues


def validate_fp_result_payload(payload: Any) -> bool:
    """Return True when the payload satisfies the F_P result contract."""
    try:
        normalize_fp_result_payload(payload)
    except ValueError:
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


def _carried_forward_fh_admission(
    all_events: list[dict[str, Any]],
    *,
    edge: str,
    current_workflow_version: str,
    carry_forward: list[dict[str, Any]],
    work_key: str | None,
) -> dict[str, Any]:
    latest_approved: dict[str, Any] | None = None
    latest_approved_time = ""
    for event in all_events:
        if event.get("event_type") != "approved":
            continue
        data = event.get("data", {})
        if data.get("kind") not in ("fh_review", "fh_intent"):
            continue
        if data.get("edge") != edge:
            continue
        event_work_key = data.get("work_key")
        if work_key is not None and event_work_key != work_key:
            continue
        if work_key is None and event_work_key is not None:
            continue
        event_workflow_version = data.get("workflow_version")
        if not isinstance(event_workflow_version, str) or not event_workflow_version or event_workflow_version == current_workflow_version:
            continue
        matched_carry = False
        for carry in carry_forward:
            if (
                isinstance(carry, Mapping)
                and carry.get("edge") == edge
                and carry.get("from_version") == event_workflow_version
                and carry.get("work_key", None) == (work_key or None)
            ):
                matched_carry = True
                break
        if not matched_carry:
            continue
        event_time = event.get("event_time", "")
        if event_time > latest_approved_time:
            latest_approved = event
            latest_approved_time = event_time
    if latest_approved is None:
        return {"admitted": False, "admission_basis": "pending_fh_review"}
    return {
        "admitted": True,
        "admission_basis": f"approved_{latest_approved.get('data', {}).get('kind', 'fh_review')}",
    }


def _write_published_fulfillment_ledger(
    workspace: Path,
    manifest_id: str,
    ledger: Mapping[str, Any],
) -> dict[str, str]:
    path = published_fulfillment_ledger_path(workspace, manifest_id)
    write_published_fulfillment_ledger(path, ledger)
    return make_published_fulfillment_ledger_ref(manifest_id=manifest_id)


def _build_published_fulfillment_ledger(
    *,
    manifest: Mapping[str, Any],
    manifest_id: str,
    result_data: Mapping[str, Any],
    spec_hash: str,
    workflow_version: str,
) -> dict[str, Any]:
    obligations = expected_fulfillment_obligations(manifest)
    declared_policy = expected_obligation_ledger_policy(manifest)
    if not obligations:
        raise ValueError("manifest missing fulfillment_obligations")
    assessments = result_data.get("fulfillment_assessments")
    if not isinstance(assessments, list):
        raise ValueError("normalized result payload missing fulfillment_assessments")
    assessments_by_id = {
        entry["id"]: dict(entry)
        for entry in assessments
        if isinstance(entry, Mapping) and isinstance(entry.get("id"), str)
    }

    missing_count = max(0, len(obligations) - len(assessments_by_id))
    extra_count = max(0, len(assessments_by_id) - len(obligations))
    blocking_reasons: list[str] = []
    obligation_rows: list[dict[str, Any]] = []
    fulfilled_count = 0
    partial_count = 0
    blocked_count = 0
    unfulfilled_count = 0
    for obligation in obligations:
        obligation_id = obligation["id"]
        assessment = assessments_by_id.get(obligation_id)
        if assessment is None:
            reasons = ["missing fulfillment assessment"]
            blocking_reasons.extend(reason for reason in reasons if reason not in blocking_reasons)
            obligation_rows.append(
                {
                    "id": obligation_id,
                    "evaluator": obligation.get("evaluator", obligation_id),
                    "statement": obligation.get("statement", ""),
                    "source_refs": list(obligation.get("source_refs", [])),
                    "source_kind": obligation.get("source_kind", "manifest_fulfillment_obligations"),
                    "assessment_present": False,
                    "fulfillment_status": "unfulfilled",
                    "fulfillment_detail": "missing fulfillment assessment",
                    "blocking_reasons": reasons,
                    "evidence_refs": [],
                }
            )
            unfulfilled_count += 1
            continue
        status = assessment["fulfillment_status"]
        if status == "fulfilled":
            fulfilled_count += 1
        elif status == "partial":
            partial_count += 1
        elif status == "blocked":
            blocked_count += 1
        else:
            unfulfilled_count += 1
        reasons = list(assessment.get("blocking_reasons", []))
        blocking_reasons.extend(reason for reason in reasons if reason not in blocking_reasons)
        obligation_rows.append(
            {
                "id": obligation_id,
                "evaluator": obligation.get("evaluator", obligation_id),
                "statement": obligation.get("statement", ""),
                "source_refs": list(obligation.get("source_refs", [])),
                "source_kind": obligation.get("source_kind", "manifest_fulfillment_obligations"),
                "assessment_present": True,
                "fulfillment_status": status,
                "fulfillment_detail": assessment.get("fulfillment_detail", ""),
                "blocking_reasons": reasons,
                "evidence_refs": list(assessment.get("evidence_refs", [])),
            }
        )

    admission_required = bool(manifest.get("fulfillment_admission_required"))
    admitted = not admission_required
    target_asset = manifest.get("target_asset")
    if not isinstance(target_asset, str) or not target_asset.strip():
        edge_name = str(result_data.get("edge") or "")
        target_asset = edge_name.split("→", 1)[1].strip() if "→" in edge_name else ""
    carry_converged = missing_count == 0 and extra_count == 0
    fulfillment_converged = (
        len(obligation_rows) > 0
        and fulfilled_count == len(obligation_rows)
        and partial_count == 0
        and blocked_count == 0
        and unfulfilled_count == 0
    )
    if not obligation_rows:
        fulfillment_converged = False

    obligation_source_kind = (
        declared_policy["obligation_source_kind"]
        if declared_policy is not None
        else "manifest_fulfillment_obligations"
    )
    obligation_source_ref = (
        declared_policy["obligation_source_ref"]
        if declared_policy is not None
        else f"manifest://{manifest_id}#fulfillment_obligations"
    )
    obligation_kind = (
        declared_policy["obligation_kind"]
        if declared_policy is not None
        else "fulfillment_obligation"
    )
    declaration_family = (
        declared_policy["declaration_family"]
        if declared_policy is not None
        else "static_obligations"
    )
    certification_scope = (
        declared_policy["certification_scope"]
        if declared_policy is not None
        else "per_obligation"
    )
    carry_rule = (
        declared_policy["carry_rule"]
        if declared_policy is not None
        else "declared_fulfillment_obligation_set_totality"
    )
    fulfillment_rule = (
        declared_policy["fulfillment_rule"]
        if declared_policy is not None
        else "per_obligation_fp_assessment"
    )
    evidence_policy = (
        declared_policy["evidence_policy"]
        if declared_policy is not None
        else "agent_supplied_evidence_refs"
    )
    obligation_source_admission_basis = (
        declared_policy["obligation_source_admission_basis"]
        if declared_policy is not None
        else "manifest"
    )
    derivation_rule = (
        declared_policy["derivation_rule"]
        if declared_policy is not None
        else "identity"
    )
    adapter_ref = (
        declared_policy.get("adapter_ref")
        if declared_policy is not None
        else None
    )
    signal_key = (
        declared_policy.get("signal_key")
        if declared_policy is not None
        else None
    )

    result = {
        "manifest_id": manifest_id,
        "edge": result_data["edge"],
        "actor": result_data["actor"],
        "spec_hash": spec_hash,
        "workflow_version": workflow_version,
        "graph_call_terminal_on_result": bool(manifest.get("graph_call_terminal_on_result", True)),
        "target_asset": target_asset,
        "declaration_family": declaration_family,
        "obligation_source_kind": obligation_source_kind,
        "obligation_source_ref": obligation_source_ref,
        "obligation_source_admission_basis": obligation_source_admission_basis,
        "obligation_kind": obligation_kind,
        "derivation_rule": derivation_rule,
        "certification_scope": certification_scope,
        "carry_rule": carry_rule,
        "fulfillment_rule": fulfillment_rule,
        "evidence_policy": evidence_policy,
        "admission_required": admission_required,
        "admitted": admitted,
        "admission_basis": "auto_no_fh_gate" if admitted else "pending_fh_review",
        "expected_count": len(obligations),
        "fulfilled_count": fulfilled_count,
        "partial_count": partial_count,
        "blocked_count": blocked_count,
        "unfulfilled_count": unfulfilled_count,
        "missing_count": missing_count,
        "extra_count": extra_count,
        "carry_converged": carry_converged,
        "fulfillment_converged": fulfillment_converged,
        "blocking_reasons": blocking_reasons,
        "obligations": obligation_rows,
    }
    result["edge_converged"] = published_fulfillment_edge_converged(result)
    if isinstance(adapter_ref, str) and adapter_ref:
        result["adapter_ref"] = adapter_ref
    if isinstance(signal_key, str) and signal_key:
        result["signal_key"] = signal_key
    return result


def _target_binding_materialization(workspace: Path, manifest: Mapping[str, Any]) -> dict[str, Any]:
    binding = manifest.get("target_asset_binding")
    if not isinstance(binding, Mapping):
        return {"passed": True, "reason": "no_target_binding"}
    relative_path = binding.get("relative_path")
    if not isinstance(relative_path, str) or not relative_path.strip():
        return {"passed": True, "reason": "no_relative_target_binding"}
    materialized_path = workspace / relative_path
    if materialized_path.exists():
        return {
            "passed": True,
            "reason": "target_binding_materialized",
            "relative_path": relative_path,
        }
    return {
        "passed": False,
        "reason": "target_binding_not_materialized",
        "relative_path": relative_path,
    }


def _target_certification_hook_spec(
    closure_policy: Mapping[str, Any],
) -> tuple[str | None, dict[str, Any]]:
    config = closure_policy.get("config")
    config_map = dict(config) if isinstance(config, Mapping) else {}
    hook_ref = config_map.get("target_certification_ref")
    if not isinstance(hook_ref, str) or not hook_ref.strip():
        hook_ref = closure_policy.get("target_certification_ref")
    if not isinstance(hook_ref, str) or not hook_ref.strip():
        return None, config_map
    hook_config = config_map.get("target_certification_config")
    if not isinstance(hook_config, Mapping):
        hook_config = {}
    return hook_ref, dict(hook_config)


def _normalize_target_certification_result(value: Any) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError("target certification hook must return an object")
    passed = value.get("passed")
    reason = value.get("reason")
    if not isinstance(passed, bool):
        raise ValueError("target certification hook result must provide boolean 'passed'")
    if not isinstance(reason, str) or not reason.strip():
        raise ValueError("target certification hook result must provide non-empty 'reason'")
    normalized = {
        "passed": passed,
        "reason": reason,
    }
    relative_path = value.get("relative_path")
    if isinstance(relative_path, str) and relative_path.strip():
        normalized["relative_path"] = relative_path
    details = value.get("details")
    if details is not None:
        normalized["details"] = details
    return normalized


def _target_asset_certification(
    workspace: Path,
    manifest: Mapping[str, Any],
    *,
    result_data: Mapping[str, Any],
    closure_policy: Mapping[str, Any],
    published_ledger: Mapping[str, Any],
) -> dict[str, Any]:
    materialization = _target_binding_materialization(workspace, manifest)
    decision: dict[str, Any] = {
        "materialization_passed": bool(materialization.get("passed")),
        "materialization_reason": str(materialization.get("reason") or "unknown"),
        "source": "target_binding_materialization",
    }
    if isinstance(materialization.get("relative_path"), str):
        decision["relative_path"] = materialization["relative_path"]

    hook_ref, hook_config = _target_certification_hook_spec(closure_policy)
    if not bool(materialization.get("passed")):
        decision["passed"] = False
        decision["reason"] = str(materialization.get("reason") or "target_binding_not_materialized")
        if hook_ref is not None:
            decision["hook_ref"] = hook_ref
        return decision

    if hook_ref is None:
        decision["passed"] = True
        decision["reason"] = str(materialization.get("reason") or "target_binding_materialized")
        return decision

    decision["source"] = "target_certification_hook"
    decision["hook_ref"] = hook_ref
    try:
        from .policy import _import_ref

        hook = _import_ref(hook_ref)
        hook_result = hook(
            workspace=workspace,
            manifest=dict(manifest),
            result_data=dict(result_data),
            published_ledger=dict(published_ledger),
            config=hook_config,
        )
        normalized = _normalize_target_certification_result(hook_result)
    except Exception as exc:
        decision["passed"] = False
        decision["reason"] = "target_certification_hook_error"
        decision["details"] = {"error": str(exc)}
        return decision

    decision["passed"] = normalized["passed"]
    decision["reason"] = normalized["reason"]
    if "details" in normalized:
        decision["details"] = normalized["details"]
    if "relative_path" in normalized and "relative_path" not in decision:
        decision["relative_path"] = normalized["relative_path"]
    return decision


def _fd_recheck_should_yield(decision: Mapping[str, Any]) -> bool:
    failures = decision.get("failures")
    if not isinstance(failures, list) or not failures:
        return False
    for failure in failures:
        if not isinstance(failure, Mapping):
            return False
        reason = failure.get("reason")
        if reason != "fd_still_failing":
            return False
    return True


def _rerun_manifest_fd_failures(
    workspace: Path,
    manifest: Mapping[str, Any],
    *,
    work_key: str | None,
) -> dict[str, Any]:
    raw_failures = manifest.get("fd_failures")
    if not isinstance(raw_failures, list) or not raw_failures:
        return {"passed": True, "failures": []}

    env = os.environ.copy()
    extra = os.pathsep.join(p for p in sys.path if p)
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = os.pathsep.join(filter(None, [extra, existing]))
    if work_key:
        env["WORK_KEY"] = work_key

    unresolved: list[dict[str, Any]] = []
    for entry in raw_failures:
        if not isinstance(entry, Mapping):
            continue
        name = str(entry.get("name") or "").strip() or "unknown_fd"
        shell_command = str(entry.get("binding") or "").strip()
        if shell_command.startswith("exec://"):
            shell_command = shell_command[len("exec://"):]
        if not shell_command:
            unresolved.append({"name": name, "reason": "missing_binding"})
            continue
        try:
            result = subprocess.run(
                shell_command,
                shell=True,
                cwd=workspace,
                capture_output=True,
                text=True,
                env=env,
                timeout=60,
            )
        except subprocess.TimeoutExpired:
            unresolved.append({"name": name, "reason": "timeout"})
            continue
        if result.returncode != 0:
            unresolved.append(
                {
                    "name": name,
                    "reason": "fd_still_failing",
                    "returncode": result.returncode,
                    "stdout": result.stdout[-1000:],
                    "stderr": result.stderr[-500:],
                }
            )
    return {"passed": not unresolved, "failures": unresolved}


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


def _resolve_open_continuations(
    workspace: Path,
    emit_event: Callable[..., Any] | None,
    *,
    stream: EventStream,
    workflow_version: str,
    work_key: str | None,
    run_id: str | None,
    call_id: str | None,
    latest_event_id: str | None,
    emitted_count: int,
) -> tuple[int, str | None]:
    for continuation_id in _open_continuation_ids(
        stream,
        run_id=run_id,
        call_id=call_id,
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
            work_key=work_key,
            run_id=run_id,
            aggregate_type="continuation",
            aggregate_id=continuation_id,
            parent_aggregate_id=run_id,
            causation_event_id=latest_event_id,
            call_id=call_id or None,
        )
        emitted_count += 1
        latest_event_id = continuation_event.get("event_id")
    return emitted_count, latest_event_id


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
    raw_result_data = _read_json(result_file, label=f"result file {result_file}")
    try:
        result_data = normalize_fp_result_payload(raw_result_data)
    except ValueError as exc:
        raise ValueError(f"result file does not satisfy the F_P result contract: {exc}") from exc

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
    identity_issues = fulfillment_assessment_identity_issues(result_data, manifest)
    if identity_issues:
        raise ValueError("; ".join(identity_issues))

    manifest_run_id = manifest.get("run_id") if isinstance(manifest.get("run_id"), str) else ""
    manifest_work_key = manifest.get("work_key") if isinstance(manifest.get("work_key"), str) else ""
    call_id = manifest.get("call_id") if isinstance(manifest.get("call_id"), str) and manifest.get("call_id") else ""
    graph_call_terminal = bool(manifest.get("graph_call_terminal_on_result", True))
    workflow_version = _read_provenance(manifest.get("workflow_version"))
    if not workflow_version:
        workflow_version = _read_workflow_version(workspace, active_workflow_path)
    if not workflow_version:
        raise ValueError("workflow_version provenance missing from manifest and active workflow metadata")
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
    emitted: list[dict[str, Any]] = []
    emitted_count = 0
    latest_event_id: str | None = None
    latest_assessed_context: dict[str, Any] | None = None
    obligation_map = {
        entry["id"]: entry
        for entry in expected_fulfillment_obligations(manifest)
    }
    published_ledger = _build_published_fulfillment_ledger(
        manifest=manifest,
        manifest_id=manifest_id,
        result_data=result_data,
        spec_hash=spec_hash,
        workflow_version=workflow_version,
    )
    carry_forward = manifest.get("approved_carry_forward")
    if not isinstance(carry_forward, list):
        carry_forward = []
    if bool(published_ledger.get("admission_required")) and carry_forward:
        carry_forward_admission = _carried_forward_fh_admission(
            stream.all_events(),
            edge=result_data["edge"],
            current_workflow_version=workflow_version,
            carry_forward=carry_forward,
            work_key=manifest_work_key or None,
        )
        if carry_forward_admission["admitted"]:
            published_ledger["admitted"] = True
            published_ledger["admission_basis"] = carry_forward_admission["admission_basis"]
    target_certification = _target_asset_certification(
        workspace,
        manifest,
        result_data=result_data,
        closure_policy=closure_policy,
        published_ledger=published_ledger,
    )
    published_ledger["target_materialization_passed"] = bool(
        target_certification.get("materialization_passed")
    )
    published_ledger["target_materialization_reason"] = str(
        target_certification.get("materialization_reason") or "unknown"
    )
    published_ledger["target_certification_passed"] = bool(target_certification.get("passed"))
    published_ledger["target_certification_reason"] = str(
        target_certification.get("reason") or "target_certification_unknown"
    )
    published_ledger["target_certification_source"] = str(
        target_certification.get("source") or "target_binding_materialization"
    )
    if isinstance(target_certification.get("relative_path"), str):
        published_ledger["target_relative_path"] = target_certification["relative_path"]
    if isinstance(target_certification.get("hook_ref"), str):
        published_ledger["target_certification_hook_ref"] = target_certification["hook_ref"]
    if "details" in target_certification:
        published_ledger["target_certification_details"] = target_certification["details"]
    published_ledger["edge_converged"] = published_fulfillment_edge_converged(published_ledger)
    published_ledger_ref = _write_published_fulfillment_ledger(
        workspace,
        manifest_id,
        published_ledger,
    )
    resolved_published_ledger = resolve_published_fulfillment_ledger(
        stream.all_events(),
        workspace=workspace,
        ledger_ref=published_ledger_ref,
        edge=result_data["edge"],
        work_key=manifest_work_key or None,
        spec_hash=spec_hash,
        current_workflow_version=workflow_version,
    )
    if resolved_published_ledger is None:
        raise ValueError("published fulfillment ledger could not be resolved")
    for assessment in result_data["fulfillment_assessments"]:
        obligation_id = assessment["id"]
        obligation = obligation_map.get(
            obligation_id,
            {"id": obligation_id, "evaluator": obligation_id, "statement": "", "source_refs": []},
        )
        evidence_refs = list(assessment.get("evidence_refs", []))
        event_data: dict[str, Any] = {
            "kind": "fp",
            "edge": result_data["edge"],
            "obligation_id": obligation_id,
            "published_ledger_ref": dict(published_ledger_ref),
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
        latest_assessed_context = {
            "event_id": latest_event_id,
            "workflow_version": workflow_version,
            "work_key": manifest_work_key or None,
            "run_id": manifest_run_id or None,
            "job_id": job_id or None,
            "graph_function_id": graph_function_id or None,
            "materialization_id": materialization_id or None,
            "call_id": call_id or None,
            "vector_id": vector_id or None,
            "data": dict(event_data),
        }
        emitted_count += 1
        emitted.append(
            {
                "id": obligation_id,
                "fulfillment_status": assessment["fulfillment_status"],
                "fulfillment_detail": assessment.get("fulfillment_detail", ""),
                "blocking_reasons": list(assessment.get("blocking_reasons", [])),
                "evidence_refs": evidence_refs,
            }
        )

    carry_converged = bool(resolved_published_ledger["carry_converged"])
    fulfillment_converged = bool(resolved_published_ledger["fulfillment_converged"])
    admitted = bool(resolved_published_ledger.get("admitted"))
    target_certification_passed = bool(
        resolved_published_ledger.get("target_certification_passed", True)
    )
    edge_converged = bool(resolved_published_ledger.get("edge_converged"))
    admission_pending = carry_converged and fulfillment_converged and not admitted
    certification_failed = (
        carry_converged
        and fulfillment_converged
        and admitted
        and not target_certification_passed
    )
    proof_passed = edge_converged
    if proof_passed:
        from .fulfillment_followups import _emit_success_lifecycle

        assessed_context = latest_assessed_context or {
            "event_id": latest_event_id,
            "workflow_version": workflow_version,
            "work_key": manifest_work_key or None,
            "run_id": manifest_run_id or None,
            "job_id": job_id or None,
            "graph_function_id": graph_function_id or None,
            "materialization_id": materialization_id or None,
            "call_id": call_id or None,
            "vector_id": vector_id or None,
            "data": {
                "kind": "fp",
                "edge": result_data["edge"],
                "manifest_id": manifest_id,
                "workflow_version": workflow_version,
                "spec_hash": spec_hash,
                "published_ledger_ref": dict(published_ledger_ref),
            },
        }
        events_before = len(stream.all_events())
        _emit_success_lifecycle(
            stream,
            assessed_event=assessed_context,
            ledger_data=resolved_published_ledger,
            latest_event_id=latest_event_id,
            emit_event=emit_event,
        )
        emitted_count += len(stream.all_events()) - events_before
    else:
        proof_event = _event_writer(
            workspace,
            emit_event,
            "proof_failed",
            {
                "call_id": call_id or None,
                "edge": result_data["edge"],
                "manifest_id": manifest_id,
                "spec_hash": spec_hash,
                "policy_mode": proof_policy.get("mode"),
                "policy_reason": (
                    str(resolved_published_ledger.get("admission_basis") or "pending_fh_review")
                    if admission_pending
                    else str(
                        resolved_published_ledger.get("target_certification_reason")
                        or "target_certification_failed"
                    )
                    if certification_failed
                    else "proof_incomplete"
                ),
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
        failure_class = (
            "probabilistic_non_convergence"
            if admission_pending
            else "certification_failure"
            if certification_failed
            else "proof_failure"
        )

        if admission_pending:
            if call_id and graph_call_terminal:
                graph_call_failed = _event_writer(
                    workspace,
                    emit_event,
                    "graph_call_failed",
                    {
                        "call_id": call_id,
                        "edge": result_data["edge"],
                        "failure_class": failure_class,
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
                "published_ledger_ref": dict(published_ledger_ref),
                "manifest_id": manifest_id,
                "spec_hash": spec_hash,
                "workflow_version": workflow_version,
                "events_emitted": emitted_count,
                "fulfillment_assessments": emitted,
                "failure_class": failure_class,
                "continuation_id": continuation_id,
            }

        if call_id and graph_call_terminal:
            graph_call_failed = _event_writer(
                workspace,
                emit_event,
                "graph_call_failed",
                {
                    "call_id": call_id,
                    "edge": result_data["edge"],
                    "failure_class": failure_class,
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
                    "failure_class": failure_class,
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
            "published_ledger_ref": dict(published_ledger_ref),
            "manifest_id": manifest_id,
            "spec_hash": spec_hash,
            "workflow_version": workflow_version,
            "events_emitted": emitted_count,
            "fulfillment_assessments": emitted,
            "failure_class": failure_class,
            "continuation_id": continuation_id,
        }

    return {
        "status": "ok",
        "result_path": str(result_file),
        "published_ledger_ref": dict(published_ledger_ref),
        "manifest_id": manifest_id,
        "spec_hash": spec_hash,
        "workflow_version": workflow_version,
        "events_emitted": emitted_count,
        "fulfillment_assessments": emitted,
    }

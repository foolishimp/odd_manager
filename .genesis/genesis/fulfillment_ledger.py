# Implements: REQ-R-ABG3-PROJECTION
from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from pathlib import Path
from typing import Any

from .correction import find_latest_reset


PUBLISHED_FULFILLMENT_LEDGER_REF_KIND = "published_fulfillment_ledger"
WORKSPACE_FILE_LEDGER_RESOLVER = "workspace_file"


def _event_value(event: dict[str, Any], key: str) -> Any:
    value = event.get(key)
    if value is not None:
        return value
    return event.get("data", {}).get(key)


def _event_time_value(event: Mapping[str, Any] | None) -> datetime | None:
    if not isinstance(event, Mapping):
        return None
    raw = event.get("event_time")
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _work_key_matches(event_work_key: Any, work_key: str | None) -> bool:
    if work_key is not None:
        return event_work_key == work_key
    return event_work_key is None


def published_fulfillment_ledger_path(workspace: Path, manifest_id: str) -> Path:
    return workspace / ".ai-workspace" / "fp_ledgers" / f"{manifest_id}.json"


def make_published_fulfillment_ledger_ref(*, manifest_id: str) -> dict[str, str]:
    if not isinstance(manifest_id, str) or not manifest_id.strip():
        raise ValueError("published fulfillment ledger ref requires a non-empty manifest_id")
    return {
        "kind": PUBLISHED_FULFILLMENT_LEDGER_REF_KIND,
        "resolver": WORKSPACE_FILE_LEDGER_RESOLVER,
        "manifest_id": manifest_id,
    }


def coerce_published_fulfillment_ledger_ref(value: Any) -> dict[str, str]:
    if not isinstance(value, Mapping):
        raise ValueError("published fulfillment ledger ref must be an object")
    kind = value.get("kind")
    resolver = value.get("resolver")
    manifest_id = value.get("manifest_id")
    if kind != PUBLISHED_FULFILLMENT_LEDGER_REF_KIND:
        raise ValueError(
            "published fulfillment ledger ref kind must be "
            f"{PUBLISHED_FULFILLMENT_LEDGER_REF_KIND!r}"
        )
    if resolver != WORKSPACE_FILE_LEDGER_RESOLVER:
        raise ValueError(
            "published fulfillment ledger ref resolver must be "
            f"{WORKSPACE_FILE_LEDGER_RESOLVER!r}"
        )
    if not isinstance(manifest_id, str) or not manifest_id.strip():
        raise ValueError("published fulfillment ledger ref manifest_id must be a non-empty string")
    return {
        "kind": PUBLISHED_FULFILLMENT_LEDGER_REF_KIND,
        "resolver": WORKSPACE_FILE_LEDGER_RESOLVER,
        "manifest_id": manifest_id,
    }


def published_fulfillment_ledger_path_from_ref(
    workspace: Path,
    ledger_ref: Mapping[str, Any],
) -> Path:
    resolved_ref = coerce_published_fulfillment_ledger_ref(ledger_ref)
    return published_fulfillment_ledger_path(workspace, resolved_ref["manifest_id"])


def load_published_fulfillment_ledger(path: str | Path) -> dict[str, Any] | None:
    ledger_path = Path(path)
    if not ledger_path.exists():
        return None
    try:
        raw = json.loads(ledger_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(raw, Mapping):
        return None
    return dict(raw)


def write_published_fulfillment_ledger(
    path: str | Path,
    ledger: Mapping[str, Any],
) -> str:
    ledger_path = Path(path)
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    ledger_path.write_text(
        json.dumps(dict(ledger), indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return str(ledger_path)


def published_fulfillment_edge_converged(ledger_data: Mapping[str, Any]) -> bool:
    target_certification_passed = ledger_data.get("target_certification_passed", True)
    return (
        bool(ledger_data.get("carry_converged"))
        and bool(ledger_data.get("fulfillment_converged"))
        and bool(ledger_data.get("admitted"))
        and bool(target_certification_passed)
    )


def update_published_fulfillment_ledger_admission(
    workspace: Path,
    ledger_ref: Mapping[str, Any],
    *,
    admitted: bool,
    admission_basis: str,
) -> dict[str, Any] | None:
    path = published_fulfillment_ledger_path_from_ref(workspace, ledger_ref)
    ledger_data = load_published_fulfillment_ledger(path)
    if ledger_data is None:
        return None
    updated = dict(ledger_data)
    updated["admitted"] = admitted
    updated["admission_basis"] = admission_basis
    updated["edge_converged"] = published_fulfillment_edge_converged(updated)
    write_published_fulfillment_ledger(path, updated)
    return updated


def latest_fp_assessed_event(
    all_events: list[dict[str, Any]],
    *,
    edge: str | None = None,
    work_key: str | None = None,
    spec_hash: str | None = None,
    run_id: str | None = None,
    call_id: str | None = None,
) -> dict[str, Any] | None:
    reset = find_latest_reset(all_events, edge=edge, work_key=work_key) if edge is not None else None
    reset_time = _event_time_value(reset)
    latest_assessed: dict[str, Any] | None = None

    for event in all_events:
        if event.get("event_type") != "assessed":
            continue
        data = event.get("data", {})
        if data.get("kind") != "fp":
            continue
        if edge is not None and data.get("edge") != edge:
            continue
        if spec_hash is not None and data.get("spec_hash") != spec_hash:
            continue
        if not _work_key_matches(data.get("work_key"), work_key):
            continue
        if run_id is not None:
            event_run_id = _event_value(event, "run_id")
            event_call_id = _event_value(event, "call_id")
            if event_run_id != run_id and (call_id is None or event_call_id != call_id):
                continue
        elif call_id is not None and _event_value(event, "call_id") != call_id:
            continue
        event_time = _event_time_value(event)
        if reset_time is not None and event_time is not None and event_time <= reset_time:
            continue
        latest_assessed = event

    return latest_assessed


def resolve_published_fulfillment_ledger(
    all_events: list[dict[str, Any]],
    *,
    edge: str | None = None,
    work_key: str | None = None,
    spec_hash: str | None = None,
    current_workflow_version: str = "unknown",
    manifest_id: str | None = None,
    workspace: Path | None = None,
    ledger_ref: Mapping[str, Any] | None = None,
    run_id: str | None = None,
    call_id: str | None = None,
) -> dict[str, Any] | None:
    resolved_ref: dict[str, str] | None = None
    if ledger_ref is not None:
        try:
            resolved_ref = coerce_published_fulfillment_ledger_ref(ledger_ref)
        except ValueError:
            return None
    latest_assessed = None
    if resolved_ref is None:
        latest_assessed = latest_fp_assessed_event(
            all_events,
            edge=edge,
            work_key=work_key,
            spec_hash=spec_hash,
            run_id=run_id,
            call_id=call_id,
        )
        if latest_assessed is not None:
            try:
                candidate_ref = coerce_published_fulfillment_ledger_ref(
                    latest_assessed.get("data", {}).get("published_ledger_ref")
                )
            except ValueError:
                candidate_ref = None
            if candidate_ref is not None:
                resolved_ref = candidate_ref
            if manifest_id is None:
                candidate_manifest_id = latest_assessed.get("data", {}).get("manifest_id")
                if isinstance(candidate_manifest_id, str) and candidate_manifest_id:
                    manifest_id = candidate_manifest_id
    if resolved_ref is None and isinstance(manifest_id, str) and manifest_id:
        resolved_ref = make_published_fulfillment_ledger_ref(manifest_id=manifest_id)
    if resolved_ref is None or workspace is None:
        return None
    resolved_path = published_fulfillment_ledger_path_from_ref(workspace, resolved_ref)

    ledger_data = load_published_fulfillment_ledger(resolved_path)
    if ledger_data is None:
        return None
    if edge is not None and ledger_data.get("edge") != edge:
        return None
    if spec_hash is not None and ledger_data.get("spec_hash") != spec_hash:
        return None
    if current_workflow_version != "unknown":
        ledger_workflow_version = ledger_data.get("workflow_version")
        if isinstance(ledger_workflow_version, str) and ledger_workflow_version != current_workflow_version:
            return None
    obligations = ledger_data.get("obligations")
    if not isinstance(obligations, list):
        return None

    resolved = dict(ledger_data)
    resolved["obligations"] = [
        dict(obligation) for obligation in obligations if isinstance(obligation, Mapping)
    ]
    resolved["edge_converged"] = published_fulfillment_edge_converged(resolved)
    resolved["published_ledger_ref"] = dict(resolved_ref)
    if isinstance(manifest_id, str) and manifest_id:
        resolved["manifest_id"] = manifest_id

    return resolved


def obligation_for_evaluator(
    ledger_data: Mapping[str, Any],
    evaluator_name: str,
) -> dict[str, Any] | None:
    obligations = ledger_data.get("obligations")
    if not isinstance(obligations, list):
        return None
    evaluator_matches = [
        dict(obligation)
        for obligation in obligations
        if isinstance(obligation, Mapping) and obligation.get("evaluator") == evaluator_name
    ]
    if len(evaluator_matches) == 1:
        return evaluator_matches[0]
    return None

# Implements: REQ-R-ABG3-RUN
"""
run — Execution attempt governance.

RunState, run_state, find_pending_run, supersede_run.
"""
from __future__ import annotations

from dataclasses import dataclass


def _event_value(event: dict, key: str):
    value = event.get(key)
    if value is not None:
        return value
    return event.get("data", {}).get(key)


# Canonical run states projected from the event stream.
RUN_STATES = frozenset({
    "queued", "started", "dispatched", "pending",
    "yielded", "completed", "failed", "timed_out", "superseded",
})
ACTIVE_RUN_STATES = frozenset({"queued", "pending", "started", "dispatched", "yielded"})

# Canonical failure classifications projected from the event stream.
FAILURE_CLASSES = frozenset({
    "transport_failure",
    "no_output",
    "contract_failure",
    "certification_failure",
    "policy_config_defect",
    "runtime_defect",
    "proof_failure",
    "probabilistic_non_convergence",
})


@dataclass(frozen=True)
class RunState:
    """
    Derived state of a single run attempt.

    State is derived entirely from events; no mutable runtime shadow state exists.
    Binding identity fields remain replay-visible when present in the stream.
    """
    work_key: str | None
    run_id: str
    edge: str
    state: str  # one of RUN_STATES
    vector_id: str | None = None         # operational handle (REQ-L-GTL3-IDENTITY)
    job_id: str | None = None           # GTL job identity (REQ-R-ABG3-RUN-001)
    worker_id: str | None = None        # bound worker/runtime provenance
    role_id: str | None = None          # bound role/runtime provenance
    authority_ref: str | None = None    # external authority/runtime provenance
    selected_worker_id: str | None = None
    selected_backend: str | None = None
    assignment_source: str | None = None
    resolved_runtime_ref: str | None = None
    manifest_id: str | None = None
    failure_class: str | None = None
    attempt_number: int = 1
    superseded_by: str | None = None


def _project_assessment(
    data: dict,
    current_state: str | None,
    current_failure_class: str | None,
) -> tuple[str | None, str | None]:
    """Assessed facts are evidence inputs, not terminal run truth."""
    return current_state, current_failure_class


def run_state(
    all_events: list[dict],
    run_id: str,
) -> RunState | None:
    """
    Derive current RunState for a given run_id by replaying events.

    Returns None if no events reference this run_id.
    """
    state = None
    work_key = None
    edge = None
    vector_id = None
    job_id = None
    worker_id = None
    role_id = None
    authority_ref = None
    selected_worker_id = None
    selected_backend = None
    assignment_source = None
    resolved_runtime_ref = None
    manifest_id = None
    failure_class = None
    attempt_number = 1
    superseded_by = None

    for e in all_events:
        etype = e.get("event_type")
        edata = e.get("data", {})
        erun = _event_value(e, "run_id")
        superseded_run_id = _event_value(e, "superseded_run_id")

        if etype == "run_superseded" and (superseded_run_id == run_id or erun == run_id):
            state = "superseded"
            superseded_by = _event_value(e, "superseded_by")
            edge = _event_value(e, "edge") or edge
            work_key = _event_value(e, "work_key") or work_key
            continue

        if erun != run_id:
            continue

        if etype == "run_bound":
            # ADR-030 §10: run_bound is the authoritative binding event.
            # It carries the full binding identity but does NOT change
            # lifecycle state — it is a binding fact, not a state.
            work_key = _event_value(e, "work_key") or work_key
            edge = _event_value(e, "edge") or edge
            vector_id = _event_value(e, "vector_id") or vector_id
            job_id = _event_value(e, "job_id") or job_id
            worker_id = _event_value(e, "worker_id") or worker_id
            role_id = _event_value(e, "role_id") or role_id
            authority_ref = _event_value(e, "authority_ref") or authority_ref
            selected_worker_id = _event_value(e, "selected_worker_id") or selected_worker_id
            selected_backend = _event_value(e, "selected_backend") or _event_value(e, "backend_id") or selected_backend
            assignment_source = _event_value(e, "assignment_source") or assignment_source
            resolved_runtime_ref = _event_value(e, "resolved_runtime_ref") or resolved_runtime_ref

        elif etype == "run_queued":
            # ADR-030 §10: transport-separated runtimes emit run_queued.
            # Local inline runtimes skip directly to run_started.
            state = "queued"
            work_key = _event_value(e, "work_key") or work_key
            edge = _event_value(e, "edge") or edge

        elif etype == "run_pending":
            # ADR-030 §10: run accepted by scheduler, awaiting start.
            state = "pending"
            work_key = _event_value(e, "work_key") or work_key
            edge = _event_value(e, "edge") or edge

        elif etype == "run_started":
            state = "started"
            work_key = _event_value(e, "work_key") or work_key
            edge = _event_value(e, "edge") or edge
            attempt_number = _event_value(e, "attempt_number") or attempt_number
            # run_bound is authoritative when present; run_started may still
            # carry identity fields as event-local provenance.
            job_id = _event_value(e, "job_id") or job_id
            worker_id = _event_value(e, "worker_id") or worker_id
            role_id = _event_value(e, "role_id") or role_id
            authority_ref = _event_value(e, "authority_ref") or authority_ref
            selected_worker_id = _event_value(e, "selected_worker_id") or selected_worker_id
            selected_backend = _event_value(e, "selected_backend") or _event_value(e, "backend_id") or selected_backend
            assignment_source = _event_value(e, "assignment_source") or assignment_source
            resolved_runtime_ref = _event_value(e, "resolved_runtime_ref") or resolved_runtime_ref

        elif etype == "fp_dispatched":
            state = "dispatched"
            edge = _event_value(e, "edge") or edge
            manifest_id = _event_value(e, "manifest_id") or manifest_id
            role_id = _event_value(e, "role_id") or role_id
            authority_ref = _event_value(e, "authority_ref") or authority_ref
            selected_worker_id = _event_value(e, "selected_worker_id") or selected_worker_id
            selected_backend = _event_value(e, "selected_backend") or _event_value(e, "backend_id") or selected_backend
            assignment_source = _event_value(e, "assignment_source") or assignment_source
            resolved_runtime_ref = _event_value(e, "resolved_runtime_ref") or resolved_runtime_ref

        elif etype == "assessed":
            edge = _event_value(e, "edge") or edge
            role_id = _event_value(e, "role_id") or role_id
            authority_ref = _event_value(e, "authority_ref") or authority_ref
            selected_worker_id = _event_value(e, "selected_worker_id") or selected_worker_id
            selected_backend = _event_value(e, "selected_backend") or _event_value(e, "backend_id") or selected_backend
            assignment_source = _event_value(e, "assignment_source") or assignment_source
            resolved_runtime_ref = _event_value(e, "resolved_runtime_ref") or resolved_runtime_ref
            state, failure_class = _project_assessment(edata, state, failure_class)

        elif etype == "run_completed":
            work_key = _event_value(e, "work_key") or work_key
            edge = _event_value(e, "edge") or edge
            state = "completed"

        elif etype == "run_yielded":
            work_key = _event_value(e, "work_key") or work_key
            edge = _event_value(e, "edge") or edge
            state = "yielded"

        elif etype == "run_failed":
            work_key = _event_value(e, "work_key") or work_key
            edge = _event_value(e, "edge") or edge
            state = "failed"
            failure_class = _event_value(e, "failure_class") or failure_class

        elif etype == "run_timed_out":
            work_key = _event_value(e, "work_key") or work_key
            edge = _event_value(e, "edge") or edge
            state = "timed_out"
            failure_class = None

    if state is None:
        return None

    return RunState(
        work_key=work_key,
        run_id=run_id,
        edge=edge or "",
        state=state,
        vector_id=vector_id,
        job_id=job_id,
        worker_id=worker_id,
        role_id=role_id,
        authority_ref=authority_ref,
        selected_worker_id=selected_worker_id,
        selected_backend=selected_backend,
        assignment_source=assignment_source,
        resolved_runtime_ref=resolved_runtime_ref,
        manifest_id=manifest_id,
        failure_class=failure_class,
        attempt_number=attempt_number,
        superseded_by=superseded_by,
    )


def project_run(all_events: list[dict], run_id: str) -> dict:
    state = run_state(all_events, run_id)
    if state is None:
        return {
            "asset_type": "run",
            "instance_id": run_id,
            "status": "not_started",
            "event_count": 0,
        }
    projected = {
        "asset_type": "run",
        "instance_id": run_id,
        "status": state.state,
        "work_key": state.work_key,
        "run_id": state.run_id,
        "edge": state.edge,
        "vector_id": state.vector_id,
        "job_id": state.job_id,
        "worker_id": state.worker_id,
        "role_id": state.role_id,
        "authority_ref": state.authority_ref,
        "selected_worker_id": state.selected_worker_id,
        "selected_backend": state.selected_backend,
        "assignment_source": state.assignment_source,
        "resolved_runtime_ref": state.resolved_runtime_ref,
        "manifest_id": state.manifest_id,
        "failure_class": state.failure_class,
        "attempt_number": state.attempt_number,
        "superseded_by": state.superseded_by,
    }
    projected["event_count"] = sum(1 for event in all_events if _event_value(event, "run_id") == run_id)
    return projected


def find_pending_run(
    all_events: list[dict],
    edge_name: str,
    *,
    work_key: str | None = None,
) -> RunState | None:
    """
    Find an active (queued/pending/started/dispatched/yielded) run for this (edge, work_key).

    At most one run may remain active per (work_key, edge) after replay.
    """
    candidate_run_ids: list[str] = []
    for e in all_events:
        edata = e.get("data", {})
        erun = edata.get("run_id")
        if not erun:
            continue
        evt_edge = edata.get("edge")
        if evt_edge != edge_name:
            continue
        evt_wk = edata.get("work_key")
        if work_key is not None:
            if evt_wk != work_key:
                continue
        elif evt_wk is not None:
            continue
        if erun not in candidate_run_ids:
            candidate_run_ids.append(erun)

    for rid in reversed(candidate_run_ids):
        rs = run_state(all_events, rid)
        if rs is not None and rs.state in ACTIVE_RUN_STATES:
            return rs

    return None


def supersede_run(
    old_run_id: str,
    new_run_id: str,
    edge: str,
    work_key: str | None = None,
) -> dict:
    """Construct a run_superseded event for the caller to emit."""
    data: dict = {
        "superseded_run_id": old_run_id,
        "superseded_by": new_run_id,
        "edge": edge,
    }
    if work_key is not None:
        data["work_key"] = work_key
    return {
        "event_type": "run_superseded",
        "data": data,
    }

# Implements: REQ-R-ABG3-CORRECTION
"""
correction — Correction and reset.

find_latest_reset implements ADR-026 scope containment rules.
emit_reset_followups turns reset into authoritative runtime termination truth.
"""
from __future__ import annotations


ACTIVE_RUN_STATES = frozenset({"queued", "pending", "started", "dispatched", "yielded"})


def _event_value(event: dict, key: str):
    value = event.get(key)
    if value is not None:
        return value
    return event.get("data", {}).get(key)


def reset_applies_to_scope(
    reset_event: dict,
    *,
    edge: str | None,
    work_key: str | None,
) -> bool:
    """True when the reset event shadows the supplied execution scope."""
    edata = reset_event.get("data", {})
    reset_scope = edata.get("scope")

    if reset_scope == "workspace":
        return True

    if reset_scope == "work_key":
        reset_wk = edata.get("work_key")
        if reset_wk is None or work_key is None:
            return False
        return work_key == reset_wk or work_key.startswith(reset_wk + "/")

    if reset_scope == "edge":
        reset_edge = edata.get("edge")
        reset_wk = edata.get("work_key")
        if reset_edge is not None and reset_edge != edge:
            return False
        if reset_wk is None or work_key is None:
            return False
        return work_key == reset_wk or work_key.startswith(reset_wk + "/")

    return False


def find_latest_reset(
    all_events: list[dict],
    edge: str | None = None,
    work_key: str | None = None,
) -> dict | None:
    """
    Find the latest applicable reset event for a given scope query.

    ADR-026 scope containment rules:
      - Workspace resets (scope="workspace") contain everything
      - Work_key resets (scope="work_key") contain that lineage and descendants
      - Edge+work_key resets (scope="edge") contain that specific slice only

    Returns the most recent matching reset event, or None if no reset applies.
    """
    latest: dict | None = None

    for e in all_events:
        if e.get("event_type") != "reset":
            continue
        edata = e.get("data", {})
        reset_scope = edata.get("scope")

        if reset_scope == "workspace":
            pass

        elif reset_scope == "work_key":
            reset_wk = edata.get("work_key")
            if reset_wk is None:
                continue
            if work_key is None:
                continue
            if not (work_key == reset_wk or work_key.startswith(reset_wk + "/")):
                continue

        elif reset_scope == "edge":
            reset_edge = edata.get("edge")
            reset_wk = edata.get("work_key")
            if reset_edge is not None and reset_edge != edge:
                continue
            if reset_wk is not None:
                if work_key is None:
                    continue
                if not (work_key == reset_wk or work_key.startswith(reset_wk + "/")):
                    continue
        else:
            continue

        if latest is None or e.get("event_time", "") > latest.get("event_time", ""):
            latest = e

    return latest


def emit_reset_followups(stream, reset_event: dict) -> None:
    """
    Emit authoritative runtime termination truth caused by a reset.

    Reset is not merely replay advice. Any open continuation or active run
    shadowed by the reset must terminate by emitted event truth.
    """
    from .continuation import continuation_state
    from .events import EventContext, emit
    from .run import run_state

    all_events = stream.all_events()
    reset_event_id = reset_event.get("event_id")
    reset_work_key = _event_value(reset_event, "work_key")

    run_ids = sorted(
        {
            run_id
            for event in all_events
            if isinstance((run_id := _event_value(event, "run_id")), str) and run_id
        }
    )
    run_scopes: dict[str, tuple[str | None, str | None, str]] = {}
    active_run_ids: set[str] = set()
    for run_id in run_ids:
        state = run_state(all_events, run_id)
        if state is None:
            continue
        if not reset_applies_to_scope(reset_event, edge=state.edge or None, work_key=state.work_key):
            continue
        run_scopes[run_id] = (state.edge or None, state.work_key, state.state)
        if state.state in ACTIVE_RUN_STATES:
            active_run_ids.add(run_id)

    continuation_ids = sorted(
        {
            continuation_id
            for event in all_events
            if isinstance(
                (continuation_id := _event_value(event, "continuation_id")),
                str,
            )
            and continuation_id
        }
    )
    for continuation_id in continuation_ids:
        state = continuation_state(all_events, continuation_id)
        if state is None or state.state != "open":
            continue
        if state.run_id not in run_scopes:
            continue
        edge, work_key, run_state_name = run_scopes[state.run_id]
        terminal_event = (
            "continuation_superseded"
            if run_state_name in ACTIVE_RUN_STATES
            else "continuation_abandoned"
        )
        emit(
            terminal_event,
            {
                "continuation_id": continuation_id,
                "continuation_kind": state.continuation_kind,
                "call_id": state.call_id,
                "caused_by_event_id": reset_event_id,
                "edge": edge,
            },
            stream=stream,
            context=EventContext(
                workflow_version=_event_value(reset_event, "workflow_version") or "unknown",
                work_key=work_key or reset_work_key,
                run_id=state.run_id,
                aggregate_type="continuation",
                aggregate_id=continuation_id,
                parent_aggregate_id=state.run_id,
                causation_event_id=reset_event_id,
                call_id=state.call_id,
                frame_attempt_id=state.frame_attempt_id,
            ),
        )

    for run_id in sorted(active_run_ids):
        edge, work_key, _ = run_scopes[run_id]
        emit(
            "run_superseded",
            {
                "superseded_run_id": run_id,
                "superseded_by": f"reset:{reset_event_id}",
                "edge": edge,
                "work_key": work_key,
                "caused_by_event_id": reset_event_id,
            },
            stream=stream,
            context=EventContext(
                workflow_version=_event_value(reset_event, "workflow_version") or "unknown",
                work_key=work_key or reset_work_key,
                run_id=run_id,
                aggregate_type="run",
                aggregate_id=run_id,
                causation_event_id=reset_event_id,
            ),
        )

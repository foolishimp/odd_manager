# Implements: REQ-R-ABG3-GRAPHCALL
"""
graph_call — replay-derived callable runtime aggregate truth.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass


def _event_value(event: dict, key: str):
    value = event.get(key)
    if value is not None:
        return value
    return event.get("data", {}).get(key)


@dataclass(frozen=True)
class GraphCallState:
    call_id: str
    run_id: str | None
    graph_function_id: str | None
    materialization_id: str | None
    state: str
    event_count: int = 0
    failure_class: str | None = None


def graph_call_state(all_events: list[dict], call_id: str) -> GraphCallState | None:
    state: str | None = None
    run_id: str | None = None
    graph_function_id: str | None = None
    materialization_id: str | None = None
    failure_class: str | None = None
    event_count = 0

    for event in all_events:
        aggregate_type = event.get("aggregate_type")
        aggregate_id = event.get("aggregate_id")
        if aggregate_type == "graph_call" and aggregate_id == call_id:
            relevant = True
        else:
            relevant = _event_value(event, "call_id") == call_id
        if not relevant:
            continue

        event_count += 1
        run_id = _event_value(event, "run_id") or run_id
        graph_function_id = _event_value(event, "graph_function_id") or graph_function_id
        materialization_id = _event_value(event, "materialization_id") or materialization_id
        event_type = event.get("event_type")
        if event_type == "graph_call_opened":
            state = "open"
        elif event_type == "graph_call_closed":
            state = "closed"
        elif event_type == "graph_call_failed":
            state = "failed"
            failure_class = _event_value(event, "failure_class") or failure_class

    if state is None:
        return None

    return GraphCallState(
        call_id=call_id,
        run_id=run_id,
        graph_function_id=graph_function_id,
        materialization_id=materialization_id,
        state=state,
        event_count=event_count,
        failure_class=failure_class,
    )


def project_graph_call(all_events: list[dict], call_id: str) -> dict:
    state = graph_call_state(all_events, call_id)
    if state is None:
        return {
            "asset_type": "graph_call",
            "instance_id": call_id,
            "status": "not_started",
            "event_count": 0,
        }
    projected = asdict(state)
    projected["asset_type"] = "graph_call"
    projected["instance_id"] = call_id
    projected["status"] = projected.pop("state")
    return projected

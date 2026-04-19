# Implements: REQ-F-ASSETMODEL-005
# Implements: REQ-F-ODDSDLC-005
"""Observer surface for the odd_sdlc UI steel thread."""
from __future__ import annotations

from typing import Any

from genesis.continuation import project_continuation
from genesis.graph_call import project_graph_call
from genesis.run import project_run

from .app import OddSdlcApp
from .query import query_domain


def _event_value(event: dict[str, Any], key: str) -> Any:
    value = event.get(key)
    if value is not None:
        return value
    return event.get("data", {}).get(key)


def _project_runs(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    run_ids = []
    seen: set[str] = set()
    for event in events:
        run_id = _event_value(event, "run_id")
        if isinstance(run_id, str) and run_id and run_id not in seen:
            seen.add(run_id)
            run_ids.append(run_id)
    return [project_run(events, run_id) for run_id in run_ids]


def _project_graph_calls(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    call_ids = []
    seen: set[str] = set()
    for event in events:
        call_id = _event_value(event, "call_id")
        if isinstance(call_id, str) and call_id and call_id not in seen:
            seen.add(call_id)
            call_ids.append(call_id)
    return [project_graph_call(events, call_id) for call_id in call_ids]


def _project_continuations(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    continuation_ids = []
    seen: set[str] = set()
    for event in events:
        continuation_id = _event_value(event, "continuation_id")
        if isinstance(continuation_id, str) and continuation_id and continuation_id not in seen:
            seen.add(continuation_id)
            continuation_ids.append(continuation_id)
    return [project_continuation(events, continuation_id) for continuation_id in continuation_ids]


def observe(app: OddSdlcApp) -> dict[str, Any]:
    events = app.stream.all_events()
    domain_payload = query_domain(app)
    return {
        **domain_payload,
        "runs": _project_runs(events),
        "graph_calls": _project_graph_calls(events),
        "continuations": _project_continuations(events),
        "recent_events": [
            {
                "event_id": event.get("event_id"),
                "event_time": event.get("event_time"),
                "event_type": event["event_type"],
                "aggregate_type": event.get("aggregate_type"),
                "aggregate_id": event.get("aggregate_id"),
            }
            for event in events[-20:]
        ],
    }

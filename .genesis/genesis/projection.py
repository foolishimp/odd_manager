# Implements: REQ-R-ABG3-PROJECTION
"""
projection — Pure replay: project truth from event stream.

project(S, T, I) = project(S, T, I) always — deterministic.
"""
from __future__ import annotations

from typing import Any, Optional

from .events import EventStream


def project(
    stream: EventStream,
    asset_type: str,
    instance_id: str,
    *,
    work_key: Optional[str] = None,
) -> dict:
    """
    Assets are projections, not stored objects.

    project(S, T, I) = project(S, T, I) always — deterministic.
    The current state of any asset is derived here, never from mutable state.

    work_key: when provided, filters events to those matching this work_key.
    When absent, all events are considered (global scope).
    """
    if asset_type == "frame":
        from .frames import project_frame

        return project_frame(stream, instance_id)
    if asset_type == "run":
        from .run import project_run

        return project_run(stream.all_events(), instance_id)
    if asset_type == "graph_call":
        from .graph_call import project_graph_call

        return project_graph_call(stream.all_events(), instance_id)
    if asset_type == "continuation":
        from .continuation import project_continuation

        return project_continuation(stream.all_events(), instance_id)

    events = stream.all_events()

    state: dict[str, Any] = {
        "asset_type": asset_type,
        "instance_id": instance_id,
        "status": "not_started",
        "edges_converged": [],
        "event_count": 0,
    }
    if work_key is not None:
        state["work_key"] = work_key

    for event in events:
        data = event.get("data", {})
        etype = event.get("event_type", "")

        # Work-key scoping
        if work_key is not None:
            event_wk = data.get("work_key")
            if event_wk is not None and event_wk != work_key:
                continue

        relevant = (
            data.get("instance_id") == instance_id
            or data.get("work_key") == instance_id
            or (instance_id == "current" and asset_type in (
                data.get("target", ""),
                data.get("asset_type", ""),
            ))
            or (instance_id == "current" and etype == "vector_started"
                and data.get("target") == asset_type)
        )

        if not relevant:
            continue

        state["event_count"] += 1

        if etype == "vector_started":
            if state["status"] == "not_started":
                state["status"] = "in_progress"

        elif etype == "edge_converged":
            edge_name = data.get("edge", "")
            if edge_name and edge_name not in state["edges_converged"]:
                state["edges_converged"].append(edge_name)
            if data.get("target") == asset_type:
                state["status"] = "converged"

        elif etype == "project_initialized":
            state["initialized"] = True

    return state

# Implements: REQ-R-ABG3-CONTINUATION
"""
continuation — replay-derived continuation truth.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass


def _event_value(event: dict, key: str):
    value = event.get(key)
    if value is not None:
        return value
    return event.get("data", {}).get(key)


@dataclass(frozen=True)
class ContinuationState:
    continuation_id: str
    continuation_kind: str | None
    run_id: str | None
    caused_by_event_id: str | None
    state: str
    call_id: str | None = None
    frame_attempt_id: str | None = None
    event_count: int = 0


def continuation_state(all_events: list[dict], continuation_id: str) -> ContinuationState | None:
    state: str | None = None
    continuation_kind: str | None = None
    run_id: str | None = None
    caused_by_event_id: str | None = None
    call_id: str | None = None
    frame_attempt_id: str | None = None
    event_count = 0

    for event in all_events:
        aggregate_type = event.get("aggregate_type")
        aggregate_id = event.get("aggregate_id")
        if aggregate_type == "continuation" and aggregate_id == continuation_id:
            relevant = True
        else:
            relevant = _event_value(event, "continuation_id") == continuation_id
        if not relevant:
            continue

        event_count += 1
        continuation_kind = _event_value(event, "continuation_kind") or continuation_kind
        run_id = _event_value(event, "run_id") or run_id
        caused_by_event_id = _event_value(event, "caused_by_event_id") or caused_by_event_id
        call_id = _event_value(event, "call_id") or call_id
        frame_attempt_id = _event_value(event, "frame_attempt_id") or frame_attempt_id
        event_type = event.get("event_type")
        if event_type == "continuation_opened":
            state = "open"
        elif event_type == "continuation_resolved":
            state = "resolved"
        elif event_type == "continuation_superseded":
            state = "superseded"
        elif event_type == "continuation_abandoned":
            state = "abandoned"

    if state is None:
        return None

    return ContinuationState(
        continuation_id=continuation_id,
        continuation_kind=continuation_kind,
        run_id=run_id,
        caused_by_event_id=caused_by_event_id,
        state=state,
        call_id=call_id,
        frame_attempt_id=frame_attempt_id,
        event_count=event_count,
    )


def project_continuation(all_events: list[dict], continuation_id: str) -> dict:
    state = continuation_state(all_events, continuation_id)
    if state is None:
        return {
            "asset_type": "continuation",
            "instance_id": continuation_id,
            "status": "not_started",
            "event_count": 0,
        }
    projected = asdict(state)
    projected["asset_type"] = "continuation"
    projected["instance_id"] = continuation_id
    projected["status"] = projected.pop("state")
    return projected

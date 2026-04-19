# Implements: REQ-F-ODDSDLC-003
"""Runtime-owned event publication seam for odd_sdlc domain effects."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from genesis.events import EventContext, EventStream, emit


def publish_runtime_event(
    *,
    stream: EventStream,
    event_type: str,
    data: dict[str, Any],
    workflow_version: str,
    work_key: str | None = None,
    run_id: str | None = None,
    aggregate_type: str | None = None,
    aggregate_id: str | None = None,
    correlation_id: str | None = None,
    causation_event_id: str | None = None,
    job_id: str | None = None,
    graph_function_id: str | None = None,
    materialization_id: str | None = None,
    call_id: str | None = None,
    vector_id: str | None = None,
) -> dict[str, Any]:
    return emit(
        event_type,
        data,
        stream=stream,
        context=EventContext(
            workflow_version=workflow_version,
            work_key=work_key,
            run_id=run_id,
            job_id=job_id,
            graph_function_id=graph_function_id,
            materialization_id=materialization_id,
            call_id=call_id,
            vector_id=vector_id,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            correlation_id=correlation_id,
            causation_event_id=causation_event_id,
        ),
        package_snapshot_id=None,
    )


def publish_workspace_runtime_event(
    *,
    workspace_root: Path,
    event_type: str,
    data: dict[str, Any],
    workflow_version: str,
    work_key: str | None = None,
    run_id: str | None = None,
    aggregate_type: str | None = None,
    aggregate_id: str | None = None,
    correlation_id: str | None = None,
    causation_event_id: str | None = None,
    job_id: str | None = None,
    graph_function_id: str | None = None,
    materialization_id: str | None = None,
    call_id: str | None = None,
    vector_id: str | None = None,
) -> dict[str, Any]:
    return publish_runtime_event(
        stream=EventStream.open(workspace_root),
        event_type=event_type,
        data=data,
        workflow_version=workflow_version,
        work_key=work_key,
        run_id=run_id,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        correlation_id=correlation_id,
        causation_event_id=causation_event_id,
        job_id=job_id,
        graph_function_id=graph_function_id,
        materialization_id=materialization_id,
        call_id=call_id,
        vector_id=vector_id,
    )

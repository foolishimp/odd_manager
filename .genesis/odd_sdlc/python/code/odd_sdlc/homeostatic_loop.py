# Implements: REQ-F-ODDSDLC-033
# Implements: REQ-F-ODDSDLC-036
# Implements: REQ-F-ODDSDLC-037
"""Explicit proposal-application and loopback helpers for the odd_sdlc homeostatic lane."""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from .analysis import load_workspace_state, refresh_analysis
from .app import OddSdlcApp
from .runtime_effects import publish_workspace_runtime_event
from .triage import enrich_gap_snapshot, load_current_edge_triage


def _surface_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _proposal_application_block(
    *,
    edge: str,
    proposal_id: str,
    target_surface: str,
    actor: str,
) -> str:
    return "\n".join(
        (
            "",
            f"<!-- odd_sdlc constitutional proposal applied: {proposal_id} -->",
            "## Applied Constitutional Proposal",
            f"- proposal_id: `{proposal_id}`",
            f"- originating_edge: `{edge}`",
            f"- target_surface: `{target_surface}`",
            f"- applied_by: `{actor}`",
            "",
        )
    )


def apply_constitutional_proposal(
    workspace_root: Path | str,
    *,
    edge: str,
    proposal_id: str,
    actor: str = "odd_sdlc_self_test",
) -> dict[str, Any]:
    root = Path(workspace_root).resolve()
    artifact = load_current_edge_triage(root, edge)
    if artifact is None:
        raise RuntimeError(f"no current triage artifact exists for edge {edge!r}")
    proposal = artifact.get("constitutional_proposal")
    if not isinstance(proposal, dict):
        raise RuntimeError(f"edge {edge!r} does not carry a constitutional proposal")
    if proposal.get("proposal_id") != proposal_id:
        raise RuntimeError(
            f"edge {edge!r} current proposal id {proposal.get('proposal_id')!r} does not match {proposal_id!r}"
        )

    target_surface = str(proposal["target_surface"])
    target_path = root / target_surface
    if not target_path.exists():
        raise RuntimeError(f"constitutional target surface {target_surface!r} does not exist")

    application_block = _proposal_application_block(
        edge=edge,
        proposal_id=proposal_id,
        target_surface=target_surface,
        actor=actor,
    )
    target_text = target_path.read_text(encoding="utf-8")
    if proposal_id not in target_text:
        target_path.write_text(target_text.rstrip() + application_block + "\n", encoding="utf-8")

    surface_digest = _surface_digest(target_path)
    approval_event = publish_workspace_runtime_event(
        workspace_root=root,
        event_type="constitutional_proposal_approved_with_edits",
        data={
            "edge": edge,
            "proposal_id": proposal_id,
            "actor": actor,
        },
        workflow_version=str(artifact.get("analysis_fingerprint") or "unknown"),
        run_id=str(artifact.get("run_id") or "") or None,
    )
    applied_event = publish_workspace_runtime_event(
        workspace_root=root,
        event_type="proposal_applied",
        data={
            "edge": edge,
            "proposal_id": proposal_id,
            "target_surface": target_surface,
            "surface_digest": surface_digest,
            "actor": actor,
            "approval_event_id": approval_event["event_id"],
        },
        workflow_version=str(artifact.get("analysis_fingerprint") or "unknown"),
        run_id=str(artifact.get("run_id") or "") or None,
        aggregate_type="odd_sdlc.edge_triage",
        aggregate_id=edge,
        correlation_id=approval_event["event_id"],
        causation_event_id=approval_event["event_id"],
    )
    refresh_analysis(root, stage="proposal_applied")
    return {
        "status": "applied",
        "edge": edge,
        "proposal_id": proposal_id,
        "target_surface": target_surface,
        "surface_digest": surface_digest,
        "approval_event_id": approval_event["event_id"],
        "applied_event_id": applied_event["event_id"],
    }


def loopback_homeostatic_gap(
    app: OddSdlcApp,
    *,
    edge: str,
    proposal_id: str,
    target_surface: str,
    post_gap_payload: dict[str, Any],
) -> dict[str, Any]:
    workspace_root = app.config.workspace_root
    target_path = workspace_root / target_surface
    surface_digest = _surface_digest(target_path)
    workspace_state = load_workspace_state(workspace_root) or {}
    run_id = str(workspace_state.get("active_run_id") or "") or None

    reopen_event = publish_workspace_runtime_event(
        workspace_root=workspace_root,
        event_type="derivation_reopened",
        data={
            "edge": edge,
            "proposal_id": proposal_id,
            "target_surface": target_surface,
            "surface_digest": surface_digest,
        },
        workflow_version=str(app.scope().workflow_version),
        run_id=run_id,
        aggregate_type="odd_sdlc.edge_triage",
        aggregate_id=edge,
    )

    matching_gap = next(
        (
            gap
            for gap in post_gap_payload.get("gaps", ())
            if isinstance(gap, dict) and str(gap.get("edge") or "") == edge
        ),
        None,
    )
    if matching_gap is None or float(matching_gap.get("delta") or 0.0) <= 0:
        retired_event = publish_workspace_runtime_event(
            workspace_root=workspace_root,
            event_type="gap_retired",
            data={
                "edge": edge,
                "proposal_id": proposal_id,
                "target_surface": target_surface,
                "surface_digest": surface_digest,
                "reopen_event_id": reopen_event["event_id"],
            },
            workflow_version=str(app.scope().workflow_version),
            run_id=run_id,
            aggregate_type="odd_sdlc.edge_triage",
            aggregate_id=edge,
            correlation_id=reopen_event["event_id"],
            causation_event_id=reopen_event["event_id"],
        )
        return {
            "status": "retired",
            "edge": edge,
            "proposal_id": proposal_id,
            "surface_digest": surface_digest,
            "reopen_event_id": reopen_event["event_id"],
            "retired_event_id": retired_event["event_id"],
        }

    gap_event = publish_workspace_runtime_event(
        workspace_root=workspace_root,
        event_type="gap_event",
        data={
            "edge": edge,
            "proposal_id": proposal_id,
            "originating_gap_edge": edge,
            "surface_digest": surface_digest,
            "delta": float(matching_gap.get("delta") or 0.0),
            "failing": list(matching_gap.get("failing") or ()),
            "reopen_event_id": reopen_event["event_id"],
        },
        workflow_version=str(app.scope().workflow_version),
        run_id=run_id,
        aggregate_type="odd_sdlc.edge_triage",
        aggregate_id=edge,
        correlation_id=reopen_event["event_id"],
        causation_event_id=reopen_event["event_id"],
    )
    return {
        "status": "still_open",
        "edge": edge,
        "proposal_id": proposal_id,
        "surface_digest": surface_digest,
        "reopen_event_id": reopen_event["event_id"],
        "gap_event_id": gap_event["event_id"],
        "post_gap": matching_gap,
    }


def run_homeostatic_self_check(app: OddSdlcApp) -> dict[str, Any]:
    raw_gap_payload = {
        "scope": {},
        "jobs_considered": 1,
        "total_delta": 0.5,
        "open_frames": 0,
        "converged": False,
        "gaps": [
            {
                "edge": "derive_goal_surface",
                "delta": 0.5,
                "failing": ["goal_surface_semantically_converged"],
                "passing": [],
                "delta_summary": "goal surface remains insufficient under the current constitution",
                "environment_ready": True,
            }
        ],
    }
    enrich_gap_snapshot(
        workspace_root=app.config.workspace_root,
        stream=app.stream,
        workflow_version=app.scope().workflow_version,
        raw_gap_payload=raw_gap_payload,
        runtime_config={"constitutional_repricing": {"mode": "fh_gate"}},
        publish=True,
    )
    artifact = load_current_edge_triage(app.config.workspace_root, "derive_goal_surface")
    if artifact is None:
        raise RuntimeError("homeostatic self-check expected a current triage artifact for derive_goal_surface")
    proposal = artifact.get("constitutional_proposal")
    if not isinstance(proposal, dict):
        raise RuntimeError("homeostatic self-check expected a constitutional proposal")

    applied = apply_constitutional_proposal(
        app.config.workspace_root,
        edge="derive_goal_surface",
        proposal_id=str(proposal["proposal_id"]),
    )
    post_gap_payload = {
        "scope": {},
        "jobs_considered": 1,
        "total_delta": 0.0,
        "open_frames": 0,
        "converged": True,
        "gaps": [],
    }
    loopback = loopback_homeostatic_gap(
        app,
        edge="derive_goal_surface",
        proposal_id=str(proposal["proposal_id"]),
        target_surface=str(proposal["target_surface"]),
        post_gap_payload=post_gap_payload,
    )
    return {
        "status": loopback["status"],
        "edge": "derive_goal_surface",
        "proposal_id": str(proposal["proposal_id"]),
        "target_surface": str(proposal["target_surface"]),
        "applied": applied,
        "loopback": loopback,
    }

# Implements: REQ-F-ODDSDLC-027
# Implements: REQ-F-ODDSDLC-028
"""Ambiguity register for the active odd_sdlc software-domain package."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .project_profile import (
    DEFAULT_AMBIGUITY_RISK_APPETITE,
    detect_project_profile_ambiguities,
    load_project_profile,
    load_published_workspace_state,
    published_analysis_is_current,
)


AMBIGUITY_REGISTER_KIND = "odd_sdlc.ambiguity_register"
AMBIGUITY_REGISTER_PATH = Path(".ai-workspace/runtime/odd_sdlc-ambiguity-register.json")
EVENT_STREAM_PATH = Path(".ai-workspace/events/events.jsonl")
_DEFAULT_STAGE = "normalize_workspace"
_RESOLVED_STATUSES = {"resolved", "superseded"}


def _read_existing_register(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _read_events(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    events: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
        except Exception:
            continue
        if isinstance(payload, dict):
            events.append(payload)
    return events


def _event_data(event: dict[str, Any]) -> dict[str, Any]:
    data = event.get("data")
    return data if isinstance(data, dict) else {}


def _event_edge(event: dict[str, Any]) -> str:
    data = _event_data(event)
    edge = data.get("edge")
    return edge if isinstance(edge, str) else ""


def _matching_event_refs(
    events: list[dict[str, Any]],
    *,
    event_type: str,
    edge: str,
    predicate,
) -> list[str]:
    refs: list[str] = []
    for event in events:
        if event.get("event_type") != event_type:
            continue
        if _event_edge(event) != edge:
            continue
        if not predicate(event):
            continue
        event_id = event.get("event_id")
        if isinstance(event_id, str) and event_id:
            refs.append(event_id)
    return refs


def _policy_action_for_entry(entry: dict[str, Any], *, risk_appetite: str) -> str:
    if bool(entry.get("hard_stop")):
        return "hard_block"

    ambiguity_class = str(entry.get("class") or "")
    if ambiguity_class == "multiple_realization_roots":
        return "escalate_fh" if risk_appetite in {"low", "medium"} else "fp_decide"
    if ambiguity_class == "declared_root_vs_realized_root_mismatch":
        return "escalate_fh" if risk_appetite == "low" else "fp_decide"
    return "escalate_fh" if risk_appetite == "low" else "fp_decide"


def _decision_basis(entry: dict[str, Any]) -> str:
    observed_state = entry.get("observed_state")
    if not isinstance(observed_state, dict):
        observed_state = {}
    if "resolved_output_dir" in observed_state:
        return f"selected_interpretation={observed_state.get('resolved_output_dir')!s}"
    if "declared_output_dir" in observed_state:
        return f"declared_interpretation={observed_state.get('declared_output_dir')!s}"
    return str(entry.get("current_resolution") or "")


def _enrich_entry(
    entry: dict[str, Any],
    *,
    events: list[dict[str, Any]],
    risk_appetite: str,
) -> dict[str, Any]:
    enriched = dict(entry)
    policy_action = _policy_action_for_entry(enriched, risk_appetite=risk_appetite)
    edge = str(enriched.get("expected_resolving_edge") or "")
    closed_refs = _matching_event_refs(
        events,
        event_type="graph_call_closed",
        edge=edge,
        predicate=lambda _event: True,
    ) if edge else []
    fh_refs = _matching_event_refs(
        events,
        event_type="approved",
        edge=edge,
        predicate=lambda event: _event_data(event).get("kind") in {"fh_review", "fh_intent"},
    ) if edge else []

    status = str(enriched.get("status") or "open")
    blocking = False
    decision_owner = ""
    decision_status = ""
    decision_event_refs: list[str] = []

    if policy_action == "hard_block":
        blocking = True
        decision_owner = "policy"
        decision_status = "hard_blocked"
        if status != "pending_capability":
            status = "blocked"
    elif policy_action == "escalate_fh":
        decision_event_refs = fh_refs
        if fh_refs:
            blocking = False
            decision_owner = "F_H"
            decision_status = "fh_approved"
            status = "carried"
        else:
            blocking = True
            decision_status = "pending_fh"
            status = "fh_required"
    else:
        decision_event_refs = closed_refs
        blocking = False
        if closed_refs:
            decision_owner = "F_P"
            decision_status = "fp_decided"
            status = "carried"
        else:
            decision_status = "pending_fp"
            status = "open"

    enriched.update(
        {
            "status": status,
            "blocking": blocking,
            "risk_appetite": risk_appetite,
            "policy_action": policy_action,
            "decision_owner": decision_owner,
            "decision_status": decision_status,
            "decision_basis": _decision_basis(enriched),
            "decision_event_refs": decision_event_refs,
        }
    )
    return enriched


def _merge_ambiguities(
    previous: dict[str, Any] | None,
    current_entries: list[dict[str, Any]],
    *,
    stage: str,
) -> list[dict[str, Any]]:
    previous_entries = {
        entry["ambiguity_id"]: entry
        for entry in (previous or {}).get("ambiguities", [])
        if isinstance(entry, dict) and isinstance(entry.get("ambiguity_id"), str)
    }
    merged: list[dict[str, Any]] = []
    current_ids = {entry["ambiguity_id"] for entry in current_entries}

    for entry in current_entries:
        prior = previous_entries.get(entry["ambiguity_id"])
        merged.append(
            {
                **(prior or {}),
                **entry,
                "first_seen_at": (prior or {}).get("first_seen_at", stage),
                "last_seen_at": stage,
                "introduced_by": (prior or {}).get("introduced_by", stage),
            }
        )

    for ambiguity_id, prior in previous_entries.items():
        if ambiguity_id in current_ids:
            continue
        prior_status = str(prior.get("status", "open"))
        if prior_status in _RESOLVED_STATUSES:
            merged.append({**prior, "last_seen_at": stage})
            continue
        merged.append(
            {
                **prior,
                "status": "resolved",
                "blocking": False,
                "decision_status": "resolved",
                "last_seen_at": stage,
                "current_resolution": "No longer detected during deterministic workspace normalization or workspace scan.",
                "observed_state": {},
                "competing_interpretations": [],
            }
        )

    return sorted(merged, key=lambda item: item["ambiguity_id"])


def _summary(entries: list[dict[str, Any]]) -> dict[str, Any]:
    status_counts: dict[str, int] = {}
    active_count = 0
    blocking_count = 0
    for entry in entries:
        status = str(entry.get("status", "open"))
        status_counts[status] = status_counts.get(status, 0) + 1
        if status not in _RESOLVED_STATUSES:
            active_count += 1
            if bool(entry.get("blocking", True)):
                blocking_count += 1
    return {
        "total": len(entries),
        "active": active_count,
        "blocking": blocking_count,
        "status_counts": status_counts,
    }


def build_ambiguity_register(workspace_root: Path, *, stage: str = _DEFAULT_STAGE) -> dict[str, Any]:
    path = workspace_root / AMBIGUITY_REGISTER_PATH
    previous = _read_existing_register(path)
    profile = load_project_profile(workspace_root)
    risk_appetite = profile.normalized_risk_appetite() if hasattr(profile, "normalized_risk_appetite") else DEFAULT_AMBIGUITY_RISK_APPETITE
    events = _read_events(workspace_root / EVENT_STREAM_PATH)
    current_entries = [
        _enrich_entry(entry, events=events, risk_appetite=risk_appetite)
        for entry in detect_project_profile_ambiguities(workspace_root, stage=stage)
    ]
    merged = _merge_ambiguities(previous, current_entries, stage=stage)
    return {
        "register_kind": AMBIGUITY_REGISTER_KIND,
        "schema_version": "v2",
        "workspace_root": str(workspace_root),
        "stage": stage,
        "project_profile": profile.to_dict(),
        "summary": _summary(merged),
        "ambiguities": merged,
    }


def refresh_ambiguity_register(workspace_root: Path, *, stage: str = "workspace_scan") -> dict[str, Any]:
    payload = build_ambiguity_register(workspace_root, stage=stage)
    path = workspace_root / AMBIGUITY_REGISTER_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, indent=2, sort_keys=True)
    existing = path.read_text(encoding="utf-8") if path.exists() else None
    if existing != content:
        path.write_text(content, encoding="utf-8")
    return payload


def load_published_ambiguity_register(workspace_root: Path) -> dict[str, Any] | None:
    workspace_state = load_published_workspace_state(workspace_root)
    if not isinstance(workspace_state, dict):
        return None
    if not published_analysis_is_current(workspace_root):
        return None
    path = workspace_root / AMBIGUITY_REGISTER_PATH
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_or_build_ambiguity_register(workspace_root: Path) -> dict[str, Any]:
    published = load_published_ambiguity_register(workspace_root)
    if published is not None:
        return published
    return build_ambiguity_register(workspace_root, stage="workspace_scan")


def fh_required_ambiguities_by_edge(workspace_root: Path) -> dict[str, list[dict[str, Any]]]:
    register = load_or_build_ambiguity_register(workspace_root)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in register.get("ambiguities", []):
        if not isinstance(entry, dict):
            continue
        if str(entry.get("status") or "") in _RESOLVED_STATUSES:
            continue
        if str(entry.get("policy_action") or "") != "escalate_fh":
            continue
        edge = str(entry.get("expected_resolving_edge") or "")
        if not edge:
            continue
        grouped.setdefault(edge, []).append(entry)
    return grouped

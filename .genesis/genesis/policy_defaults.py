# Implements: REQ-R-ABG3-POLICY
# Implements: REQ-R-ABG3-CONVERGENCE
"""
policy_defaults — shipped ABG3 reference policy bundles and generic hooks.

These defaults are ordinary Python references that domain users may copy,
edit, and reference from their own GTL/ABG surfaces. They are not hidden
engine constants.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def broad_fp_first_bundle(config: Mapping[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    """Return the broad ABG3 reference policy bundle."""
    config_map = _mapping(config)
    dispatch_config = _mapping(config_map.get("dispatch"))
    evaluation_config = _mapping(config_map.get("evaluation"))
    escalation_config = _mapping(config_map.get("escalation"))
    proof_config = _mapping(config_map.get("proof"))
    closure_config = _mapping(config_map.get("closure"))

    return {
        "dispatch": {
            "ref": "genesis.dispatch_runtime:dispatch_bound_manifest_via_transport",
            "config": dispatch_config,
        },
        "evaluation": {
            "ref": "genesis.policy_defaults:evaluation_declared_then_generic",
            "config": evaluation_config,
        },
        "escalation": {
            "ref": "genesis.policy_defaults:escalation_fp_first",
            "config": escalation_config,
        },
        "proof": {
            "ref": "genesis.policy_defaults:proof_recheck_after_fp",
            "config": proof_config,
        },
        "closure": {
            "ref": "genesis.policy_defaults:closure_require_resolution_or_fh",
            "config": closure_config,
        },
    }


def evaluation_declared_then_generic(config: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Reference evaluation/default ordering surface for ABG3."""
    return {
        "mode": "declared_then_generic_fd_then_fp",
        "config": _mapping(config),
    }


def escalation_fp_first(config: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Reference escalation/default ordering surface for ABG3."""
    config_map = _mapping(config)
    return {
        "mode": "fp_first_then_fh",
        "config": config_map,
        "regime_order": tuple(config_map.get("regime_order", ("F_D", "F_P", "F_H"))),
        "open_transition": dict(config_map.get("open_transition", {"F_D": "F_P", "F_P": "F_H"})),
        "fail_transition": dict(config_map.get("fail_transition", {"F_D": "F_P", "F_P": "F_H"})),
        "fd_fail_with_transition_action": config_map.get("fd_fail_with_transition_action", "continue"),
        "fd_fail_without_transition_action": config_map.get("fd_fail_without_transition_action", "fail"),
        "fp_open_with_transition_action": config_map.get("fp_open_with_transition_action", "escalate"),
        "fp_open_without_transition_action": config_map.get("fp_open_without_transition_action", "continue"),
        "repeat_round_on_quorum_open": bool(config_map.get("repeat_round_on_quorum_open", True)),
    }


def proof_recheck_after_fp(config: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Reference proof/default ordering surface for ABG3."""
    return {
        "mode": "rerun_after_fp",
        "config": _mapping(config),
    }


def closure_require_resolution_or_fh(config: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Reference closure/default ordering surface for ABG3."""
    return {
        "mode": "resolve_or_escalate_fh",
        "config": _mapping(config),
    }

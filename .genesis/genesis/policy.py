# Implements: REQ-R-ABG3-POLICY
# Implements: REQ-R-ABG3-PROVENANCE
"""
policy — ABG3 policy bundle resolution over GTL hook attachment surfaces.
"""
from __future__ import annotations

import importlib
from collections.abc import Mapping, Sequence
from typing import Any

from gtl.function_model import CandidateFamily, GraphFunction
from gtl.graph import Attrs, GraphVector
from gtl.work_model import Role


POLICY_CONCERNS = ("dispatch", "evaluation", "escalation", "proof", "closure")
DEFAULT_POLICY_BUNDLE_REF = "genesis.policy_defaults:broad_fp_first_bundle"


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _surface_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, Attrs):
        return value.to_dict()
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _import_ref(ref: str) -> Any:
    if ":" not in ref:
        raise ValueError(f"Hook reference must use MODULE:SYMBOL form, got {ref!r}")
    module_name, _, symbol_name = ref.partition(":")
    module = importlib.import_module(module_name)
    try:
        return getattr(module, symbol_name)
    except AttributeError as exc:
        raise ValueError(f"Hook reference {ref!r} does not resolve to a symbol") from exc


def materialize_policy_concern(
    policy_bundle: Mapping[str, Any],
    concern: str,
) -> dict[str, Any]:
    """Resolve one concern ref/config into executable behavior metadata."""
    concern_spec = policy_bundle.get(concern)
    if not isinstance(concern_spec, Mapping):
        raise ValueError(f"Resolved policy bundle is missing concern {concern!r}")
    spec = _normalize_spec(concern_spec, concern=concern, source="resolved_policy")
    target = _import_ref(spec["ref"])
    materialized = target(spec.get("config", {})) if callable(target) else target
    if not isinstance(materialized, Mapping):
        raise ValueError(
            f"Resolved policy concern {concern!r} from {spec['ref']!r} must materialize to a mapping"
        )
    result = dict(materialized)
    result.setdefault("ref", spec["ref"])
    result.setdefault("config", dict(spec.get("config", {})))
    return result


def _normalize_spec(
    value: Any,
    *,
    concern: str | None,
    source: str,
) -> dict[str, Any]:
    if isinstance(value, str):
        spec = {"ref": value, "config": {}}
    elif isinstance(value, Mapping):
        spec = {"ref": value.get("ref"), "config": _mapping(value.get("config"))}
    else:
        raise ValueError(f"{source} {concern or 'bundle'} must be a ref string or mapping")
    ref = spec.get("ref")
    if not isinstance(ref, str) or not ref:
        raise ValueError(f"{source} {concern or 'bundle'} must declare a non-empty ref")
    if not isinstance(spec["config"], dict):
        raise ValueError(f"{source} {concern or 'bundle'} config must be a mapping")
    return spec


def _resolve_bundle(spec: dict[str, Any], *, source: str) -> tuple[dict[str, Any], str]:
    bundle_factory = _import_ref(spec["ref"])
    bundle = bundle_factory(spec.get("config", {})) if callable(bundle_factory) else bundle_factory
    if not isinstance(bundle, Mapping):
        raise ValueError(f"{source} bundle ref {spec['ref']!r} must resolve to a mapping")
    return dict(bundle), spec["ref"]


def _surface_concern_value(surface: Mapping[str, Any], concern: str) -> Any:
    for key in (concern, f"{concern}_policy"):
        if key in surface:
            return surface[key]
    return None


def _apply_policy_surface(
    resolved: dict[str, Any],
    source_by_concern: dict[str, str],
    bundle_refs: list[str],
    surface: Mapping[str, Any],
    *,
    source: str,
) -> None:
    bundle_value = surface.get("policy_bundle")
    if bundle_value is None:
        bundle_value = surface.get("default_policy_bundle")
    if bundle_value is not None:
        bundle_spec = _normalize_spec(bundle_value, concern=None, source=source)
        bundle, bundle_ref = _resolve_bundle(bundle_spec, source=source)
        bundle_refs.append(bundle_ref)
        for concern in POLICY_CONCERNS:
            if concern not in bundle:
                continue
            concern_spec = _normalize_spec(bundle[concern], concern=concern, source=f"{source} bundle")
            resolved[concern] = concern_spec
            source_by_concern[concern] = f"{source}:bundle"

    for concern in POLICY_CONCERNS:
        concern_value = _surface_concern_value(surface, concern)
        if concern_value is None:
            continue
        concern_spec = _normalize_spec(concern_value, concern=concern, source=source)
        resolved[concern] = concern_spec
        source_by_concern[concern] = source


def resolve_policy_bundle(
    *,
    vector: GraphVector | None = None,
    graph_function: GraphFunction | None = None,
    roles: Sequence[Role] = (),
    candidate_family: CandidateFamily | None = None,
    runtime_config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Resolve the effective ABG3 policy bundle for one concrete traversal boundary.

    Precedence is low-to-high:
      broad default -> runtime config -> candidate family -> roles
      -> graph function -> graph vector
    """
    resolved: dict[str, Any] = {}
    source_by_concern: dict[str, str] = {}
    bundle_refs: list[str] = []

    _apply_policy_surface(
        resolved,
        source_by_concern,
        bundle_refs,
        {"default_policy_bundle": DEFAULT_POLICY_BUNDLE_REF},
        source="abg_default",
    )
    if runtime_config is not None:
        _apply_policy_surface(
            resolved,
            source_by_concern,
            bundle_refs,
            _surface_dict(runtime_config),
            source="runtime_config",
        )
    if candidate_family is not None:
        _apply_policy_surface(
            resolved,
            source_by_concern,
            bundle_refs,
            _surface_dict(candidate_family.policy_hints),
            source="candidate_family.policy_hints",
        )
    for index, role in enumerate(roles):
        _apply_policy_surface(
            resolved,
            source_by_concern,
            bundle_refs,
            _surface_dict(role.policy_hooks),
            source=f"role.policy_hooks[{index}]",
        )
    if graph_function is not None:
        _apply_policy_surface(
            resolved,
            source_by_concern,
            bundle_refs,
            _surface_dict(graph_function.declarations),
            source="graph_function.declarations",
        )
    if vector is not None:
        _apply_policy_surface(
            resolved,
            source_by_concern,
            bundle_refs,
            _surface_dict(vector.declarations),
            source="graph_vector.declarations",
        )

    for concern in POLICY_CONCERNS:
        if concern not in resolved:
            raise ValueError(f"Resolved policy is missing required concern {concern!r}")
        # Validate that the hook ref resolves now so malformed policy fails closed.
        _import_ref(resolved[concern]["ref"])

    policy = {
        "resolved_policy_bundle_ref": bundle_refs[-1] if bundle_refs else DEFAULT_POLICY_BUNDLE_REF,
        "bundle_refs": tuple(bundle_refs),
        "sources": source_by_concern,
    }
    policy.update(resolved)
    return policy

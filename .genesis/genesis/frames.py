# Implements: REQ-R-ABG3-INTERPRET
# Implements: REQ-R-ABG3-LINEAGE
# Implements: REQ-R-ABG3-CORRECTION
# Implements: REQ-R-ABG3-PROJECTION
"""
frames — Invocation-frame runtime for local graph-function execution.

Selection opens a frame over a stable published module boundary. Inner vectors
remain frame-local executable truth until fold-back closes the frame.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from gtl.function_model import CandidateFamily, EnvRef, GraphFunction, RefinementBoundary
from gtl.graph import AssetSurface, Attrs, Context, Graph, GraphVector, Node, _schema_key
from gtl.operator_model import Evaluator, F_D, F_H, F_P, Operator, Rule
from gtl.module_model import Module
from gtl.work_model import Job, Role

from .binding import ExecutableJob
from .correction import find_latest_reset
from .events import EventStream
from .lineage import spawn
from .selection import (
    resolve_surface_candidate_family,
    resolve_surface_refinement_boundary,
    validate_selection_surface,
    validate_traversal_surface,
)


def _stable_digest(parts: dict[str, Any]) -> str:
    raw = json.dumps(parts, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


_REGIME_BY_NAME = {
    "F_D": F_D,
    "F_P": F_P,
    "F_H": F_H,
}

_FRAME_LOCAL_SURFACE_REF_KIND = "frame_local_surface_ref_v1"
_FRAME_TRAVERSAL_SURFACE_KIND = "frame_traversal_surface_v2"


def _jsonable(value: Any) -> Any:
    if isinstance(value, GraphFunction):
        return _serialize_graph_function_summary(value)
    if isinstance(value, CandidateFamily):
        return _serialize_candidate_family(value)
    if isinstance(value, RefinementBoundary):
        return _serialize_refinement_boundary(value)
    if isinstance(value, GraphVector):
        return _serialize_vector(value)
    if isinstance(value, Node):
        return _serialize_node(value)
    if isinstance(value, Attrs):
        return {
            attr.key: _jsonable(attr.value)
            for attr in value.entries
        }
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_jsonable(item) for item in value]
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


def _from_jsonable(value: Any) -> Any:
    if isinstance(value, list):
        return tuple(_from_jsonable(item) for item in value)
    if isinstance(value, dict):
        if {"template_kind", "template_ref", "inputs", "outputs"} <= set(value):
            return _deserialize_graph_function_summary(value)
        if {"candidates", "inputs", "outputs"} <= set(value):
            return _deserialize_candidate_family(value)
        if {"hints", "inputs", "outputs"} <= set(value):
            return _deserialize_refinement_boundary(value)
        if {"sources", "target"} <= set(value):
            return _deserialize_vector(value)
        if {"name", "schema", "markov"} <= set(value):
            return _deserialize_node(value)
        return Attrs.coerce({key: _from_jsonable(item) for key, item in value.items()})
    return value


@dataclass(frozen=True)
class FrameTraversalSurface:
    """Frame-scoped traversal publication surface.

    Local declarations are authoritative for the frame. Imported declarations
    are explicit module/global publication surfaces made visible to the frame.
    """
    vectors: tuple[GraphVector, ...]
    local_graph_functions: tuple[GraphFunction, ...] = ()
    local_refinement_boundaries: tuple[RefinementBoundary, ...] = ()
    local_candidate_families: tuple[CandidateFamily, ...] = ()
    imported_refinement_boundaries: tuple[RefinementBoundary, ...] = ()
    imported_candidate_families: tuple[CandidateFamily, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "vectors", tuple(self.vectors))
        object.__setattr__(self, "local_graph_functions", tuple(self.local_graph_functions))
        object.__setattr__(self, "local_refinement_boundaries", tuple(self.local_refinement_boundaries))
        object.__setattr__(self, "local_candidate_families", tuple(self.local_candidate_families))
        object.__setattr__(self, "imported_refinement_boundaries", tuple(self.imported_refinement_boundaries))
        object.__setattr__(self, "imported_candidate_families", tuple(self.imported_candidate_families))


@dataclass(frozen=True)
class FoldBackOutcome:
    frame_lineage_id: str
    frame_attempt_id: str
    parent_key: str
    parent_vector_id: str
    parent_edge: str
    child_keys: tuple[str, ...]
    contract_binding: str | None = None
    payload: Attrs = field(default_factory=Attrs)

    def __post_init__(self) -> None:
        object.__setattr__(self, "child_keys", tuple(self.child_keys))
        object.__setattr__(self, "payload", Attrs.coerce(self.payload))


@dataclass(frozen=True)
class RecursiveContinuation:
    frame_attempt_id: str
    phase: str
    active_child_key: str | None = None
    next_step_index: int = 0


@dataclass(frozen=True)
class ChildFrontier:
    pending_child_keys: tuple[str, ...] = ()
    completed_child_keys: tuple[str, ...] = ()
    blocked_on: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "pending_child_keys", tuple(self.pending_child_keys))
        object.__setattr__(self, "completed_child_keys", tuple(self.completed_child_keys))
        object.__setattr__(self, "blocked_on", tuple(self.blocked_on))


@dataclass(frozen=True)
class RecursiveInterpreterState:
    root_frame_id: str
    stack: tuple["InvocationFrame", ...]
    continuation: RecursiveContinuation
    frontier: ChildFrontier
    checkpoint_id: str | None = None
    suspended: bool = False

    def __post_init__(self) -> None:
        object.__setattr__(self, "stack", tuple(self.stack))


@dataclass(frozen=True)
class ParentRebindResult:
    frame_lineage_id: str
    parent_key: str
    parent_vector_id: str
    parent_edge: str
    rebound: bool
    reason: str = ""
    payload: Attrs = field(default_factory=Attrs)

    def __post_init__(self) -> None:
        object.__setattr__(self, "payload", Attrs.coerce(self.payload))


@dataclass
class RecursiveFrameIndex:
    processed_events: int = 0
    frames_by_id: dict[str, "InvocationFrame"] = field(default_factory=dict)
    opened_at: dict[str, str] = field(default_factory=dict)
    states_by_frame_id: dict[str, RecursiveInterpreterState] = field(default_factory=dict)
    stale_frame_ids: set[str] = field(default_factory=set)
    closed_frame_ids: set[str] = field(default_factory=set)


def _serialize_node(node: Node) -> dict[str, Any]:
    return {
        "id": node.id,
        "name": node.name,
        "schema": _schema_key(node.schema),
        "markov": list(node.markov),
        "asset_surface": node.asset_surface.to_dict(),
        "tags": list(node.tags),
    }


def _deserialize_node(data: dict[str, Any]) -> Node:
    return Node(
        name=data["name"],
        schema=data.get("schema", ""),
        markov=tuple(data.get("markov", ())),
        asset_surface=AssetSurface.coerce(data.get("asset_surface")),
        tags=tuple(data.get("tags", ())),
        id=data.get("id", ""),
    )


def _serialize_context(ctx: Context) -> dict[str, Any]:
    return {
        "name": ctx.name,
        "locator": ctx.locator,
        "digest": ctx.digest,
    }


def _deserialize_context(data: dict[str, Any]) -> Context:
    return Context(
        name=data["name"],
        locator=data["locator"],
        digest=data["digest"],
    )


def _serialize_evaluator(evaluator: Evaluator) -> dict[str, Any]:
    return {
        "name": evaluator.name,
        "regime": evaluator.regime.__name__,
        "description": evaluator.description,
        "binding": evaluator.binding,
        "tags": list(evaluator.tags),
    }


def _deserialize_evaluator(data: dict[str, Any]) -> Evaluator:
    regime = _REGIME_BY_NAME[data.get("regime", "F_D")]
    return Evaluator(
        name=data["name"],
        regime=regime,
        description=data.get("description", ""),
        binding=data.get("binding", ""),
        tags=tuple(data.get("tags", ())),
    )


def _serialize_operator(operator: Operator) -> dict[str, Any]:
    return {
        "name": operator.name,
        "regime": operator.regime.__name__,
        "binding": operator.binding,
        "tags": list(operator.tags),
    }


def _deserialize_operator(data: dict[str, Any]) -> Operator:
    regime = _REGIME_BY_NAME[data.get("regime", "F_D")]
    return Operator(
        name=data["name"],
        regime=regime,
        binding=data.get("binding", ""),
        tags=tuple(data.get("tags", ())),
    )


def _serialize_rule(rule: Rule | None) -> dict[str, Any] | None:
    if rule is None:
        return None
    return {
        "name": rule.name,
        "kind": rule.kind,
        "config": _jsonable(rule.config),
        "tags": list(rule.tags),
    }


def _deserialize_rule(data: dict[str, Any] | None) -> Rule | None:
    if data is None:
        return None
    return Rule(
        name=data["name"],
        kind=data.get("kind", "policy"),
        config=Attrs.coerce(data.get("config", {})),
        tags=tuple(data.get("tags", ())),
    )


def _serialize_role(role: Role) -> dict[str, Any]:
    return {
        "id": role.id,
        "name": role.name,
        "tags": list(role.tags),
        "policy_hooks": _jsonable(role.policy_hooks),
    }


def _deserialize_role(data: dict[str, Any]) -> Role:
    return Role(
        name=data["name"],
        tags=tuple(data.get("tags", ())),
        policy_hooks=Attrs.coerce(data.get("policy_hooks", {})),
        id=data["id"],
    )


def _serialize_graph_function_summary(function: GraphFunction) -> dict[str, Any]:
    return {
        "id": function.id,
        "name": function.name,
        "inputs": [_serialize_node(node) for node in function.inputs],
        "outputs": [_serialize_node(node) for node in function.outputs],
        "environment": {
            "requires": [_serialize_node(node) for node in function.environment.requires],
            "provides": [_serialize_node(node) for node in function.environment.provides],
            "carries": [_serialize_node(node) for node in function.environment.carries],
        },
        "template_kind": function.template.kind,
        "template_ref": function.template.ref,
        "template_version": function.template.version,
        "template_graph": (
            _serialize_graph(function.template.graph)
            if function.template.kind == "inline_graph" and function.template.graph is not None
            else None
        ),
        "declarations": _jsonable(function.declarations),
        "tags": list(function.tags),
    }


def _deserialize_graph_function_summary(data: dict[str, Any]) -> GraphFunction:
    template_graph = data.get("template_graph")
    template: Graph | str
    if data.get("template_kind") == "inline_graph" and template_graph is not None:
        template = _deserialize_graph(template_graph)
    else:
        template = data.get("template_ref", data["name"])
    return GraphFunction(
        name=data["name"],
        inputs=tuple(_deserialize_node(node) for node in data.get("inputs", ())),
        outputs=tuple(_deserialize_node(node) for node in data.get("outputs", ())),
        environment=EnvRef(
            requires=tuple(
                _deserialize_node(node)
                for node in data.get("environment", {}).get("requires", ())
            ),
            provides=tuple(
                _deserialize_node(node)
                for node in data.get("environment", {}).get("provides", ())
            ),
            carries=tuple(
                _deserialize_node(node)
                for node in data.get("environment", {}).get("carries", ())
            ),
        ),
        template=template,
        declarations=_from_jsonable(data.get("declarations", {})),
        tags=tuple(data.get("tags", ())),
        id=data.get("id", ""),
    )


def _serialize_refinement_boundary(boundary: RefinementBoundary) -> dict[str, Any]:
    return {
        "id": boundary.id,
        "name": boundary.name,
        "inputs": [_serialize_node(node) for node in boundary.inputs],
        "outputs": [_serialize_node(node) for node in boundary.outputs],
        "hints": _jsonable(boundary.hints),
        "tags": list(boundary.tags),
    }


def _deserialize_refinement_boundary(data: dict[str, Any]) -> RefinementBoundary:
    return RefinementBoundary(
        name=data["name"],
        inputs=tuple(_deserialize_node(node) for node in data.get("inputs", ())),
        outputs=tuple(_deserialize_node(node) for node in data.get("outputs", ())),
        hints=_from_jsonable(data.get("hints", {})),
        tags=tuple(data.get("tags", ())),
        id=data.get("id", ""),
    )


def _serialize_candidate_family(family: CandidateFamily) -> dict[str, Any]:
    return {
        "id": family.id,
        "name": family.name,
        "inputs": [_serialize_node(node) for node in family.inputs],
        "outputs": [_serialize_node(node) for node in family.outputs],
        "policy_hints": _jsonable(family.policy_hints),
        "tags": list(family.tags),
        "candidates": [_serialize_graph_function_summary(candidate) for candidate in family.candidates],
    }


def _deserialize_candidate_family(data: dict[str, Any]) -> CandidateFamily:
    return CandidateFamily(
        name=data["name"],
        inputs=tuple(_deserialize_node(node) for node in data.get("inputs", ())),
        outputs=tuple(_deserialize_node(node) for node in data.get("outputs", ())),
        candidates=tuple(
            _deserialize_graph_function_summary(candidate)
            for candidate in data.get("candidates", ())
        ),
        policy_hints=_from_jsonable(data.get("policy_hints", {})),
        tags=tuple(data.get("tags", ())),
        id=data.get("id", ""),
    )


def _coerce_frame_local_surface(value: Any) -> Attrs:
    value = _from_jsonable(value)
    if isinstance(value, Attrs):
        return value
    return Attrs.coerce(value)


def _serialize_frame_local_surface_ref(value: Any) -> dict[str, Any]:
    declared_surface = _coerce_frame_local_surface(value)
    return {
        "__kind__": _FRAME_LOCAL_SURFACE_REF_KIND,
        "graph_function_ids": [function.id for function in declared_surface.get("graph_functions", ())],
        "refinement_boundaries": [
            _serialize_refinement_boundary(boundary)
            for boundary in declared_surface.get("refinement_boundaries", ())
        ],
        "candidate_family_ids": [
            family.id for family in declared_surface.get("candidate_families", ())
        ],
    }


def _serialize_surface_graph_function(function: GraphFunction) -> dict[str, Any]:
    declarations: dict[str, Any] = {}
    for key, value in function.declarations.items():
        if key == "frame_local_surface":
            declarations[key] = _serialize_frame_local_surface_ref(value)
        else:
            declarations[key] = _jsonable(value)
    return {
        "id": function.id,
        "name": function.name,
        "inputs": [_serialize_node(node) for node in function.inputs],
        "outputs": [_serialize_node(node) for node in function.outputs],
        "environment": {
            "requires": [_serialize_node(node) for node in function.environment.requires],
            "provides": [_serialize_node(node) for node in function.environment.provides],
            "carries": [_serialize_node(node) for node in function.environment.carries],
        },
        "template_kind": function.template.kind,
        "template_ref": function.template.ref,
        "template_version": function.template.version,
        "template_graph": (
            _serialize_graph(function.template.graph)
            if function.template.kind == "inline_graph" and function.template.graph is not None
            else None
        ),
        "declarations": declarations,
        "tags": list(function.tags),
    }


def _serialize_surface_candidate_family(family: CandidateFamily) -> dict[str, Any]:
    return {
        "id": family.id,
        "name": family.name,
        "inputs": [_serialize_node(node) for node in family.inputs],
        "outputs": [_serialize_node(node) for node in family.outputs],
        "policy_hints": _jsonable(family.policy_hints),
        "tags": list(family.tags),
        "candidate_ids": [candidate.id for candidate in family.candidates],
    }


def _surface_registry(surface: FrameTraversalSurface) -> dict[str, tuple[dict[str, Any], ...]]:
    graph_functions: dict[str, GraphFunction] = {}
    candidate_families: dict[str, CandidateFamily] = {}
    pending_graph_functions = list(surface.local_graph_functions)
    pending_candidate_families = list(surface.local_candidate_families) + list(surface.imported_candidate_families)

    while pending_graph_functions or pending_candidate_families:
        while pending_candidate_families:
            family = pending_candidate_families.pop()
            if family.id in candidate_families:
                continue
            candidate_families[family.id] = family
            for candidate in family.candidates:
                if candidate.id not in graph_functions:
                    pending_graph_functions.append(candidate)

        while pending_graph_functions:
            function = pending_graph_functions.pop()
            if function.id in graph_functions:
                continue
            graph_functions[function.id] = function
            declared_surface = _coerce_frame_local_surface(
                function.declarations.get("frame_local_surface", {})
            )
            for nested in declared_surface.get("graph_functions", ()):
                if nested.id not in graph_functions:
                    pending_graph_functions.append(nested)
            for family in declared_surface.get("candidate_families", ()):
                if family.id not in candidate_families:
                    pending_candidate_families.append(family)

    return {
        "graph_functions": tuple(
            _serialize_surface_graph_function(function)
            for function in graph_functions.values()
        ),
        "candidate_families": tuple(
            _serialize_surface_candidate_family(family)
            for family in candidate_families.values()
        ),
    }


def _deserialize_surface_graph_function_registry(
    registry: dict[str, Any],
) -> tuple[dict[str, GraphFunction], dict[str, CandidateFamily]]:
    function_entries = {
        entry["id"]: entry
        for entry in registry.get("graph_functions", ())
    }
    family_entries = {
        entry["id"]: entry
        for entry in registry.get("candidate_families", ())
    }
    function_cache: dict[str, GraphFunction] = {}
    family_cache: dict[str, CandidateFamily] = {}
    unresolved_functions = set(function_entries)
    unresolved_families = set(family_entries)

    while unresolved_functions or unresolved_families:
        progress = False

        for family_id in tuple(unresolved_families):
            entry = family_entries[family_id]
            candidate_ids = tuple(entry.get("candidate_ids", ()))
            if any(candidate_id not in function_cache for candidate_id in candidate_ids):
                continue
            family_cache[family_id] = CandidateFamily(
                name=entry["name"],
                inputs=tuple(_deserialize_node(node) for node in entry.get("inputs", ())),
                outputs=tuple(_deserialize_node(node) for node in entry.get("outputs", ())),
                candidates=tuple(function_cache[candidate_id] for candidate_id in candidate_ids),
                policy_hints=_from_jsonable(entry.get("policy_hints", {})),
                tags=tuple(entry.get("tags", ())),
                id=entry["id"],
            )
            unresolved_families.remove(family_id)
            progress = True

        for function_id in tuple(unresolved_functions):
            entry = function_entries[function_id]
            declarations: dict[str, Any] = {}
            ready = True
            for key, value in entry.get("declarations", {}).items():
                if (
                    key == "frame_local_surface"
                    and isinstance(value, dict)
                    and value.get("__kind__") == _FRAME_LOCAL_SURFACE_REF_KIND
                ):
                    graph_function_ids = tuple(value.get("graph_function_ids", ()))
                    candidate_family_ids = tuple(value.get("candidate_family_ids", ()))
                    if any(nested_id not in function_cache for nested_id in graph_function_ids):
                        ready = False
                        break
                    if any(family_id not in family_cache for family_id in candidate_family_ids):
                        ready = False
                        break
                    declarations[key] = Attrs.coerce(
                        {
                            "graph_functions": tuple(
                                function_cache[nested_id]
                                for nested_id in graph_function_ids
                            ),
                            "refinement_boundaries": tuple(
                                _deserialize_refinement_boundary(boundary)
                                for boundary in value.get("refinement_boundaries", ())
                            ),
                            "candidate_families": tuple(
                                family_cache[family_id]
                                for family_id in candidate_family_ids
                            ),
                        }
                    )
                else:
                    declarations[key] = _from_jsonable(value)
            if not ready:
                continue
            function_cache[function_id] = GraphFunction(
                name=entry["name"],
                inputs=tuple(_deserialize_node(node) for node in entry.get("inputs", ())),
                outputs=tuple(_deserialize_node(node) for node in entry.get("outputs", ())),
                environment=EnvRef(
                    requires=tuple(
                        _deserialize_node(node)
                        for node in entry.get("environment", {}).get("requires", ())
                    ),
                    provides=tuple(
                        _deserialize_node(node)
                        for node in entry.get("environment", {}).get("provides", ())
                    ),
                    carries=tuple(
                        _deserialize_node(node)
                        for node in entry.get("environment", {}).get("carries", ())
                    ),
                ),
                template=(
                    _deserialize_graph(entry["template_graph"])
                    if entry.get("template_kind") == "inline_graph"
                    and entry.get("template_graph") is not None
                    else entry.get("template_ref", entry["name"])
                ),
                declarations=Attrs.coerce(declarations),
                tags=tuple(entry.get("tags", ())),
                id=entry["id"],
            )
            unresolved_functions.remove(function_id)
            progress = True

        if not progress:
            raise ValueError(
                "frame traversal surface contains cyclic or unresolved publication references"
            )

    return function_cache, family_cache


def _serialize_vector(vector: GraphVector) -> dict[str, Any]:
    sources = vector.source if isinstance(vector.source, tuple) else (vector.source,)
    return {
        "id": vector.id,
        "name": vector.name,
        "sources": [_serialize_node(node) for node in sources],
        "target": _serialize_node(vector.target),
        "operators": [_serialize_operator(operator) for operator in vector.operators],
        "evaluators": [_serialize_evaluator(evaluator) for evaluator in vector.evaluators],
        "contexts": [_serialize_context(ctx) for ctx in vector.contexts],
        "rule": _serialize_rule(vector.rule),
        "allows_subwork": vector.allows_subwork,
        "declarations": _jsonable(vector.declarations),
        "tags": list(vector.tags),
    }


def _deserialize_vector(data: dict[str, Any]) -> GraphVector:
    sources = tuple(_deserialize_node(item) for item in data.get("sources", ()))
    source: Node | tuple[Node, ...]
    if len(sources) == 1:
        source = sources[0]
    else:
        source = sources
    return GraphVector(
        name=data["name"],
        source=source,
        target=_deserialize_node(data["target"]),
        operators=tuple(_deserialize_operator(item) for item in data.get("operators", ())),
        evaluators=tuple(_deserialize_evaluator(item) for item in data.get("evaluators", ())),
        contexts=tuple(_deserialize_context(item) for item in data.get("contexts", ())),
        rule=_deserialize_rule(data.get("rule")),
        allows_subwork=bool(data.get("allows_subwork", False)),
        declarations=Attrs.coerce(_from_jsonable(data.get("declarations", {}))),
        tags=tuple(data.get("tags", ())),
        id=data["id"],
    )


def _serialize_graph(graph: Graph) -> dict[str, Any]:
    return {
        "id": graph.id,
        "name": graph.name,
        "inputs": [_serialize_node(node) for node in graph.inputs],
        "outputs": [_serialize_node(node) for node in graph.outputs],
        "nodes": [_serialize_node(node) for node in graph.nodes],
        "vectors": [_serialize_vector(vector) for vector in graph.vectors],
        "contexts": [_serialize_context(ctx) for ctx in graph.contexts],
        "rules": [_serialize_rule(rule) for rule in graph.rules],
        "effects": [_jsonable(effect) for effect in graph.effects],
        "tags": list(graph.tags),
    }


def _deserialize_graph(data: dict[str, Any]) -> Graph:
    return Graph(
        name=data["name"],
        inputs=tuple(_deserialize_node(node) for node in data.get("inputs", ())),
        outputs=tuple(_deserialize_node(node) for node in data.get("outputs", ())),
        nodes=tuple(_deserialize_node(node) for node in data.get("nodes", ())),
        vectors=tuple(_deserialize_vector(vector) for vector in data.get("vectors", ())),
        contexts=tuple(_deserialize_context(ctx) for ctx in data.get("contexts", ())),
        rules=tuple(_deserialize_rule(rule) for rule in data.get("rules", ())),
        effects=tuple(_from_jsonable(effect) for effect in data.get("effects", ())),
        tags=tuple(data.get("tags", ())),
        id=data.get("id", ""),
    )


def _serialize_frame_traversal_surface(surface: FrameTraversalSurface | None) -> dict[str, Any] | None:
    if surface is None:
        return None
    registry = _surface_registry(surface)
    return {
        "__kind__": _FRAME_TRAVERSAL_SURFACE_KIND,
        "vectors": [_serialize_vector(vector) for vector in surface.vectors],
        "registry": registry,
        "local_graph_function_ids": [function.id for function in surface.local_graph_functions],
        "local_refinement_boundaries": [
            _serialize_refinement_boundary(boundary)
            for boundary in surface.local_refinement_boundaries
        ],
        "local_candidate_family_ids": [family.id for family in surface.local_candidate_families],
        "imported_refinement_boundaries": [
            _serialize_refinement_boundary(boundary)
            for boundary in surface.imported_refinement_boundaries
        ],
        "imported_candidate_family_ids": [family.id for family in surface.imported_candidate_families],
    }


def _deserialize_frame_traversal_surface(data: dict[str, Any] | None) -> FrameTraversalSurface | None:
    if data is None:
        return None
    if data.get("__kind__") != _FRAME_TRAVERSAL_SURFACE_KIND:
        return FrameTraversalSurface(
            vectors=tuple(_deserialize_vector(vector) for vector in data.get("vectors", ())),
            local_graph_functions=tuple(
                _deserialize_graph_function_summary(function)
                for function in data.get("local_graph_functions", ())
            ),
            local_refinement_boundaries=tuple(
                _deserialize_refinement_boundary(boundary)
                for boundary in data.get("local_refinement_boundaries", ())
            ),
            local_candidate_families=tuple(
                _deserialize_candidate_family(family)
                for family in data.get("local_candidate_families", ())
            ),
            imported_refinement_boundaries=tuple(
                _deserialize_refinement_boundary(boundary)
                for boundary in data.get("imported_refinement_boundaries", ())
            ),
            imported_candidate_families=tuple(
                _deserialize_candidate_family(family)
                for family in data.get("imported_candidate_families", ())
            ),
        )
    function_registry, family_registry = _deserialize_surface_graph_function_registry(
        data.get("registry", {})
    )
    return FrameTraversalSurface(
        vectors=tuple(_deserialize_vector(vector) for vector in data.get("vectors", ())),
        local_graph_functions=tuple(
            function_registry[function_id]
            for function_id in data.get("local_graph_function_ids", ())
        ),
        local_refinement_boundaries=tuple(
            _deserialize_refinement_boundary(boundary)
            for boundary in data.get("local_refinement_boundaries", ())
        ),
        local_candidate_families=tuple(
            family_registry[family_id]
            for family_id in data.get("local_candidate_family_ids", ())
        ),
        imported_refinement_boundaries=tuple(
            _deserialize_refinement_boundary(boundary)
            for boundary in data.get("imported_refinement_boundaries", ())
        ),
        imported_candidate_families=tuple(
            family_registry[family_id]
            for family_id in data.get("imported_candidate_family_ids", ())
        ),
    )


def build_frame_traversal_surface(
    *,
    vectors: tuple[GraphVector, ...],
    module: Module | None = None,
    local_graph_functions: tuple[GraphFunction, ...] = (),
    local_refinement_boundaries: tuple[RefinementBoundary, ...] = (),
    local_candidate_families: tuple[CandidateFamily, ...] = (),
    imported_refinement_boundaries: tuple[RefinementBoundary, ...] = (),
    imported_candidate_families: tuple[CandidateFamily, ...] = (),
) -> FrameTraversalSurface:
    if module is not None:
        imported_refinement_boundaries = module.refinement_boundaries
        imported_candidate_families = module.candidate_families
    return FrameTraversalSurface(
        vectors=tuple(vectors),
        local_graph_functions=tuple(local_graph_functions),
        local_refinement_boundaries=tuple(local_refinement_boundaries),
        local_candidate_families=tuple(local_candidate_families),
        imported_refinement_boundaries=tuple(imported_refinement_boundaries),
        imported_candidate_families=tuple(imported_candidate_families),
    )


def build_frame_traversal_surface_from_graph_function(
    graph_function: GraphFunction,
    *,
    vectors: tuple[GraphVector, ...],
    module: Module | None = None,
) -> FrameTraversalSurface:
    declared = graph_function.declarations.get("frame_local_surface", {})
    declared = _from_jsonable(declared)
    if isinstance(declared, Attrs):
        declared_surface = declared
    else:
        declared_surface = Attrs.coerce(declared)
    local_families = tuple(declared_surface.get("candidate_families", ()))
    declared_boundaries = tuple(declared_surface.get("refinement_boundaries", ()))
    imported_boundaries = module.refinement_boundaries if module is not None else ()
    imported_families = module.candidate_families if module is not None else ()
    return build_frame_traversal_surface(
        vectors=tuple(vectors),
        imported_refinement_boundaries=tuple(imported_boundaries),
        imported_candidate_families=tuple(imported_families),
        local_graph_functions=tuple(declared_surface.get("graph_functions", ())),
        local_refinement_boundaries=declared_boundaries,
        local_candidate_families=local_families,
    )


def validate_frame_selection_surface(surface: FrameTraversalSurface) -> None:
    validate_selection_surface(
        vectors=surface.vectors,
        graph_functions=surface.local_graph_functions,
        candidate_families=surface.local_candidate_families,
    )


def resolve_frame_candidate_family(
    surface: FrameTraversalSurface,
    vector_id: str,
) -> CandidateFamily | None:
    local = resolve_surface_candidate_family(
        vectors=surface.vectors,
        candidate_families=surface.local_candidate_families,
        vector_id=vector_id,
    )
    if local is not None:
        return local
    return resolve_surface_candidate_family(
        vectors=surface.vectors,
        candidate_families=surface.imported_candidate_families,
        vector_id=vector_id,
    )


def resolve_frame_refinement_boundary(
    surface: FrameTraversalSurface,
    vector_id: str,
) -> RefinementBoundary | None:
    local = resolve_surface_refinement_boundary(
        vectors=surface.vectors,
        refinement_boundaries=surface.local_refinement_boundaries,
        vector_id=vector_id,
    )
    if local is not None:
        return local
    return resolve_surface_refinement_boundary(
        vectors=surface.vectors,
        refinement_boundaries=surface.imported_refinement_boundaries,
        vector_id=vector_id,
    )


def validate_frame_traversal_surface(
    surface: FrameTraversalSurface,
    *,
    vector_id: str | None = None,
) -> None:
    validate_frame_selection_surface(surface)
    vectors = surface.vectors
    if vector_id is not None:
        vectors = tuple(vector for vector in surface.vectors if vector.id == vector_id)
        if not vectors:
            raise ValueError(
                f"validate_frame_traversal_surface(): vector {vector_id!r} is not live in the frame surface"
            )
    for vector in vectors:
        resolve_frame_candidate_family(surface, vector.id)
        resolve_frame_refinement_boundary(surface, vector.id)


@dataclass(frozen=True)
class FrameStep:
    frame_id: str
    parent_key: str
    child_key: str
    executable_job: ExecutableJob

    @property
    def edge(self) -> str:
        return self.executable_job.vector.name


@dataclass(frozen=True)
class InvocationFrame:
    frame_id: str
    frame_lineage_id: str
    frame_attempt_id: str
    call_id: str
    parent_key: str
    parent_vector_id: str
    parent_vector: GraphVector
    parent_edge: str
    parent_target: str
    graph_function: str
    materialization_id: str
    graph_name: str
    evaluator_bundle: tuple[str, ...]
    steps: tuple[FrameStep, ...]
    traversal_surface: FrameTraversalSurface | None = None
    graph_function_recursion: Attrs = field(default_factory=Attrs)

    def __post_init__(self) -> None:
        object.__setattr__(self, "graph_function_recursion", Attrs.coerce(self.graph_function_recursion))
        object.__setattr__(self, "evaluator_bundle", tuple(self.evaluator_bundle))
        object.__setattr__(self, "steps", tuple(self.steps))


def _ordered_child_keys(frame: InvocationFrame) -> tuple[str, ...]:
    return tuple(step.child_key for step in frame.steps)


def recursive_state_for_frame(
    frame: InvocationFrame,
    *,
    phase: str,
    pending_child_keys: tuple[str, ...] | None = None,
    completed_child_keys: tuple[str, ...] = (),
    blocked_on: tuple[str, ...] = (),
    active_child_key: str | None = None,
    checkpoint_id: str | None = None,
    suspended: bool = False,
    stack: tuple[InvocationFrame, ...] | None = None,
) -> RecursiveInterpreterState:
    stack = stack or (frame,)
    ordered = _ordered_child_keys(frame)
    completed = tuple(
        child_key
        for child_key in ordered
        if child_key in set(completed_child_keys)
    )
    if pending_child_keys is None:
        pending = tuple(child_key for child_key in ordered if child_key not in set(completed))
    else:
        pending = tuple(
            child_key
            for child_key in ordered
            if child_key in set(pending_child_keys)
        )
    active = active_child_key if active_child_key in ordered else None
    if active is not None:
        next_step_index = ordered.index(active)
    elif pending:
        next_step_index = ordered.index(pending[0])
    else:
        next_step_index = len(ordered)
    return RecursiveInterpreterState(
        root_frame_id=stack[0].frame_id,
        stack=stack,
        continuation=RecursiveContinuation(
            frame_attempt_id=frame.frame_attempt_id,
            phase=phase,
            active_child_key=active,
            next_step_index=next_step_index,
        ),
        frontier=ChildFrontier(
            pending_child_keys=pending,
            completed_child_keys=completed,
            blocked_on=tuple(
                child_key for child_key in ordered if child_key in set(blocked_on)
            ),
        ),
        checkpoint_id=checkpoint_id,
        suspended=suspended,
    )


def open_invocation_frame(
    *,
    call_id: str,
    parent_job: ExecutableJob,
    parent_key: str,
    parent_vector_id: str,
    parent_vector: GraphVector,
    parent_edge: str,
    parent_target: str,
    graph_function: str,
    graph_function_recursion: Attrs | dict | None = None,
    materialization_id: str,
    graph_name: str,
    evaluator_bundle: tuple[str, ...] = (),
    inner_vectors: tuple[GraphVector, ...],
    traversal_surface: FrameTraversalSurface | None = None,
    attempt_nonce: str | None = None,
) -> InvocationFrame:
    frame_lineage_id = _stable_digest(
        {
            "parent_key": parent_key,
            "parent_vector_id": parent_vector_id,
            "graph_function": graph_function,
            "materialization_id": materialization_id,
            "graph_name": graph_name,
        }
    )
    frame_attempt_id = _stable_digest(
        {
            "frame_lineage_id": frame_lineage_id,
            "attempt_nonce": attempt_nonce or uuid.uuid4().hex,
        }
    )
    steps: list[FrameStep] = []
    for index, vector in enumerate(inner_vectors):
        child_key = spawn(parent_key, vector.name)
        job_id = _stable_digest(
            {
                "frame_id": frame_attempt_id,
                "vector_id": vector.id,
                "index": index,
            }
        )
        child_job = Job(
            name=vector.name,
            roles=parent_job.job.roles,
            id=job_id,
        )
        steps.append(
            FrameStep(
                frame_id=frame_attempt_id,
                parent_key=parent_key,
                child_key=child_key,
                executable_job=ExecutableJob(
                    job=child_job,
                    graph_function=None,
                    materialization_id=materialization_id,
                    vector=vector,
                ),
            )
        )
    return InvocationFrame(
        frame_id=frame_attempt_id,
        frame_lineage_id=frame_lineage_id,
        frame_attempt_id=frame_attempt_id,
        call_id=call_id,
        parent_key=parent_key,
        parent_vector_id=parent_vector_id,
        parent_vector=parent_vector,
        parent_edge=parent_edge,
        parent_target=parent_target,
        graph_function=graph_function,
        graph_function_recursion=Attrs.coerce(graph_function_recursion or {}),
        materialization_id=materialization_id,
        graph_name=graph_name,
        evaluator_bundle=tuple(evaluator_bundle),
        steps=tuple(steps),
        traversal_surface=traversal_surface,
    )


def serialize_frame(frame: InvocationFrame) -> dict[str, Any]:
    return {
        "frame_id": frame.frame_id,
        "frame_lineage_id": frame.frame_lineage_id,
        "frame_attempt_id": frame.frame_attempt_id,
        "call_id": frame.call_id,
        "parent_key": frame.parent_key,
        "parent_vector_id": frame.parent_vector_id,
        "parent_vector": _serialize_vector(frame.parent_vector),
        "parent_edge": frame.parent_edge,
        "parent_target": frame.parent_target,
        "graph_function": frame.graph_function,
        "graph_function_recursion": _jsonable(frame.graph_function_recursion.to_dict()),
        "materialization_id": frame.materialization_id,
        "graph_name": frame.graph_name,
        "evaluator_bundle": list(frame.evaluator_bundle),
        "traversal_surface": _serialize_frame_traversal_surface(frame.traversal_surface),
        "steps": [
            {
                "child_key": step.child_key,
                "job_id": step.executable_job.job.id,
                "job_name": step.executable_job.job.name,
                "roles": [_serialize_role(role) for role in step.executable_job.job.roles],
                "vector": _serialize_vector(step.executable_job.vector),
            }
            for step in frame.steps
        ],
    }


def deserialize_frame(data: dict[str, Any]) -> InvocationFrame:
    steps: list[FrameStep] = []
    frame_id = data["frame_id"]
    parent_key = data["parent_key"]
    for item in data.get("steps", ()):
        vector = _deserialize_vector(item["vector"])
        roles = tuple(_deserialize_role(role_data) for role_data in item.get("roles", ()))
        job = Job(
            name=item.get("job_name", vector.name),
            roles=roles,
            id=item["job_id"],
        )
        steps.append(
            FrameStep(
                frame_id=frame_id,
                parent_key=parent_key,
                child_key=item["child_key"],
                executable_job=ExecutableJob(
                    job=job,
                    graph_function=None,
                    materialization_id=data.get("materialization_id"),
                    vector=vector,
                ),
            )
        )
    return InvocationFrame(
        frame_id=frame_id,
        frame_lineage_id=data.get("frame_lineage_id", frame_id),
        frame_attempt_id=data.get("frame_attempt_id", frame_id),
        call_id=data.get("call_id", ""),
        parent_key=parent_key,
        parent_vector_id=data["parent_vector_id"],
        parent_vector=_deserialize_vector(data["parent_vector"]),
        parent_edge=data["parent_edge"],
        parent_target=data["parent_target"],
        graph_function=data["graph_function"],
        graph_function_recursion=Attrs.coerce(_from_jsonable(data.get("graph_function_recursion", {}))),
        materialization_id=data["materialization_id"],
        graph_name=data["graph_name"],
        evaluator_bundle=tuple(data.get("evaluator_bundle", ())),
        steps=tuple(steps),
        traversal_surface=_deserialize_frame_traversal_surface(data.get("traversal_surface")),
    )


def serialize_recursive_continuation(continuation: RecursiveContinuation) -> dict[str, Any]:
    return {
        "frame_attempt_id": continuation.frame_attempt_id,
        "phase": continuation.phase,
        "active_child_key": continuation.active_child_key,
        "next_step_index": continuation.next_step_index,
    }


def deserialize_recursive_continuation(data: dict[str, Any]) -> RecursiveContinuation:
    return RecursiveContinuation(
        frame_attempt_id=data["frame_attempt_id"],
        phase=data.get("phase", "opened"),
        active_child_key=data.get("active_child_key"),
        next_step_index=data.get("next_step_index", 0),
    )


def serialize_child_frontier(frontier: ChildFrontier) -> dict[str, Any]:
    return {
        "pending_child_keys": list(frontier.pending_child_keys),
        "completed_child_keys": list(frontier.completed_child_keys),
        "blocked_on": list(frontier.blocked_on),
    }


def deserialize_child_frontier(data: dict[str, Any]) -> ChildFrontier:
    return ChildFrontier(
        pending_child_keys=tuple(data.get("pending_child_keys", ())),
        completed_child_keys=tuple(data.get("completed_child_keys", ())),
        blocked_on=tuple(data.get("blocked_on", ())),
    )


def serialize_recursive_state(state: RecursiveInterpreterState) -> dict[str, Any]:
    return {
        "root_frame_id": state.root_frame_id,
        "current_frame_id": state.stack[-1].frame_id if state.stack else state.root_frame_id,
        "stack_frame_ids": [frame.frame_id for frame in state.stack],
        "continuation": serialize_recursive_continuation(state.continuation),
        "frontier": serialize_child_frontier(state.frontier),
        "checkpoint_id": state.checkpoint_id,
        "suspended": state.suspended,
    }


def deserialize_recursive_state(
    data: dict[str, Any],
    *,
    frame_lookup: dict[str, InvocationFrame] | None = None,
) -> RecursiveInterpreterState:
    frame_lookup = frame_lookup or {}
    stack = tuple(
        frame_lookup[frame_id]
        for frame_id in data.get("stack_frame_ids", ())
        if frame_id in frame_lookup
    )
    return RecursiveInterpreterState(
        root_frame_id=data["root_frame_id"],
        stack=stack,
        continuation=deserialize_recursive_continuation(data.get("continuation", {})),
        frontier=deserialize_child_frontier(data.get("frontier", {})),
        checkpoint_id=data.get("checkpoint_id"),
        suspended=bool(data.get("suspended", False)),
    )

def frame_opened_event(frame: InvocationFrame) -> dict[str, Any]:
    return {
        "event_type": "frame_opened",
        "data": serialize_frame(frame),
    }


def frame_spawn_events(frame: InvocationFrame) -> list[dict[str, Any]]:
    return [
        {
            "event_type": "work_spawned",
            "data": {
                "call_id": frame.call_id,
                "frame_id": frame.frame_id,
                "frame_lineage_id": frame.frame_lineage_id,
                "frame_attempt_id": frame.frame_attempt_id,
                "parent_key": frame.parent_key,
                "child_key": step.child_key,
                "graph_function": frame.graph_function,
                "edge": step.edge,
            },
        }
        for step in frame.steps
    ]


def frame_step_started_event(frame: InvocationFrame, step: FrameStep, *, run_id: str | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {
        "call_id": frame.call_id,
        "frame_id": frame.frame_id,
        "frame_lineage_id": frame.frame_lineage_id,
        "frame_attempt_id": frame.frame_attempt_id,
        "parent_key": frame.parent_key,
        "child_key": step.child_key,
        "edge": step.edge,
        "graph_function": frame.graph_function,
    }
    if run_id is not None:
        data["run_id"] = run_id
    return {
        "event_type": "frame_step_started",
        "data": data,
    }


def frame_step_completed_event(frame: InvocationFrame, step: FrameStep) -> dict[str, Any]:
    return {
        "event_type": "frame_step_completed",
        "data": {
            "call_id": frame.call_id,
            "frame_id": frame.frame_id,
            "frame_lineage_id": frame.frame_lineage_id,
            "frame_attempt_id": frame.frame_attempt_id,
            "parent_key": frame.parent_key,
            "child_key": step.child_key,
            "edge": step.edge,
            "target": step.executable_job.vector.target.name,
        },
    }


def frame_state_updated_event(state: RecursiveInterpreterState) -> dict[str, Any]:
    return {
        "event_type": "frame_state_updated",
        "data": serialize_recursive_state(state),
    }


def frame_suspended_event(
    frame: InvocationFrame,
    state: RecursiveInterpreterState,
    *,
    reason: str | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "call_id": frame.call_id,
        "frame_id": frame.frame_id,
        "frame_lineage_id": frame.frame_lineage_id,
        "frame_attempt_id": frame.frame_attempt_id,
        "parent_key": frame.parent_key,
        "edge": frame.parent_edge,
        "phase": state.continuation.phase,
        "active_child_key": state.continuation.active_child_key,
        "blocked_on": list(state.frontier.blocked_on),
        "checkpoint_id": state.checkpoint_id,
        "suspended": True,
    }
    if reason is not None:
        data["reason"] = reason
    return {
        "event_type": "frame_suspended",
        "data": data,
    }


def frame_resumed_event(
    frame: InvocationFrame,
    state: RecursiveInterpreterState,
    *,
    reason: str | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "call_id": frame.call_id,
        "frame_id": frame.frame_id,
        "frame_lineage_id": frame.frame_lineage_id,
        "frame_attempt_id": frame.frame_attempt_id,
        "parent_key": frame.parent_key,
        "edge": frame.parent_edge,
        "phase": state.continuation.phase,
        "active_child_key": state.continuation.active_child_key,
        "blocked_on": list(state.frontier.blocked_on),
        "checkpoint_id": state.checkpoint_id,
        "suspended": False,
    }
    if reason is not None:
        data["reason"] = reason
    return {
        "event_type": "frame_resumed",
        "data": data,
    }


def foldback_opened_event(frame: InvocationFrame) -> dict[str, Any]:
    return {
        "event_type": "foldback_opened",
        "data": {
            "call_id": frame.call_id,
            "frame_id": frame.frame_id,
            "frame_lineage_id": frame.frame_lineage_id,
            "frame_attempt_id": frame.frame_attempt_id,
            "parent_key": frame.parent_key,
            "edge": frame.parent_edge,
            "graph_function": frame.graph_function,
            "child_keys": [step.child_key for step in frame.steps],
        },
    }


def frame_rebound_event(frame: InvocationFrame, result: ParentRebindResult | None = None) -> dict[str, Any]:
    payload = {
        "call_id": frame.call_id,
        "frame_id": frame.frame_id,
        "frame_lineage_id": frame.frame_lineage_id,
        "frame_attempt_id": frame.frame_attempt_id,
        "parent_key": frame.parent_key,
        "edge": frame.parent_edge,
        "graph_function": frame.graph_function,
        "rebound": True,
        "reason": "parent must be re-evaluated after lawful fold-back absorption",
    }
    if result is not None:
        payload["rebound"] = result.rebound
        payload["reason"] = result.reason
        if result.payload:
            payload["payload"] = result.payload.to_dict()
    return {
        "event_type": "frame_rebound",
        "data": payload,
    }


def frame_closed_event(frame: InvocationFrame) -> dict[str, Any]:
    return {
        "event_type": "frame_closed",
        "data": {
            "call_id": frame.call_id,
            "frame_id": frame.frame_id,
            "frame_lineage_id": frame.frame_lineage_id,
            "frame_attempt_id": frame.frame_attempt_id,
            "call_id": frame.call_id,
            "parent_key": frame.parent_key,
            "edge": frame.parent_edge,
            "target": frame.parent_target,
            "graph_function": frame.graph_function,
        },
    }


def _reset_applies_to_frame(reset_event: dict[str, Any], frame: InvocationFrame) -> bool:
    data = reset_event.get("data", {})
    scope = data.get("scope")
    if scope == "workspace":
        return True
    if scope == "work_key":
        reset_key = data.get("work_key")
        if reset_key is None:
            return False
        return frame.parent_key == reset_key or frame.parent_key.startswith(reset_key + "/")
    if scope == "edge":
        reset_edge = data.get("edge")
        reset_key = data.get("work_key")
        if reset_edge is not None and reset_edge != frame.parent_edge:
            return False
        if reset_key is None:
            return True
        return frame.parent_key == reset_key or frame.parent_key.startswith(reset_key + "/")
    return False


def _closed_state(frame: InvocationFrame, prior_state: RecursiveInterpreterState | None) -> RecursiveInterpreterState:
    return recursive_state_for_frame(
        frame,
        phase="closed",
        pending_child_keys=(),
        completed_child_keys=_ordered_child_keys(frame),
        blocked_on=(),
        active_child_key=None,
        checkpoint_id=prior_state.checkpoint_id if prior_state else None,
        suspended=False,
        stack=prior_state.stack if prior_state and prior_state.stack else (frame,),
    )


def _new_recursive_frame_index() -> RecursiveFrameIndex:
    return RecursiveFrameIndex()


def _apply_frame_event(index: RecursiveFrameIndex, event: dict[str, Any]) -> None:
    event_type = event.get("event_type")
    data = event.get("data", {})
    if event_type == "frame_opened":
        frame = deserialize_frame(data)
        index.frames_by_id[frame.frame_id] = frame
        index.opened_at[frame.frame_id] = event.get("event_time", "")
        index.closed_frame_ids.discard(frame.frame_id)
        index.stale_frame_ids.discard(frame.frame_id)
        index.states_by_frame_id.setdefault(
            frame.frame_id,
            recursive_state_for_frame(frame, phase="opened"),
        )
        return

    if event_type == "frame_state_updated":
        root_frame_id = data.get("root_frame_id")
        if root_frame_id not in index.frames_by_id:
            return
        state = deserialize_recursive_state(data, frame_lookup=index.frames_by_id)
        if not state.stack:
            current_frame_id = data.get("current_frame_id") or root_frame_id
            current_frame = index.frames_by_id.get(current_frame_id, index.frames_by_id[root_frame_id])
            state = RecursiveInterpreterState(
                root_frame_id=state.root_frame_id,
                stack=(current_frame,),
                continuation=state.continuation,
                frontier=state.frontier,
                checkpoint_id=state.checkpoint_id,
                suspended=state.suspended,
            )
        index.states_by_frame_id[state.stack[-1].frame_id] = state
        return

    if event_type == "frame_closed":
        frame_id = data.get("frame_id")
        if frame_id not in index.frames_by_id:
            return
        index.closed_frame_ids.add(frame_id)
        frame = index.frames_by_id[frame_id]
        index.states_by_frame_id[frame_id] = _closed_state(
            frame,
            index.states_by_frame_id.get(frame_id),
        )
        return

    if event_type != "reset":
        return

    for frame_id, frame in tuple(index.frames_by_id.items()):
        if frame_id in index.closed_frame_ids or frame_id in index.stale_frame_ids:
            continue
        if _reset_applies_to_frame(event, frame):
            index.stale_frame_ids.add(frame_id)


def _frame_index(stream: EventStream) -> RecursiveFrameIndex:
    index = getattr(stream, "_recursive_frame_index", None)
    events = stream.all_events()
    if index is None:
        index = _new_recursive_frame_index()
        setattr(stream, "_recursive_frame_index", index)
    if index.processed_events > len(events):
        index = _new_recursive_frame_index()
        setattr(stream, "_recursive_frame_index", index)
    for event in events[index.processed_events:]:
        _apply_frame_event(index, event)
    index.processed_events = len(events)
    return index


def all_frames(events: list[dict] | EventStream) -> dict[str, InvocationFrame]:
    if isinstance(events, EventStream):
        return dict(_frame_index(events).frames_by_id)
    frames: dict[str, InvocationFrame] = {}
    for event in events:
        if event.get("event_type") == "frame_opened":
            data = event.get("data", {})
            frame_id = data.get("frame_id")
            if frame_id:
                frames[frame_id] = deserialize_frame(data)
    return frames


def _recursive_state_map(
    events: list[dict],
    frames: dict[str, InvocationFrame],
) -> dict[str, RecursiveInterpreterState]:
    states = {
        frame_id: recursive_state_for_frame(frame, phase="opened")
        for frame_id, frame in frames.items()
    }
    for event in events:
        if event.get("event_type") != "frame_state_updated":
            continue
        data = event.get("data", {})
        root_frame_id = data.get("root_frame_id")
        if root_frame_id not in frames:
            continue
        state = deserialize_recursive_state(data, frame_lookup=frames)
        if not state.stack:
            current_frame_id = data.get("current_frame_id") or root_frame_id
            current_frame = frames.get(current_frame_id, frames[root_frame_id])
            state = RecursiveInterpreterState(
                root_frame_id=state.root_frame_id,
                stack=(current_frame,),
                continuation=state.continuation,
                frontier=state.frontier,
                checkpoint_id=state.checkpoint_id,
                suspended=state.suspended,
            )
        states[state.stack[-1].frame_id] = state
    return states


def current_recursive_state(events: list[dict] | EventStream, frame_id: str) -> RecursiveInterpreterState | None:
    if isinstance(events, EventStream):
        index = _frame_index(events)
        frame = index.frames_by_id.get(frame_id)
        if frame is None:
            return None
        state = index.states_by_frame_id.get(frame_id)
        if state is None:
            return recursive_state_for_frame(frame, phase="opened")
        return state
    frames = all_frames(events)
    frame = frames.get(frame_id)
    if frame is None:
        return None
    state = _recursive_state_map(events, frames).get(frame_id)
    if state is None:
        state = recursive_state_for_frame(frame, phase="opened")
    closed = any(
        event.get("event_type") == "frame_closed"
        and event.get("data", {}).get("frame_id") == frame_id
        for event in events
    )
    if closed and state.continuation.phase != "closed":
        state = recursive_state_for_frame(
            frame,
            phase="closed",
            pending_child_keys=(),
            completed_child_keys=_ordered_child_keys(frame),
            blocked_on=(),
            active_child_key=None,
            checkpoint_id=state.checkpoint_id,
            suspended=False,
            stack=state.stack or (frame,),
        )
    return state


def active_recursive_states(events: list[dict] | EventStream) -> tuple[RecursiveInterpreterState, ...]:
    if isinstance(events, EventStream):
        index = _frame_index(events)
        return tuple(
            index.states_by_frame_id.get(frame_id, recursive_state_for_frame(frame, phase="opened"))
            for frame_id, frame in index.frames_by_id.items()
            if frame_id not in index.closed_frame_ids and frame_id not in index.stale_frame_ids
        )
    frames = {frame.frame_id: frame for frame in active_frames(events)}
    if not frames:
        return ()
    return tuple(_recursive_state_map(events, frames).values())


def active_frames(events: list[dict] | EventStream) -> tuple[InvocationFrame, ...]:
    if isinstance(events, EventStream):
        index = _frame_index(events)
        return tuple(
            frame
            for frame_id, frame in index.frames_by_id.items()
            if frame_id not in index.closed_frame_ids and frame_id not in index.stale_frame_ids
        )
    frames = all_frames(events)
    stale: set[str] = set()
    for frame_id, frame in tuple(frames.items()):
        reset = find_latest_reset(events, edge=frame.parent_edge, work_key=frame.parent_key)
        if reset is None:
            continue
        opened_at = next(
            (
                event.get("event_time", "")
                for event in events
                if event.get("event_type") == "frame_opened"
                and event.get("data", {}).get("frame_id") == frame_id
            ),
            "",
        )
        if opened_at and opened_at <= reset.get("event_time", ""):
            stale.add(frame_id)
    for frame_id in stale:
        del frames[frame_id]
    for event in events:
        if event.get("event_type") == "frame_closed":
            frame_id = event.get("data", {}).get("frame_id")
            if frame_id in frames:
                del frames[frame_id]
    return tuple(frames.values())


def find_active_frame(events: list[dict] | EventStream, work_key: str | None) -> tuple[InvocationFrame, FrameStep] | None:
    if work_key is None:
        return None
    for state in active_recursive_states(events):
        frame = state.stack[-1] if state.stack else None
        if frame is None:
            continue
        visible = set(state.frontier.pending_child_keys) | set(state.frontier.blocked_on)
        if state.continuation.active_child_key is not None:
            visible.add(state.continuation.active_child_key)
        if not visible:
            visible = set(_ordered_child_keys(frame))
        for step in frame.steps:
            if step.child_key == work_key and step.child_key in visible:
                return frame, step
    return None


def project_frame_events(events: list[dict], frame_id: str) -> dict[str, Any]:
    frames = all_frames(events)
    frame = frames.get(frame_id)
    if frame is None:
        return {
            "asset_type": "frame",
            "instance_id": frame_id,
            "status": "not_started",
            "event_count": 0,
            "child_steps": [],
        }

    reset = find_latest_reset(events, edge=frame.parent_edge, work_key=frame.parent_key)
    opened_at = next(
        (
            event.get("event_time", "")
            for event in events
            if event.get("event_type") == "frame_opened"
            and event.get("data", {}).get("frame_id") == frame_id
        ),
        "",
    )
    if reset is not None and opened_at and opened_at <= reset.get("event_time", ""):
        state = current_recursive_state(events, frame_id)
        return {
            "asset_type": "frame",
            "instance_id": frame_id,
            "status": "stale",
            "event_count": 0,
            "frame_lineage_id": frame.frame_lineage_id,
            "frame_attempt_id": frame.frame_attempt_id,
            "call_id": frame.call_id,
            "parent_key": frame.parent_key,
            "parent_edge": frame.parent_edge,
            "graph_function": frame.graph_function,
            "materialization_id": frame.materialization_id,
            "rebound": False,
            "continuation": serialize_recursive_continuation(state.continuation) if state else None,
            "frontier": serialize_child_frontier(state.frontier) if state else None,
            "stack_depth": len(state.stack) if state else 0,
            "checkpoint_id": state.checkpoint_id if state else None,
            "suspended": state.suspended if state else False,
            "traversal_surface": _serialize_frame_traversal_surface(frame.traversal_surface),
            "child_steps": [],
        }

    step_states: list[dict[str, Any]] = []
    event_count = 0
    closed = False
    rebound = False
    for event in events:
        data = event.get("data", {})
        if data.get("frame_id") == frame_id:
            event_count += 1
            if event.get("event_type") == "frame_closed":
                closed = True
            if event.get("event_type") == "frame_rebound":
                rebound = True

    for step in frame.steps:
        status = "not_started"
        for event in events:
            data = event.get("data", {})
            if event.get("event_type") == "frame_step_started":
                if data.get("frame_id") != frame_id or data.get("child_key") != step.child_key:
                    continue
                status = "in_progress"
            if event.get("event_type") == "frame_step_completed":
                if data.get("frame_id") != frame_id or data.get("child_key") != step.child_key:
                    continue
                status = "converged"
            if event.get("event_type") == "edge_converged":
                if data.get("edge") != step.edge or data.get("work_key") != step.child_key:
                    continue
                status = "converged"
        step_states.append(
            {
                "child_key": step.child_key,
                "edge": step.edge,
                "target": step.executable_job.vector.target.name,
                "status": status,
            }
        )

    state = current_recursive_state(events, frame_id)
    return {
        "asset_type": "frame",
        "instance_id": frame_id,
        "status": "closed" if closed else "open",
        "event_count": event_count,
        "frame_lineage_id": frame.frame_lineage_id,
        "frame_attempt_id": frame.frame_attempt_id,
        "call_id": frame.call_id,
        "parent_key": frame.parent_key,
        "parent_edge": frame.parent_edge,
        "graph_function": frame.graph_function,
        "materialization_id": frame.materialization_id,
        "rebound": rebound,
        "continuation": serialize_recursive_continuation(state.continuation) if state else None,
        "frontier": serialize_child_frontier(state.frontier) if state else None,
        "stack_depth": len(state.stack) if state else 0,
        "checkpoint_id": state.checkpoint_id if state else None,
        "suspended": state.suspended if state else False,
        "traversal_surface": _serialize_frame_traversal_surface(frame.traversal_surface),
        "child_steps": step_states,
    }


def project_frame(stream: EventStream, frame_id: str) -> dict[str, Any]:
    return project_frame_events(stream.all_events(), frame_id)

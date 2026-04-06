# Implements: REQ-R-ABG3-INTERPRET
# Implements: REQ-R-ABG3-PROVENANCE
# Implements: REQ-M-GTL3-MAPPING
"""
materialization — Canonical ABG graph-function materialization kernel.

Owns explicit request/record materialization over published GTL module truth.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Literal

from gtl.function_model import GraphFunction
from gtl.graph import Attrs, Graph
from gtl.module_model import Module


BundleKind = Literal["selected_subgraph", "evaluator_bundle", "profile_manifest"]


def _stable_digest(parts: dict) -> str:
    raw = json.dumps(parts, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


@dataclass(frozen=True)
class MaterializationRequest:
    """Explicit runtime request to materialize one published graph function."""
    graph_function: str
    profile: str | None = None
    parameters: Attrs = field(default_factory=Attrs)

    def __post_init__(self) -> None:
        object.__setattr__(self, "parameters", Attrs.coerce(self.parameters))


@dataclass(frozen=True)
class MaterializationRecord:
    """Replayable record of one lawful graph-function materialization."""
    materialization_id: str
    module: str
    graph_function: str
    graph_function_id: str
    template_kind: str
    template_ref: str
    profile: str | None
    parameters: Attrs
    graph: Graph

    def __post_init__(self) -> None:
        object.__setattr__(self, "parameters", Attrs.coerce(self.parameters))


@dataclass(frozen=True)
class CompanionBundle:
    """Graph-derived companion bundle with explicit materialization provenance."""
    kind: BundleKind
    materialization_id: str
    values: Attrs = field(default_factory=Attrs)

    def __post_init__(self) -> None:
        object.__setattr__(self, "values", Attrs.coerce(self.values))


def _resolve_graph_function(
    module: Module,
    name: str,
    *,
    published_graph_functions: tuple[GraphFunction, ...] = (),
) -> GraphFunction:
    by_id: dict[str, GraphFunction] = {}
    for graph_function in published_graph_functions + tuple(module.graph_functions):
        if graph_function.name != name:
            continue
        by_id[graph_function.id] = graph_function
    matches = tuple(by_id.values())
    if len(matches) != 1:
        raise ValueError(
            f"materialize_graph_function(): graph function {name!r} is not uniquely published "
            f"by module {module.name!r}"
        )
    return matches[0]


def materialize_graph_function(
    request: MaterializationRequest,
    module: Module,
    *,
    published_graph_functions: tuple[GraphFunction, ...] = (),
) -> MaterializationRecord:
    """
    Materialize one published GraphFunction from explicit request/module truth.

    Current kernel law is fail-closed on undeclared profiles or structural
    parameters because those surfaces are not yet published by GTL.
    """
    graph_function = _resolve_graph_function(
        module,
        request.graph_function,
        published_graph_functions=published_graph_functions,
    )
    if request.profile is not None:
        raise ValueError(
            "materialize_graph_function(): profiles are not yet declared for canonical GTL publication"
        )
    if len(request.parameters) != 0:
        raise ValueError(
            "materialize_graph_function(): structural parameters are not yet declared for canonical GTL publication"
        )

    graph = graph_function.materialize()
    materialization_id = _stable_digest(
        {
            "module": module.name,
            "graph_function": graph_function.name,
            "template_kind": graph_function.template.kind,
            "template_ref": graph_function.template.ref,
            "profile": request.profile,
            "parameters": request.parameters.to_dict(),
            "graph_name": graph.name,
        }
    )
    return MaterializationRecord(
        materialization_id=materialization_id,
        module=module.name,
        graph_function=graph_function.name,
        graph_function_id=graph_function.id,
        template_kind=graph_function.template.kind,
        template_ref=graph_function.template.ref,
        profile=request.profile,
        parameters=request.parameters,
        graph=graph,
    )


def derive_bundle(record: MaterializationRecord, kind: BundleKind) -> CompanionBundle:
    """Derive a replayable companion bundle from one materialization record."""
    if kind == "selected_subgraph":
        values = Attrs.coerce(
            {
                "graph": record.graph.name,
                "inputs": tuple(node.name for node in record.graph.inputs),
                "outputs": tuple(node.name for node in record.graph.outputs),
                "vectors": tuple(vector.name for vector in record.graph.vectors),
            }
        )
    elif kind == "evaluator_bundle":
        evaluator_names: list[str] = []
        for vector in record.graph.vectors:
            for evaluator in vector.evaluators:
                if evaluator.name not in evaluator_names:
                    evaluator_names.append(evaluator.name)
        values = Attrs.coerce(
            {
                "graph": record.graph.name,
                "vector_count": len(record.graph.vectors),
                "evaluators": tuple(evaluator_names),
            }
        )
    elif kind == "profile_manifest":
        values = Attrs.coerce(
            {
                "module": record.module,
                "graph_function": record.graph_function,
                "template_kind": record.template_kind,
                "template_ref": record.template_ref,
                "profile": record.profile,
                "parameters": record.parameters.to_dict(),
            }
        )
    else:
        raise ValueError(f"derive_bundle(): unsupported bundle kind {kind!r}")
    return CompanionBundle(
        kind=kind,
        materialization_id=record.materialization_id,
        values=values,
    )

# Implements: REQ-L-GTL3-LANGUAGE
# Implements: REQ-L-GTL3-MODULE
"""
gtl.module_model — Publication and import boundary.

Module is the named, composable unit of GTL declarations.
ModuleImport declares cross-module dependencies.

No external dependencies. Dataclasses + stdlib only.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from gtl.graph import Attrs, Graph
from gtl.operator_model import Operator, Evaluator, Rule
from gtl.function_model import GraphFunction, RefinementBoundary, CandidateFamily
from gtl.work_model import Job, Role


def _require_unique_ids(name: str, values: tuple[object, ...]) -> None:
    seen: set[str] = set()
    for value in values:
        value_id = getattr(value, "id", None)
        if not value_id:
            continue
        if value_id in seen:
            raise ValueError(f"Module {name!r} publishes duplicate declaration id {value_id!r}")
        seen.add(value_id)


def _require_unique_names(name: str, label: str, values: tuple[object, ...]) -> None:
    seen: set[str] = set()
    for value in values:
        value_name = getattr(value, "name", None)
        if not value_name:
            continue
        if value_name in seen:
            raise ValueError(f"Module {name!r} publishes duplicate {label} name {value_name!r}")
        seen.add(value_name)


@dataclass(frozen=True)
class ModuleImport:
    """Cross-module import declaration."""
    source: str              # module name
    names: tuple[str, ...] = ()  # imported declaration names
    version: str = ""


@dataclass(frozen=True)
class Module:
    """
    Publication boundary — the named, composable unit of GTL declarations.

    Module is a pure declaration boundary;
    runtime concerns (workers, requirements) belong to ABG.

    metadata: immutable mapping visible to consumers, policy layers,
    and replay surfaces.
    """
    name: str
    graphs: tuple[Graph, ...] = ()
    graph_functions: tuple[GraphFunction, ...] = ()
    refinement_boundaries: tuple[RefinementBoundary, ...] = ()
    candidate_families: tuple[CandidateFamily, ...] = ()
    jobs: tuple[Job, ...] = ()
    roles: tuple[Role, ...] = ()
    operators: tuple[Operator, ...] = ()
    evaluators: tuple[Evaluator, ...] = ()
    rules: tuple[Rule, ...] = ()
    imports: tuple[ModuleImport, ...] = ()
    metadata: Attrs = field(default_factory=Attrs)

    def __post_init__(self) -> None:
        object.__setattr__(self, "metadata", Attrs.coerce(self.metadata))
        object.__setattr__(self, "graphs", tuple(self.graphs))
        object.__setattr__(self, "graph_functions", tuple(self.graph_functions))
        object.__setattr__(self, "refinement_boundaries", tuple(self.refinement_boundaries))
        object.__setattr__(self, "candidate_families", tuple(self.candidate_families))
        object.__setattr__(self, "jobs", tuple(self.jobs))
        object.__setattr__(self, "roles", tuple(self.roles))
        object.__setattr__(self, "operators", tuple(self.operators))
        object.__setattr__(self, "evaluators", tuple(self.evaluators))
        object.__setattr__(self, "rules", tuple(self.rules))
        object.__setattr__(self, "imports", tuple(self.imports))

        published_graph_function_ids = {graph_function.id for graph_function in self.graph_functions}

        _require_unique_ids(self.name, self.graphs)
        _require_unique_ids(self.name, self.graph_functions)
        _require_unique_ids(self.name, self.refinement_boundaries)
        _require_unique_ids(self.name, self.candidate_families)
        _require_unique_ids(self.name, self.jobs)
        _require_unique_ids(self.name, self.roles)
        _require_unique_ids(self.name, self.operators)
        _require_unique_ids(self.name, self.evaluators)
        _require_unique_ids(self.name, self.rules)

        _require_unique_names(self.name, "graph_function", self.graph_functions)
        _require_unique_names(self.name, "job", self.jobs)
        _require_unique_names(self.name, "role", self.roles)
        _require_unique_names(self.name, "refinement_boundary", self.refinement_boundaries)
        _require_unique_names(self.name, "candidate_family", self.candidate_families)

        for job in self.jobs:
            if not job.contracts:
                raise ValueError(
                    f"Module {self.name!r} publishes semantic job {job.name!r} without any graph_function contract"
                )
            for contract in job.contracts:
                if contract.target_id not in published_graph_function_ids:
                    raise ValueError(
                        f"Module {self.name!r} job {job.name!r} targets unpublished graph function id "
                        f"{contract.target_id!r}"
                    )

        for family in self.candidate_families:
            for candidate in family.candidates:
                if candidate.id not in published_graph_function_ids:
                    raise ValueError(
                        f"Module {self.name!r} candidate family {family.name!r} includes unpublished "
                        f"graph function {candidate.name!r}"
                    )

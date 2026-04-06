# Implements: REQ-R-ABG3-SELECTION-APPLICATION
"""
genesis.selection — Candidate enumeration and validation.

Pure kernel module — returns SelectionDecision values.
Event emission delegated to interpret.apply_selection()
(per GTL_3_MODULE_DESIGN).

No side effects, no events, no I/O. Pure functions over current GTL types.
"""
from __future__ import annotations

from dataclasses import dataclass

from gtl.graph import GraphVector, interface_contract, node_contract_key
from gtl.function_model import GraphFunction, RefinementBoundary, CandidateFamily
from gtl.module_model import Module
from .materialization import MaterializationRequest, materialize_graph_function


@dataclass(frozen=True)
class SelectionDecision:
    """Replayable record of a workflow selection."""
    contract_id: str
    work_key: str
    graph_function: str
    selected_by: str
    selection_mode: str
    rationale: str = ""


def _vector_contract(vector: GraphVector) -> tuple[tuple[tuple[str, str, tuple[str, ...]], ...], tuple[tuple[str, str, tuple[str, ...]], ...]]:
    source = vector.source if isinstance(vector.source, tuple) else (vector.source,)
    return interface_contract(source), interface_contract((vector.target,)) if vector.target else ()


def _graph_function_contract(function: GraphFunction) -> tuple[tuple[str, ...], tuple[str, ...]]:
    return interface_contract(function.inputs), interface_contract(function.outputs)


def _resolve_vector(
    vectors: tuple[GraphVector, ...],
    vector_id: str,
) -> GraphVector | None:
    for vector in vectors:
        if vector.id == vector_id:
            return vector
    return None


def resolve_surface_refinement_boundary(
    *,
    vectors: tuple[GraphVector, ...],
    refinement_boundaries: tuple[RefinementBoundary, ...],
    vector_id: str,
    vector: GraphVector | None = None,
) -> RefinementBoundary | None:
    """Resolve one published refinement boundary from any lawful traversal surface."""
    target_vec = vector if vector is not None else _resolve_vector(vectors, vector_id)
    if target_vec is None:
        return None

    vec_inputs, vec_outputs = _vector_contract(target_vec)
    declared = tuple(
        boundary
        for boundary in refinement_boundaries
        if boundary.name == target_vec.name
        and interface_contract(boundary.inputs) == vec_inputs
        and interface_contract(boundary.outputs) == vec_outputs
    )
    if len(declared) > 1:
        raise ValueError(
            f"resolve_surface_refinement_boundary(): ambiguous published refinement boundaries "
            f"for vector {vector_id!r}"
        )
    return declared[0] if declared else None


def resolve_surface_candidate_family(
    *,
    vectors: tuple[GraphVector, ...],
    candidate_families: tuple[CandidateFamily, ...],
    vector_id: str,
    vector: GraphVector | None = None,
) -> CandidateFamily | None:
    """Resolve one published candidate family from any lawful traversal surface."""
    target_vec = vector if vector is not None else _resolve_vector(vectors, vector_id)
    if target_vec is None:
        return None

    vec_inputs, vec_outputs = _vector_contract(target_vec)
    declared = tuple(
        family
        for family in candidate_families
        if interface_contract(family.inputs) == vec_inputs
        and interface_contract(family.outputs) == vec_outputs
    )
    if len(declared) > 1:
        raise ValueError(
            f"resolve_surface_candidate_family(): ambiguous declared candidate families "
            f"for vector {vector_id!r}"
        )
    return declared[0] if declared else None


def validate_selection_surface(
    *,
    vectors: tuple[GraphVector, ...],
    graph_functions: tuple[GraphFunction, ...],
    candidate_families: tuple[CandidateFamily, ...],
    callable_carrier_ids: frozenset[str] = frozenset(),
) -> None:
    """Fail closed when a traversal surface hides structural alternatives outside CandidateFamily.

    If a GraphFunction matches the outer contract of a live GraphVector, that
    alternative must be published through CandidateFamily. The engine must not
    infer selection topology from raw graph_functions.

    Public callable carrier graph functions already bound by GTL semantic jobs
    are excluded from this hidden-alternative check. They are callable carriers,
    not undeclared selection alternatives.
    """
    family_contracts = {
        (interface_contract(family.inputs), interface_contract(family.outputs))
        for family in candidate_families
    }

    vector_contracts = {
        _vector_contract(vector)
        for vector in vectors
    }

    hidden_contracts = {
        _graph_function_contract(function)
        for function in graph_functions
        if function.id not in callable_carrier_ids
        if _graph_function_contract(function) in vector_contracts
        and _graph_function_contract(function) not in family_contracts
    }
    if hidden_contracts:
        rendered = ", ".join(
            f"{list(inputs)}->{list(outputs)}"
            for inputs, outputs in sorted(hidden_contracts)
        )
        raise ValueError(
            "validate_selection_surface(): graph_functions matching live "
            f"vector contracts must be published via CandidateFamily; "
            f"hidden contracts: {rendered}"
        )


def validate_module_selection_surface(module: Module) -> None:
    """Fail closed when a module hides structural alternatives outside CandidateFamily."""
    callable_carrier_ids = frozenset(
        ref.target_id
        for job in module.jobs
        for ref in job.contracts
        if ref.kind == "graph_function"
    )
    validate_selection_surface(
        vectors=tuple(vector for graph in module.graphs for vector in graph.vectors),
        graph_functions=module.graph_functions,
        candidate_families=module.candidate_families,
        callable_carrier_ids=callable_carrier_ids,
    )


def validate_job_callable_vectors_are_published(module: Module) -> None:
    """Fail closed when a job-bound public carrier is absent from Module.graphs."""
    published_vectors = tuple(vector for graph in module.graphs for vector in graph.vectors)
    published_keys = {
        (
            vector.name,
            interface_contract(vector.source if isinstance(vector.source, tuple) else (vector.source,)),
            interface_contract((vector.target,)),
        )
        for vector in published_vectors
    }

    graph_function_by_id = {graph_function.id: graph_function for graph_function in module.graph_functions}
    missing: list[str] = []
    for job in module.jobs:
        for contract in job.contracts:
            if contract.kind != "graph_function":
                continue
            graph_function = graph_function_by_id.get(contract.target_id)
            if graph_function is None:
                continue
            record = materialize_graph_function(
                MaterializationRequest(graph_function=graph_function.name),
                module,
                published_graph_functions=(graph_function,),
            )
            for vector in record.graph.vectors:
                vector_key = (
                    vector.name,
                    interface_contract(vector.source if isinstance(vector.source, tuple) else (vector.source,)),
                    interface_contract((vector.target,)),
                )
                if vector_key not in published_keys:
                    missing.append(f"{graph_function.name}:{vector.name}")
    if missing:
        raise ValueError(
            "validate_job_callable_vectors_are_published(): job-bound public carriers "
            f"must publish their materialized vectors through Module.graphs; missing: {sorted(missing)}"
        )


def resolve_refinement_boundary(
    module: Module,
    vector_id: str,
    *,
    vector: GraphVector | None = None,
) -> RefinementBoundary | None:
    """Resolve the published refinement boundary for a live vector."""
    return resolve_surface_refinement_boundary(
        vectors=tuple(vector for graph in module.graphs for vector in graph.vectors),
        refinement_boundaries=module.refinement_boundaries,
        vector_id=vector_id,
        vector=vector,
    )


def validate_traversal_surface(
    *,
    vectors: tuple[GraphVector, ...],
    refinement_boundaries: tuple[RefinementBoundary, ...],
    candidate_families: tuple[CandidateFamily, ...],
) -> None:
    """Fail closed when a live vector has no published traversal target."""
    missing: list[str] = []
    for vector in vectors:
        if (
            resolve_surface_refinement_boundary(
                vectors=vectors,
                refinement_boundaries=refinement_boundaries,
                vector_id=vector.id,
            ) is None
            and resolve_surface_candidate_family(
                vectors=vectors,
                candidate_families=candidate_families,
                vector_id=vector.id,
            ) is None
        ):
            missing.append(vector.name)
    if missing:
        raise ValueError(
            "validate_traversal_surface(): every live graph vector must publish "
            f"a RefinementBoundary or CandidateFamily; missing: {sorted(missing)}"
        )


def validate_module_traversal_surface(module: Module) -> None:
    """Fail closed when a live vector has no published traversal target."""
    validate_traversal_surface(
        vectors=tuple(vector for graph in module.graphs for vector in graph.vectors),
        refinement_boundaries=module.refinement_boundaries,
        candidate_families=module.candidate_families,
    )


def resolve_candidate_family(
    module: Module,
    vector_id: str,
    *,
    vector: GraphVector | None = None,
) -> CandidateFamily | None:
    """Resolve the canonical candidate family for a vector.

    Returns one explicitly declared Module.candidate_families match, or None.
    Fails closed on ambiguous declared families.
    """
    return resolve_surface_candidate_family(
        vectors=tuple(vector for graph in module.graphs for vector in graph.vectors),
        candidate_families=module.candidate_families,
        vector_id=vector_id,
        vector=vector,
    )


def validate_selection(
    decision: SelectionDecision,
    candidate: GraphFunction,
    vector: GraphVector,
) -> bool:
    """
    Validate that a SelectionDecision is interface-compatible.

    Checks:
    - decision.graph_function matches candidate.name
    - decision.contract_id matches vector.id (REQ-L-GTL3-IDENTITY-006)
    - candidate interface satisfies vector (same rules as enumerate_candidates)
    """
    if decision.graph_function != candidate.name:
        return False
    if decision.contract_id != vector.id:
        return False

    if isinstance(vector.source, tuple):
        vec_source_contracts = {node_contract_key(node) for node in vector.source}
    else:
        vec_source_contracts = {node_contract_key(vector.source)}
    vec_target_contract = node_contract_key(vector.target)

    gf_input_contracts = {node_contract_key(node) for node in candidate.inputs}
    gf_output_contracts = {node_contract_key(node) for node in candidate.outputs}

    return gf_input_contracts <= vec_source_contracts and vec_target_contract in gf_output_contracts


# ── CandidateFamily-based selection ──────────────────────────────────────────


def enumerate_candidates(
    family: CandidateFamily,
) -> tuple[GraphFunction, ...]:
    """Enumerate lawful candidates from one explicit candidate family."""
    return family.candidates


def accept_selection(
    family: CandidateFamily,
    candidate: GraphFunction,
    *,
    contract_id: str,
    work_key: str,
    selected_by: str,
    selection_mode: str,
    rationale: str = "",
) -> SelectionDecision:
    """Validate that candidate belongs to family and satisfies the family contract.

    REQ-R-ABG3-SELECTION-APPLICATION-003: validate interface compatibility.
    REQ-R-ABG3-SELECTION-APPLICATION-005: validate family membership.
    """
    # Membership check — by identity
    if not any(c.id == candidate.id for c in family.candidates):
        raise ValueError(
            f"accept_selection(): candidate {candidate.name!r} not in family "
            f"{family.name!r}"
        )

    # Interface check — candidate must satisfy family contract
    family_in = interface_contract(family.inputs)
    family_out = interface_contract(family.outputs)
    cand_in = interface_contract(candidate.inputs)
    cand_out = interface_contract(candidate.outputs)
    if cand_in != family_in or cand_out != family_out:
        raise ValueError(
            f"accept_selection(): candidate {candidate.name!r} interface "
            f"({sorted(cand_in)}->{sorted(cand_out)}) does not match family contract "
            f"({sorted(family_in)}->{sorted(family_out)})"
        )

    return SelectionDecision(
        contract_id=contract_id,
        work_key=work_key,
        graph_function=candidate.name,
        selected_by=selected_by,
        selection_mode=selection_mode,
        rationale=rationale,
    )

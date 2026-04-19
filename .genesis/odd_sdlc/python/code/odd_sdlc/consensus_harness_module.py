# Implements: REQ-F-GFUNC-004
# Implements: REQ-F-ODDSDLC-004
"""Standalone consensus-harness module for odd_sdlc sandbox qualification."""
from __future__ import annotations

from gtl.algebra import compose, recurse
from gtl.function_model import RefinementBoundary
from gtl.graph import Attrs
from gtl.module_model import Module
from gtl.work_model import ContractRef, Job, Role

from .gtl_module import (
    GF_APPLY_DESIGN_CONSENSUS_DECISION,
    GF_REDUCE_DESIGN_CONSENSUS_DECISION,
    GF_REVIEW_DESIGN_ASSESSMENT_ROUND,
    GF_REVIEW_DESIGN_BY_CONSENSUS,
    _design_consensus_termination,
)


_ROLE_CONSTRUCTOR = Role(name="constructor", tags=("f_p", "consensus"))

_COMPILED_HARNESS_GRAPH = recurse(
    compose(
        GF_REVIEW_DESIGN_ASSESSMENT_ROUND,
        GF_REDUCE_DESIGN_CONSENSUS_DECISION,
        GF_APPLY_DESIGN_CONSENSUS_DECISION,
    ),
    _design_consensus_termination,
    foldback={"mode": "rebind", "binding": "reviewed_design_surface", "requires_parent_evaluation": True},
).materialize()

MODULE = Module(
    name="odd_sdlc_consensus_harness",
    graphs=(_COMPILED_HARNESS_GRAPH,),
    graph_functions=(
        GF_REVIEW_DESIGN_BY_CONSENSUS,
        GF_REVIEW_DESIGN_ASSESSMENT_ROUND,
        GF_REDUCE_DESIGN_CONSENSUS_DECISION,
        GF_APPLY_DESIGN_CONSENSUS_DECISION,
    ),
    refinement_boundaries=tuple(
        RefinementBoundary(
            name=vector.name,
            inputs=vector.source if isinstance(vector.source, tuple) else (vector.source,),
            outputs=(vector.target,),
            hints=Attrs(entries=(("terminal", True),)),
        )
        for vector in _COMPILED_HARNESS_GRAPH.vectors
    ),
    jobs=(
        Job(
            name="review_design_by_consensus_job",
            contracts=(ContractRef(kind="graph_function", target_id=GF_REVIEW_DESIGN_BY_CONSENSUS.id),),
            roles=(_ROLE_CONSTRUCTOR,),
        ),
    ),
    roles=(_ROLE_CONSTRUCTOR,),
    metadata=Attrs(
        entries=(
            ("requirements", ("REQ-F-GFUNC-004", "REQ-F-ODDSDLC-004")),
            ("domain_package", "odd_sdlc"),
            ("shared_plugin_graph_function", "review_subject_by_consensus"),
            ("host_binding_graph_function", GF_REVIEW_DESIGN_BY_CONSENSUS.name),
            (
                "injected_graph_functions",
                (
                    GF_REVIEW_DESIGN_ASSESSMENT_ROUND.name,
                    GF_REDUCE_DESIGN_CONSENSUS_DECISION.name,
                    GF_APPLY_DESIGN_CONSENSUS_DECISION.name,
                ),
            ),
        )
    ),
)

# Implements: REQ-F-GFUNC-004
# Implements: REQ-F-ODDSDLC-004
"""Standalone consensus-round module for odd_sdlc sandbox qualification."""
from __future__ import annotations

from gtl.function_model import RefinementBoundary
from gtl.graph import Attrs
from gtl.module_model import Module
from gtl.work_model import ContractRef, Job, Role

from .gtl_module import GF_REVIEW_DESIGN_CONSENSUS_ROUND


_ROLE_CONSTRUCTOR = Role(name="constructor", tags=("f_p", "consensus"))

MODULE = Module(
    name="odd_sdlc_consensus_round",
    graphs=tuple(
        function.template.graph
        for function in (GF_REVIEW_DESIGN_CONSENSUS_ROUND,)
        if function.template.graph is not None
    ),
    graph_functions=(GF_REVIEW_DESIGN_CONSENSUS_ROUND,),
    refinement_boundaries=tuple(
        RefinementBoundary(
            name=vector.name,
            inputs=vector.source if isinstance(vector.source, tuple) else (vector.source,),
            outputs=(vector.target,),
            hints=Attrs(entries=(("terminal", True),)),
        )
        for vector in GF_REVIEW_DESIGN_CONSENSUS_ROUND.materialize().vectors
    ),
    jobs=(
        Job(
            name="review_design_consensus_round_job",
            contracts=(ContractRef(kind="graph_function", target_id=GF_REVIEW_DESIGN_CONSENSUS_ROUND.id),),
            roles=(_ROLE_CONSTRUCTOR,),
        ),
    ),
    roles=(_ROLE_CONSTRUCTOR,),
    metadata=Attrs(
        entries=(
            ("requirements", ("REQ-F-GFUNC-004", "REQ-F-ODDSDLC-004")),
            ("domain_package", "odd_sdlc"),
            ("shared_plugin_graph_function", "review_subject_consensus_round"),
            ("host_binding_graph_function", GF_REVIEW_DESIGN_CONSENSUS_ROUND.name),
        )
    ),
)

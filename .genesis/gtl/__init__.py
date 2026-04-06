"""
GTL — Genesis Topology Language.

    gtl.graph          — Graph, Node, GraphVector, Context, Attr, Attrs
    gtl.operator_model — Regime, F_D, F_P, F_H, Operator, Evaluator, Rule
    gtl.function_model — EnvRef, GraphFunction, RefinementBoundary, CandidateFamily
    gtl.work_model     — ContractRef, Role, Job
    gtl.module_model   — Module, ModuleImport
    gtl.algebra        — edge, compose, substitute, identity, recurse,
                         fan_out, fan_in, gate, promote,
                         deferred_refinement, candidate_family

Prime GTL surface: Context, Node, Graph, GraphFunction, RefinementBoundary,
CandidateFamily, Operator, Evaluator, Rule, Job, Role, Module.
ContractRef, ModuleImport, Attr, Attrs, and TemplateRef are structural helpers.
"""
from .graph import Attr, Attrs, Graph, Node, GraphVector, Context
from .operator_model import (
    Regime, F_D, F_P, F_H,
    Operator, Evaluator, Rule,
)
from .function_model import CandidateFamily, EnvRef, GraphFunction, RefinementBoundary, TemplateRef
from .work_model import ContractRef, Role, Job
from .module_model import Module, ModuleImport

__all__ = [
    # Graph structure (prime)
    "Attr", "Attrs", "Graph", "Node", "GraphVector", "Context",
    # Operator model (prime)
    "Regime", "F_D", "F_P", "F_H",
    "Operator", "Evaluator", "Rule",
    # Function model (prime)
    "EnvRef", "GraphFunction", "RefinementBoundary", "CandidateFamily", "TemplateRef",
    # Work model (prime)
    "ContractRef", "Role", "Job",
    # Module model (prime)
    "Module", "ModuleImport",
]

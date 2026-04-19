# Implements: REQ-F-GFUNC-001
# Implements: REQ-F-GFUNC-004
# Implements: REQ-F-ASSET-001
# Implements: REQ-F-ASSET-002
# Implements: REQ-F-ASSET-003
# Implements: REQ-F-ASSET-004
# Implements: REQ-F-ASSETMODEL-004
# Implements: REQ-F-ODDSDLC-002
# Implements: REQ-F-ODDSDLC-025
# Implements: REQ-F-ODDSDLC-026
# Implements: REQ-F-ODDSDLC-031
"""Published GTL module for the active odd_sdlc proving subset."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from gtl.algebra import compose, recurse
from gtl.function_model import EnvRef, GraphFunction, RefinementBoundary
from gtl.graph import Attrs, Context, Graph, GraphVector, Node
from gtl.module_model import Module
from gtl.operator_model import Evaluator, Rule, F_D, F_H, F_P, Operator
from gtl.work_model import ContractRef, Job, Role

from .ambiguity import load_or_build_ambiguity_register
from .fd_contracts import fd_binding, fd_contract
from .function_catalog import FUNCTION_CATALOG
from .project_profile import PROJECT_CONSTRAINTS_PATH, load_project_profile
from .runtime_contexts import (
    REALIZATION_DEEPENING_CONTEXT_PATH as _REALIZATION_DEEPENING_CONTEXT_PATH,
    REALIZED_TEST_SOURCE_CONTEXT_PATH as _REALIZED_TEST_SOURCE_CONTEXT_PATH,
    STATEFUL_ITERATOR_CONTROL_CONTEXT_PATH as _STATEFUL_ITERATOR_CONTROL_CONTEXT_PATH,
)
from .traceability import (
    REQUIREMENT_CLOSURE_PROMPT_CONTEXT_PATH,
)


def _obligation_ledger_declaration(
    *,
    signal_key: str,
    adapter_ref: str,
    obligation_source_ref: str,
    obligation_source_kind: str,
    obligation_source_admission_basis: str,
    obligation_kind: str,
    derivation_rule: str,
    carry_rule: str,
    fulfillment_rule: str,
    evidence_policy: str,
) -> Attrs:
    return Attrs(
        entries=(
            ("signal_key", signal_key),
            ("adapter_ref", adapter_ref),
            ("obligation_source_ref", obligation_source_ref),
            ("obligation_source_kind", obligation_source_kind),
            ("obligation_source_admission_basis", obligation_source_admission_basis),
            ("obligation_kind", obligation_kind),
            ("derivation_rule", derivation_rule),
            ("carry_rule", carry_rule),
            ("fulfillment_rule", fulfillment_rule),
            ("evidence_policy", evidence_policy),
        )
    )


def _requirement_edge_obligation_ledger(
    *,
    signal_key: str,
    fulfillment_rule: str,
    evidence_policy: str,
    obligation_source_ref: str = "requirement_surface",
    obligation_source_kind: str = "requirement_surface",
    obligation_source_admission_basis: str = "authority_or_current_surface",
    obligation_kind: str = "requirement",
    derivation_rule: str = "identity",
    carry_rule: str = "deterministic_requirement_membership",
) -> Attrs:
    return _obligation_ledger_declaration(
        signal_key=signal_key,
        adapter_ref="odd_sdlc.traceability:declared_requirement_edge_gap",
        obligation_source_ref=obligation_source_ref,
        obligation_source_kind=obligation_source_kind,
        obligation_source_admission_basis=obligation_source_admission_basis,
        obligation_kind=obligation_kind,
        derivation_rule=derivation_rule,
        carry_rule=carry_rule,
        fulfillment_rule=fulfillment_rule,
        evidence_policy=evidence_policy,
    )


def _asset_node(
    name: str,
    schema: str,
    *,
    kind: str,
    required_contexts: tuple[str, ...] = (),
    output_contract_refs: tuple[str, ...] = (),
) -> Node:
    return Node(
        name,
        schema=schema,
        asset_surface={
            "kind": kind,
            "required_contexts": required_contexts,
            "output_contract_refs": output_contract_refs,
        },
    )


_input_set = _asset_node(
    "input_set",
    schema="odd.asset_collection.bootstrap_input_set",
    kind="bootstrap_input_set",
    output_contract_refs=("bootstrap_input_set_present",),
)
_intent_surface = _asset_node(
    "intent_surface",
    schema="odd.asset.intent_doc",
    kind="intent_doc",
    required_contexts=("input_set",),
    output_contract_refs=("single_authoritative_intent_surface",),
)
_product_surface = _asset_node(
    "product_surface",
    schema="odd.asset.product_doc",
    kind="product_doc",
    required_contexts=("input_set", "intent_surface"),
    output_contract_refs=("single_authoritative_product_surface",),
)
_goal_surface = _asset_node(
    "goal_surface",
    schema="odd.asset.goal_surface",
    kind="goal_surface",
    required_contexts=("input_set", "intent_surface", "product_surface"),
    output_contract_refs=("single_authoritative_goal_surface",),
)
_requirement_surface = _asset_node(
    "requirement_surface",
    schema="odd.asset.requirement_surface",
    kind="requirement_surface",
    required_contexts=("input_set", "intent_surface", "product_surface", "goal_surface"),
    output_contract_refs=("requirement_family_surface_present",),
)
_feature_decomp_surface = _asset_node(
    "feature_decomp_surface",
    schema="odd.asset.feature_decomp_surface",
    kind="feature_decomp_surface",
    required_contexts=("requirement_surface",),
    output_contract_refs=("feature_decomposition_surface_present",),
)
_uat_testcases_surface = _asset_node(
    "uat_testcases_surface",
    schema="odd.asset.uat_testcases_surface",
    kind="uat_testcases_surface",
    required_contexts=("requirement_surface",),
    output_contract_refs=("uat_testcase_surface_present",),
)
_design_surface = _asset_node(
    "design_surface",
    schema="odd.asset.design_surface",
    kind="design_surface",
    required_contexts=("requirement_surface", "feature_decomp_surface"),
    output_contract_refs=("design_surface_present",),
)
_subject_surface = _asset_node(
    "subject_surface",
    schema="odd.asset.subject_surface",
    kind="review_subject_surface",
    output_contract_refs=("review_subject_surface_present",),
)
_comment_review_subject_surface = _asset_node(
    "comment_review_subject_surface",
    schema="odd.asset.comment_review_subject_surface",
    kind="review_subject_surface",
    output_contract_refs=("review_subject_surface_present",),
)
_review_assessment_surface = _asset_node(
    "review_assessment_surface",
    schema="odd.asset.review_assessment_surface",
    kind="review_assessment_surface",
    required_contexts=("design_surface",),
    output_contract_refs=("review_assessment_surface_present",),
)
_consensus_decision_surface = _asset_node(
    "consensus_decision_surface",
    schema="odd.asset.consensus_decision_surface",
    kind="consensus_decision_surface",
    required_contexts=("review_assessment_surface",),
    output_contract_refs=("consensus_decision_surface_present",),
)
_reviewed_design_surface = _asset_node(
    "reviewed_design_surface",
    schema="odd.asset.reviewed_design_surface",
    kind="reviewed_design_surface",
    required_contexts=("design_surface", "consensus_decision_surface"),
    output_contract_refs=("reviewed_design_surface_present",),
)
_reviewed_subject_surface = _asset_node(
    "reviewed_subject_surface",
    schema="odd.asset.reviewed_subject_surface",
    kind="reviewed_subject_surface",
    required_contexts=("subject_surface", "consensus_decision_surface"),
    output_contract_refs=("reviewed_subject_surface_present",),
)
_reviewed_comment_surface = _asset_node(
    "reviewed_comment_surface",
    schema="odd.asset.reviewed_comment_surface",
    kind="reviewed_subject_surface",
    required_contexts=("comment_review_subject_surface", "consensus_decision_surface"),
    output_contract_refs=("reviewed_subject_surface_present",),
)
_testcase_authority_surface = _asset_node(
    "testcase_authority_surface",
    schema="odd.asset.testcase_authority_surface",
    kind="testcase_authority_surface",
    required_contexts=("uat_testcases_surface", "scenario_surface"),
    output_contract_refs=("testcase_authority_surface_present",),
)
_scenario_surface = _asset_node(
    "scenario_surface",
    schema="odd.asset.scenario_surface",
    kind="scenario_surface",
    required_contexts=("requirement_surface", "design_surface"),
    output_contract_refs=("scenario_surface_present",),
)
_implementation_design_surface = _asset_node(
    "implementation_design_surface",
    schema="odd.asset.implementation_design_surface",
    kind="implementation_design_surface",
    required_contexts=("requirement_surface", "design_surface", "scenario_surface"),
    output_contract_refs=("implementation_design_surface_present",),
)
_implementation_stack_profile = _asset_node(
    "implementation_stack_profile",
    schema="odd.asset.implementation_stack_profile",
    kind="implementation_stack_profile",
    required_contexts=("implementation_design_surface",),
    output_contract_refs=("implementation_stack_profile_present",),
)
_implementation_module_surface = _asset_node(
    "implementation_module_surface",
    schema="odd.asset.implementation_module_surface",
    kind="implementation_module_surface",
    required_contexts=("requirement_surface", "implementation_design_surface", "implementation_stack_profile"),
    output_contract_refs=("implementation_module_surface_present",),
)
_code_surface = _asset_node(
    "code_surface",
    schema="odd.asset.code_surface",
    kind="code_surface",
    required_contexts=("requirement_surface", "implementation_module_surface", "implementation_stack_profile"),
    output_contract_refs=("published_source_code_surface",),
)
_test_design_surface = _asset_node(
    "test_design_surface",
    schema="odd.asset.test_design_surface",
    kind="test_design_surface",
    required_contexts=("requirement_surface", "design_surface", "scenario_surface"),
    output_contract_refs=("test_design_surface_present",),
)
_test_stack_profile = _asset_node(
    "test_stack_profile",
    schema="odd.asset.test_stack_profile",
    kind="test_stack_profile",
    required_contexts=("test_design_surface", "implementation_design_surface", "implementation_stack_profile"),
    output_contract_refs=("test_stack_profile_present",),
)
_test_module_surface = _asset_node(
    "test_module_surface",
    schema="odd.asset.test_module_surface",
    kind="test_module_surface",
    required_contexts=("requirement_surface", "test_design_surface", "test_stack_profile", "implementation_module_surface"),
    output_contract_refs=("test_module_surface_present",),
)
_test_run_archive_surface = _asset_node(
    "test_run_archive_surface",
    schema="odd.asset.test_run_archive_surface",
    kind="test_run_archive_surface",
    required_contexts=("requirement_surface", "test_module_surface", "test_stack_profile"),
    output_contract_refs=("test_run_archive_surface_present",),
)
_release_surface = _asset_node(
    "release_surface",
    schema="odd.asset.release_surface",
    kind="release_surface",
    required_contexts=(
        "requirement_surface",
        "design_surface",
        "scenario_surface",
        "code_surface",
        "testcase_authority_surface",
        "test_run_archive_surface",
    ),
    output_contract_refs=("release_surface_present",),
)
_build_execution_surface = _asset_node(
    "build_execution_surface",
    schema="odd.asset.build_execution_surface",
    kind="work_request_surface",
    required_contexts=("release_surface",),
    output_contract_refs=("build_execution_surface_present",),
)
_build_execution_result_surface = _asset_node(
    "build_execution_result_surface",
    schema="odd.asset.build_execution_result_surface",
    kind="operational_evidence_surface",
    required_contexts=("build_execution_surface",),
    output_contract_refs=("build_execution_result_surface_present",),
)
_test_execution_surface = _asset_node(
    "test_execution_surface",
    schema="odd.asset.test_execution_surface",
    kind="work_request_surface",
    required_contexts=("release_surface",),
    output_contract_refs=("test_execution_surface_present",),
)
_test_execution_result_surface = _asset_node(
    "test_execution_result_surface",
    schema="odd.asset.test_execution_result_surface",
    kind="operational_evidence_surface",
    required_contexts=("test_execution_surface", "test_run_archive_surface"),
    output_contract_refs=("test_execution_result_surface_present",),
)
_deployment_surface = _asset_node(
    "deployment_surface",
    schema="odd.asset.deployment_surface",
    kind="work_request_surface",
    required_contexts=("release_surface",),
    output_contract_refs=("deployment_surface_present",),
)
_deployment_result_surface = _asset_node(
    "deployment_result_surface",
    schema="odd.asset.deployment_result_surface",
    kind="operational_evidence_surface",
    required_contexts=("deployment_surface",),
    output_contract_refs=("deployment_result_surface_present",),
)
_deployed_environment_surface = _asset_node(
    "deployed_environment_surface",
    schema="odd.asset.deployed_environment_surface",
    kind="deployment_record_surface",
    required_contexts=("deployment_result_surface",),
    output_contract_refs=("deployed_environment_surface_present",),
)
_runtime_observation_surface = _asset_node(
    "runtime_observation_surface",
    schema="odd.asset.runtime_observation_surface",
    kind="runtime_observation_surface",
    required_contexts=("deployment_result_surface", "test_run_archive_surface"),
    output_contract_refs=("runtime_observation_surface_present",),
)
_retrofit_plan_surface = _asset_node(
    "retrofit_plan_surface",
    schema="odd.asset.retrofit_plan_surface",
    kind="retrofit_plan_surface",
    required_contexts=("runtime_observation_surface", "release_surface"),
    output_contract_refs=("retrofit_plan_surface_present",),
)

_design_review_request_vector = Node(
    "design_review_request_vector",
    schema="Vector[odd.asset.review_request]",
)
_review_assessment_vector = Node(
    "review_assessment_vector",
    schema="Vector[odd.asset.review_assessment_surface]",
)

_builder = Operator(
    name="odd_sdlc_builder",
    regime=F_P,
    binding="agent://odd_sdlc/builder",
)

_PENDING_CONTEXT_DIGEST = "sha256:" + ("0" * 64)
def _workspace_context(name: str, relative_path: Path) -> Context:
    return Context(
        name=name,
        locator=f"workspace://{relative_path.as_posix()}",
        digest=_PENDING_CONTEXT_DIGEST,
    )


_stateful_builder_control_context = _workspace_context(
    "odd_sdlc_stateful_builder_control_frame",
    _STATEFUL_ITERATOR_CONTROL_CONTEXT_PATH,
)
_requirement_closure_context = _workspace_context(
    "odd_sdlc_requirement_closure_builder_context",
    REQUIREMENT_CLOSURE_PROMPT_CONTEXT_PATH,
)
_realized_test_source_context = _workspace_context(
    "odd_sdlc_realized_test_source_obligation",
    _REALIZED_TEST_SOURCE_CONTEXT_PATH,
)
_realization_deepening_context = _workspace_context(
    "odd_sdlc_realization_deepening_control_frame",
    _REALIZATION_DEEPENING_CONTEXT_PATH,
)

def _fd_evaluator(name: str) -> Evaluator:
    contract = fd_contract(name)
    return Evaluator(
        name=contract.evaluator_name,
        regime=F_D,
        description=contract.description,
        binding=fd_binding(name),
    )


def _obligation_carry_fd(edge_name: str) -> Evaluator:
    contract = fd_contract("obligation_ledger_carry_converged")
    return Evaluator(
        name=f"{edge_name}_obligation_ledger_carry_converged",
        regime=F_D,
        description=f"{contract.description} Target edge: {edge_name}.",
        binding=(
            f"exec://python -m odd_sdlc.fd_checks {contract.cli_name} "
            f"--workspace . --edge {edge_name}"
        ),
    )


_bootstrap_fd = _fd_evaluator("bootstrap_input_set_present")
_product_fd = _fd_evaluator("product_dependency_surfaces_present")
_goal_fd = _fd_evaluator("goal_dependency_surfaces_present")
_goal_authority_fd = _fd_evaluator("goal_surface_authority_validated")
_requirements_fd = _fd_evaluator("requirements_boundary_sources_present")
_requirement_scope_fd = _fd_evaluator("requirement_scope_complete")
_feature_decomp_fd = _fd_evaluator("feature_decomp_dependency_surfaces_present")
_uat_testcases_fd = _fd_evaluator("uat_testcases_dependency_surfaces_present")
_design_fd = _fd_evaluator("design_dependency_surfaces_present")
_review_assessment_fd = _fd_evaluator("review_assessment_dependency_surfaces_present")
_consensus_decision_fd = _fd_evaluator("consensus_decision_dependency_surfaces_present")
_reviewed_design_fd = _fd_evaluator("reviewed_design_dependency_surfaces_present")
_testcase_authority_fd = _fd_evaluator("testcase_authority_dependency_surfaces_present")
_scenario_fd = _fd_evaluator("scenario_dependency_surfaces_present")
_implementation_design_fd = _fd_evaluator("implementation_design_dependency_surfaces_present")
_implementation_stack_profile_fd = _fd_evaluator("implementation_stack_profile_dependency_surfaces_present")
_implementation_module_fd = _fd_evaluator("implementation_module_dependency_surfaces_present")
_code_fd = _fd_evaluator("code_dependency_surfaces_present")
_code_traceability_fd = _fd_evaluator("code_traceability_present")
_release_fd = _fd_evaluator("release_dependency_surfaces_present")
_build_execution_fd = _fd_evaluator("build_execution_dependency_surfaces_present")
_build_execution_result_fd = _fd_evaluator("build_execution_result_dependency_surfaces_present")
_test_design_fd = _fd_evaluator("test_design_dependency_surfaces_present")
_test_stack_profile_fd = _fd_evaluator("test_stack_profile_dependency_surfaces_present")
_test_module_fd = _fd_evaluator("test_module_dependency_surfaces_present")
_planned_test_traceability_fd = _fd_evaluator("planned_test_traceability_present")
_test_run_archive_fd = _fd_evaluator("test_run_archive_dependency_surfaces_present")
_realized_test_traceability_fd = _fd_evaluator("realized_test_traceability_present")
_test_execution_fd = _fd_evaluator("test_execution_dependency_surfaces_present")
_test_execution_result_fd = _fd_evaluator("test_execution_result_dependency_surfaces_present")
_deployment_fd = _fd_evaluator("deployment_dependency_surfaces_present")
_deployment_result_fd = _fd_evaluator("deployment_result_dependency_surfaces_present")
_deployed_environment_fd = _fd_evaluator("deployed_environment_dependency_surfaces_present")
_runtime_observation_fd = _fd_evaluator("runtime_observation_dependency_surfaces_present")
_retrofit_plan_fd = _fd_evaluator("retrofit_plan_dependency_surfaces_present")
_testcase_authority_obligation_fd = _obligation_carry_fd("qualify_testcase_authority")
_implementation_design_obligation_fd = _obligation_carry_fd("derive_implementation_design_surface")
_implementation_module_obligation_fd = _obligation_carry_fd("derive_implementation_module_surface")
_code_obligation_fd = _obligation_carry_fd("derive_code_surface")
_test_design_obligation_fd = _obligation_carry_fd("derive_test_design_surface")
_test_module_obligation_fd = _obligation_carry_fd("derive_test_module_surface")
_test_run_archive_obligation_fd = _obligation_carry_fd("derive_test_run_archive_surface")
_release_obligation_fd = _obligation_carry_fd("prepare_release_surface")
_intent_fp = Evaluator(
    name="intent_surface_semantically_converged",
    regime=F_P,
    description="The intent surface is semantically converged for the current workspace input set.",
)
_product_fp = Evaluator(
    name="product_surface_semantically_converged",
    regime=F_P,
    description="The product surface is semantically converged for the current workspace input set.",
)
_goal_fp = Evaluator(
    name="goal_surface_semantically_converged",
    regime=F_P,
    description="The goals surface is semantically converged for the current workspace input set.",
)
_requirements_fp = Evaluator(
    name="requirement_surface_semantically_converged",
    regime=F_P,
    description="The requirement family surface is semantically converged for the current workspace input set.",
)
_feature_decomp_fp = Evaluator(
    name="feature_decomp_surface_semantically_converged",
    regime=F_P,
    description="The feature decomposition surface is semantically converged for the current workspace requirements.",
)
_uat_testcases_fp = Evaluator(
    name="uat_testcases_surface_semantically_converged",
    regime=F_P,
    description="The UAT testcase surface is semantically converged for the current workspace requirements.",
)
_design_fp = Evaluator(
    name="design_surface_semantically_converged",
    regime=F_P,
    description="The design surface is semantically converged for the current workspace requirements and feature decomposition.",
)
_review_assessment_fp = Evaluator(
    name="review_assessment_surface_semantically_converged",
    regime=F_P,
    description="The review assessment surface is semantically converged for the current design under review.",
)
_consensus_decision_fp = Evaluator(
    name="consensus_decision_surface_semantically_converged",
    regime=F_P,
    description="The consensus decision surface is semantically converged for the current review assessment round.",
)
_reviewed_design_fp = Evaluator(
    name="reviewed_design_surface_semantically_converged",
    regime=F_P,
    description="The reviewed design surface is semantically converged for the current design and consensus decision state.",
)
_testcase_authority_fp = Evaluator(
    name="testcase_authority_surface_semantically_converged",
    regime=F_P,
    description="The testcase authority surface is semantically converged only when the current carried validation obligations are explicitly admitted into testcase authority and not merely referenced by upstream planning surfaces.",
)
_design_consensus_gate_fp = Evaluator(
    name="design_consensus_gate_satisfied",
    regime=F_P,
    description="The current review assessment vector satisfies the declared consensus rule for design review.",
)
_design_consensus_termination = _fd_evaluator("design_consensus_terminated")
_scenario_fp = Evaluator(
    name="scenario_surface_semantically_converged",
    regime=F_P,
    description="The scenario surface is semantically converged for the current workspace requirements and design.",
)
_implementation_design_fp = Evaluator(
    name="implementation_design_surface_semantically_converged",
    regime=F_P,
    description="The implementation design surface is semantically converged only when each carried requirement obligation is materially represented by implementation design records that explain how the behavior will be realized for the current requirement, design, and scenario set.",
)
_implementation_stack_profile_fp = Evaluator(
    name="implementation_stack_profile_semantically_converged",
    regime=F_P,
    description="The implementation stack profile is semantically converged for the current generated implementation design.",
)
_implementation_module_fp = Evaluator(
    name="implementation_module_surface_semantically_converged",
    regime=F_P,
    description="The implementation module surface is semantically converged only when the carried implementation obligations are concretely mapped into module boundaries and responsibilities rather than preserved as structural placeholders.",
)
_code_fp = Evaluator(
    name="code_surface_semantically_converged",
    regime=F_P,
    description="The code surface is semantically converged only when the current carried requirement obligations are behaviorally realized in governed code; traceability tags or structural stubs without behavioral implementation are insufficient.",
)
_release_fp = Evaluator(
    name="release_surface_semantically_converged",
    regime=F_P,
    description="The release surface is semantically converged only when the carried requirement obligations are jointly satisfied by design, code, testcase authority, and archived realized test evidence rather than by structural bundle completeness alone.",
)
_build_execution_fp = Evaluator(
    name="build_execution_surface_semantically_converged",
    regime=F_P,
    description="The build execution command surface is semantically converged for the current release position and declared build substrate.",
)
_build_execution_result_fp = Evaluator(
    name="build_execution_result_surface_semantically_converged",
    regime=F_P,
    description="The build execution result surface is semantically converged for the current admitted build result or pending external build state.",
)
_test_design_fp = Evaluator(
    name="test_design_surface_semantically_converged",
    regime=F_P,
    description="The test design surface is semantically converged only when the carried requirement and scenario validation obligations are explicitly planned in the test design rather than left implicit in structural headings.",
)
_test_stack_profile_fp = Evaluator(
    name="test_stack_profile_semantically_converged",
    regime=F_P,
    description="The test stack profile is semantically converged for the current generated test design.",
)
_test_module_fp = Evaluator(
    name="test_module_surface_semantically_converged",
    regime=F_P,
    description="The test module surface is semantically converged only when the planned validation obligations are concretely allocated into governed test modules and remain traceable to the carried requirement set.",
)
_test_run_archive_fp = Evaluator(
    name="test_run_archive_surface_semantically_converged",
    regime=F_P,
    description="The test run archive surface is semantically converged only when the carried realized validation obligations are backed by governed execution evidence, not merely by planned test structure or selected stack metadata.",
)
_test_execution_fp = Evaluator(
    name="test_execution_surface_semantically_converged",
    regime=F_P,
    description="The test execution command surface is semantically converged for the current release position and declared test execution substrate.",
)
_test_execution_result_fp = Evaluator(
    name="test_execution_result_surface_semantically_converged",
    regime=F_P,
    description="The test execution result surface is semantically converged for the admitted test execution evidence and bounded pending/failure state.",
)
_deployment_fp = Evaluator(
    name="deployment_surface_semantically_converged",
    regime=F_P,
    description="The deployment command surface is semantically converged for the current release readiness and declared deployment substrate.",
)
_deployment_result_fp = Evaluator(
    name="deployment_result_surface_semantically_converged",
    regime=F_P,
    description="The deployment result surface is semantically converged for the admitted deployment outcome or pending external completion state.",
)
_deployed_environment_fp = Evaluator(
    name="deployed_environment_surface_semantically_converged",
    regime=F_P,
    description="The deployed environment surface is semantically converged as a current read model over the admitted deployment result.",
)
_runtime_observation_fp = Evaluator(
    name="runtime_observation_surface_semantically_converged",
    regime=F_P,
    description="The runtime observation surface is semantically converged for the current admitted deployment result and returned runtime evidence.",
)
_retrofit_plan_fp = Evaluator(
    name="retrofit_plan_surface_semantically_converged",
    regime=F_P,
    description="The retrofit plan surface is semantically converged for the current returned runtime evidence and release position.",
)

_FP_DISPATCH_TIMEOUT_SECONDS = 1800


def _declared_fp_evaluator_obligation_ledger(
    *,
    vector_name: str,
    evaluators: tuple[Evaluator, ...],
    declarations: Attrs,
) -> Attrs:
    obligations: list[dict[str, object]] = []
    for index, evaluator in enumerate(evaluators[1:], start=1):
        if evaluator.regime != F_P:
            continue
        obligations.append(
            {
                "id": evaluator.name,
                "evaluator": evaluator.name,
                "statement": evaluator.description,
                "source_kind": "vector_declared_fp_evaluators",
                "source_refs": [f"vector://{vector_name}#evaluator/{index}"],
            }
        )
    if not obligations:
        return declarations
    return Attrs.coerce(
        {
            **declarations.to_dict(),
            "obligation_ledger": {
                "obligation_source_kind": "vector_declared_fp_evaluators",
                "obligation_source_ref": f"vector://{vector_name}#obligation_ledger",
                "obligation_kind": "fp_evaluator_obligation",
                "carry_rule": "declared_fulfillment_obligation_set_totality",
                "fulfillment_rule": "per_obligation_fp_assessment",
                "evidence_policy": "agent_supplied_evidence_refs",
                "obligations": obligations,
            },
        }
    )


def _graph_function(
    *,
    name: str,
    source: Node | tuple[Node, ...],
    target: Node,
    fd_evaluator: Evaluator,
    fp_evaluator: Evaluator,
    req_refs: tuple[str, ...],
    extra_fd_evaluators: tuple[Evaluator, ...] = (),
    contexts: tuple[Context, ...] = (),
    obligation_ledger: Attrs | dict[str, object] | None = None,
) -> GraphFunction:
    published_contexts = (_stateful_builder_control_context, *contexts)
    vector_declarations: list[tuple[str, object]] = [
        (
            "dispatch",
            Attrs(
                entries=(
                    ("ref", "genesis.dispatch_runtime:dispatch_bound_manifest_via_transport"),
                    ("config", Attrs(entries=(("timeout", _FP_DISPATCH_TIMEOUT_SECONDS),))),
                )
            ),
        ),
        ("proof", Attrs(entries=(("ref", "genesis.policy_defaults:proof_recheck_after_fp"),))),
        ("closure", Attrs(entries=(("ref", "genesis.policy_defaults:closure_require_resolution_or_fh"),))),
        ("implements", tuple(req_refs)),
    ]
    declarations = Attrs(entries=tuple(vector_declarations))
    if obligation_ledger is not None:
        declarations = Attrs.coerce(
            {
                **declarations.to_dict(),
                "obligation_ledger": Attrs.coerce(obligation_ledger),
            }
        )
    else:
        declarations = _declared_fp_evaluator_obligation_ledger(
            vector_name=name,
            evaluators=(fd_evaluator, *extra_fd_evaluators, fp_evaluator),
            declarations=declarations,
        )
    vector = GraphVector(
        name=name,
        source=source,
        target=target,
        operators=(_builder,),
        evaluators=(fd_evaluator, *extra_fd_evaluators, fp_evaluator),
        contexts=published_contexts,
        declarations=declarations,
    )
    source_nodes = source if isinstance(source, tuple) else (source,)
    graph = Graph(
        name=f"{name}_graph",
        inputs=tuple(source_nodes),
        outputs=(target,),
        nodes=tuple((*source_nodes, target)),
        vectors=(vector,),
    )
    return GraphFunction.from_graph(
        name=name,
        graph=graph,
        environment=EnvRef.from_contract(
            requires=graph.inputs,
            provides=graph.outputs,
        ),
        declarations=Attrs(entries=(("function_kind", "odd_asset_function"),)),
    )


def _symbolic_graph_function(
    *,
    name: str,
    ref: str,
    inputs: tuple[Node, ...],
    outputs: tuple[Node, ...],
    declarations: Attrs,
    tags: tuple[str, ...] = (),
) -> GraphFunction:
    return GraphFunction.symbolic(
        name=name,
        ref=ref,
        inputs=inputs,
        outputs=outputs,
        environment=EnvRef.from_contract(
            requires=inputs,
            provides=outputs,
        ),
        declarations=declarations,
        tags=tags,
    )


def _annotate_graph_function(
    graph_function: GraphFunction,
    *,
    name: str | None = None,
    function_kind: str,
    intent: str,
    extra_declarations: dict[str, object] | None = None,
    tags: tuple[str, ...] = (),
) -> GraphFunction:
    merged_declarations = {
        **graph_function.declarations.to_dict(),
        "function_kind": function_kind,
        "intent": intent,
        **dict(extra_declarations or {}),
    }
    return GraphFunction(
        name=name or graph_function.name,
        inputs=graph_function.inputs,
        outputs=graph_function.outputs,
        environment=graph_function.environment,
        template=graph_function.template,
        effects=graph_function.effects,
        declarations=Attrs.coerce(merged_declarations),
        tags=tuple((*graph_function.tags, *tags)),
    )


def _rename_graph(graph: Graph, *, name: str) -> Graph:
    return Graph(
        name=name,
        inputs=graph.inputs,
        outputs=graph.outputs,
        nodes=graph.nodes,
        vectors=graph.vectors,
        contexts=graph.contexts,
        rules=graph.rules,
        tags=graph.tags,
    )


def _executive_graph_function(
    *,
    name: str,
    intent: str,
    functions: tuple[GraphFunction, ...],
) -> GraphFunction:
    composed = compose(*functions)
    executive_graph = _rename_graph(composed.materialize(), name=f"{name}_graph")
    return GraphFunction.from_graph(
        name=name,
        graph=executive_graph,
        environment=composed.environment,
        effects=composed.effects,
        declarations=Attrs(
            entries=(
                ("function_kind", "odd_executive_graph_function"),
                ("intent", intent),
                ("entrypoint", True),
            )
        ),
        tags=("executive",),
    )


GF_DERIVE_INTENT = _graph_function(
    name="derive_intent_surface",
    source=_input_set,
    target=_intent_surface,
    fd_evaluator=_bootstrap_fd,
    fp_evaluator=_intent_fp,
    req_refs=("REQ-F-ASSET-001", "REQ-F-ASSET-002", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_PRODUCT = _graph_function(
    name="derive_product_surface",
    source=(_input_set, _intent_surface),
    target=_product_surface,
    fd_evaluator=_product_fd,
    fp_evaluator=_product_fp,
    req_refs=("REQ-F-ASSET-001", "REQ-F-ASSET-002", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_GOALS = _graph_function(
    name="derive_goal_surface",
    source=(_input_set, _intent_surface, _product_surface),
    target=_goal_surface,
    fd_evaluator=_goal_fd,
    fp_evaluator=_goal_fp,
    extra_fd_evaluators=(_goal_authority_fd,),
    req_refs=("REQ-F-ASSET-001", "REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_REQUIREMENTS = _graph_function(
    name="derive_requirement_surface",
    source=(_input_set, _intent_surface, _product_surface, _goal_surface),
    target=_requirement_surface,
    fd_evaluator=_requirements_fd,
    fp_evaluator=_requirements_fp,
    extra_fd_evaluators=(_requirement_scope_fd,),
    contexts=(_requirement_closure_context,),
    req_refs=("REQ-F-ASSET-003", "REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_FEATURE_DECOMP = _graph_function(
    name="derive_feature_decomp_surface",
    source=_requirement_surface,
    target=_feature_decomp_surface,
    fd_evaluator=_feature_decomp_fd,
    fp_evaluator=_feature_decomp_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_UAT_TESTCASES = _graph_function(
    name="derive_uat_testcases_surface",
    source=_requirement_surface,
    target=_uat_testcases_surface,
    fd_evaluator=_uat_testcases_fd,
    fp_evaluator=_uat_testcases_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_DESIGN = _graph_function(
    name="derive_design_surface",
    source=(_requirement_surface, _feature_decomp_surface),
    target=_design_surface,
    fd_evaluator=_design_fd,
    fp_evaluator=_design_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_REVIEW_ASSESSMENT = _graph_function(
    name="derive_review_assessment_surface",
    source=_design_surface,
    target=_review_assessment_surface,
    fd_evaluator=_review_assessment_fd,
    fp_evaluator=_review_assessment_fp,
    req_refs=("REQ-F-GFUNC-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_CONSENSUS_DECISION = _graph_function(
    name="derive_consensus_decision_surface",
    source=_review_assessment_surface,
    target=_consensus_decision_surface,
    fd_evaluator=_consensus_decision_fd,
    fp_evaluator=_consensus_decision_fp,
    req_refs=("REQ-F-GFUNC-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_REVIEWED_DESIGN = _graph_function(
    name="derive_reviewed_design_surface",
    source=(_design_surface, _consensus_decision_surface),
    target=_reviewed_design_surface,
    fd_evaluator=_reviewed_design_fd,
    fp_evaluator=_reviewed_design_fp,
    req_refs=("REQ-F-GFUNC-004", "REQ-F-ODDSDLC-002"),
)
GF_QUALIFY_TESTCASE_AUTHORITY = _graph_function(
    name="qualify_testcase_authority",
    source=(_uat_testcases_surface, _scenario_surface),
    target=_testcase_authority_surface,
    fd_evaluator=_testcase_authority_fd,
    fp_evaluator=_testcase_authority_fp,
    extra_fd_evaluators=(_testcase_authority_obligation_fd,),
    contexts=(_requirement_closure_context,),
    obligation_ledger=_requirement_edge_obligation_ledger(
        signal_key="qualify_testcase_authority",
        derivation_rule="validation_authority_projection",
        fulfillment_rule="testcase_authority_coverage",
        evidence_policy="testcase_authority_evidence",
    ),
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_SCENARIOS = _graph_function(
    name="derive_scenario_surface",
    source=(_requirement_surface, _design_surface),
    target=_scenario_surface,
    fd_evaluator=_scenario_fd,
    fp_evaluator=_scenario_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_IMPLEMENTATION_DESIGN = _graph_function(
    name="derive_implementation_design_surface",
    source=(_design_surface, _scenario_surface),
    target=_implementation_design_surface,
    fd_evaluator=_implementation_design_fd,
    fp_evaluator=_implementation_design_fp,
    extra_fd_evaluators=(_implementation_design_obligation_fd,),
    contexts=(_requirement_closure_context,),
    obligation_ledger=_requirement_edge_obligation_ledger(
        signal_key="derive_implementation_design_surface",
        derivation_rule="implementation_design_projection",
        fulfillment_rule="implementation_design_surface_coverage",
        evidence_policy="implementation_design_traceability",
    ),
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_SELECT_IMPLEMENTATION_STACK_PROFILE = _graph_function(
    name="select_implementation_stack_profile",
    source=_implementation_design_surface,
    target=_implementation_stack_profile,
    fd_evaluator=_implementation_stack_profile_fd,
    fp_evaluator=_implementation_stack_profile_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_IMPLEMENTATION_MODULE = _graph_function(
    name="derive_implementation_module_surface",
    source=(_implementation_design_surface, _implementation_stack_profile),
    target=_implementation_module_surface,
    fd_evaluator=_implementation_module_fd,
    fp_evaluator=_implementation_module_fp,
    extra_fd_evaluators=(_implementation_module_obligation_fd,),
    contexts=(_requirement_closure_context, _realization_deepening_context),
    obligation_ledger=_requirement_edge_obligation_ledger(
        signal_key="derive_implementation_module_surface",
        derivation_rule="implementation_module_projection",
        fulfillment_rule="implementation_module_surface_coverage",
        evidence_policy="implementation_module_traceability",
    ),
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_CODE = _graph_function(
    name="derive_code_surface",
    source=(_implementation_module_surface, _implementation_stack_profile),
    target=_code_surface,
    fd_evaluator=_code_fd,
    fp_evaluator=_code_fp,
    extra_fd_evaluators=(_code_traceability_fd, _code_obligation_fd),
    contexts=(_requirement_closure_context, _realization_deepening_context),
    obligation_ledger=_requirement_edge_obligation_ledger(
        signal_key="derive_code_surface",
        derivation_rule="implementation_code_projection",
        fulfillment_rule="behavioral_code_realization",
        evidence_policy="behavioral_code_evidence",
    ),
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_TEST_DESIGN = _graph_function(
    name="derive_test_design_surface",
    source=(_design_surface, _scenario_surface),
    target=_test_design_surface,
    fd_evaluator=_test_design_fd,
    fp_evaluator=_test_design_fp,
    extra_fd_evaluators=(_test_design_obligation_fd,),
    contexts=(_requirement_closure_context,),
    obligation_ledger=_requirement_edge_obligation_ledger(
        signal_key="derive_test_design_surface",
        derivation_rule="validation_design_projection",
        fulfillment_rule="test_design_surface_coverage",
        evidence_policy="planned_test_design_coverage",
    ),
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_SELECT_TEST_STACK_PROFILE = _graph_function(
    name="select_test_stack_profile",
    source=_test_design_surface,
    target=_test_stack_profile,
    fd_evaluator=_test_stack_profile_fd,
    fp_evaluator=_test_stack_profile_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_TEST_MODULE = _graph_function(
    name="derive_test_module_surface",
    source=(_test_design_surface, _test_stack_profile),
    target=_test_module_surface,
    fd_evaluator=_test_module_fd,
    fp_evaluator=_test_module_fp,
    extra_fd_evaluators=(_planned_test_traceability_fd, _test_module_obligation_fd),
    contexts=(_requirement_closure_context, _realization_deepening_context),
    obligation_ledger=_requirement_edge_obligation_ledger(
        signal_key="derive_test_module_surface",
        derivation_rule="validation_module_projection",
        fulfillment_rule="test_module_surface_coverage",
        evidence_policy="planned_test_module_coverage",
    ),
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_DERIVE_TEST_RUN_ARCHIVE = _graph_function(
    name="derive_test_run_archive_surface",
    source=(_test_module_surface, _test_stack_profile),
    target=_test_run_archive_surface,
    fd_evaluator=_test_run_archive_fd,
    fp_evaluator=_test_run_archive_fp,
    extra_fd_evaluators=(_test_run_archive_obligation_fd,),
    contexts=(_requirement_closure_context, _realized_test_source_context),
    obligation_ledger=_requirement_edge_obligation_ledger(
        signal_key="derive_test_run_archive_surface",
        derivation_rule="realized_validation_projection",
        fulfillment_rule="realized_test_evidence",
        evidence_policy="realized_test_execution_evidence",
    ),
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_PREPARE_RELEASE = _graph_function(
    name="prepare_release_surface",
    source=(
        _requirement_surface,
        _design_surface,
        _scenario_surface,
        _code_surface,
        _testcase_authority_surface,
        _test_run_archive_surface,
    ),
    target=_release_surface,
    fd_evaluator=_release_fd,
    fp_evaluator=_release_fp,
    extra_fd_evaluators=(_release_obligation_fd,),
    contexts=(_requirement_closure_context,),
    obligation_ledger=_requirement_edge_obligation_ledger(
        signal_key="prepare_release_surface",
        fulfillment_rule="release_readiness",
        evidence_policy="release_readiness_evidence",
    ),
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002"),
)
GF_PREPARE_BUILD_EXECUTION = _graph_function(
    name="prepare_build_execution_surface",
    source=_release_surface,
    target=_build_execution_surface,
    fd_evaluator=_build_execution_fd,
    fp_evaluator=_build_execution_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)
GF_DERIVE_BUILD_EXECUTION_RESULT = _graph_function(
    name="derive_build_execution_result_surface",
    source=_build_execution_surface,
    target=_build_execution_result_surface,
    fd_evaluator=_build_execution_result_fd,
    fp_evaluator=_build_execution_result_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)
GF_PREPARE_TEST_EXECUTION = _graph_function(
    name="prepare_test_execution_surface",
    source=_release_surface,
    target=_test_execution_surface,
    fd_evaluator=_test_execution_fd,
    fp_evaluator=_test_execution_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)
GF_DERIVE_TEST_EXECUTION_RESULT = _graph_function(
    name="derive_test_execution_result_surface",
    source=(_test_execution_surface, _test_run_archive_surface),
    target=_test_execution_result_surface,
    fd_evaluator=_test_execution_result_fd,
    fp_evaluator=_test_execution_result_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)
GF_PREPARE_DEPLOYMENT = _graph_function(
    name="prepare_deployment_surface",
    source=_release_surface,
    target=_deployment_surface,
    fd_evaluator=_deployment_fd,
    fp_evaluator=_deployment_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)
GF_DERIVE_DEPLOYMENT_RESULT = _graph_function(
    name="derive_deployment_result_surface",
    source=_deployment_surface,
    target=_deployment_result_surface,
    fd_evaluator=_deployment_result_fd,
    fp_evaluator=_deployment_result_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)
GF_DERIVE_DEPLOYED_ENVIRONMENT = _graph_function(
    name="derive_deployed_environment_surface",
    source=_deployment_result_surface,
    target=_deployed_environment_surface,
    fd_evaluator=_deployed_environment_fd,
    fp_evaluator=_deployed_environment_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)
GF_DERIVE_RUNTIME_OBSERVATION = _graph_function(
    name="derive_runtime_observation_surface",
    source=(_deployment_result_surface, _test_run_archive_surface),
    target=_runtime_observation_surface,
    fd_evaluator=_runtime_observation_fd,
    fp_evaluator=_runtime_observation_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)
GF_DERIVE_RETROFIT_PLAN = _graph_function(
    name="derive_retrofit_plan_surface",
    source=(_runtime_observation_surface, _release_surface),
    target=_retrofit_plan_surface,
    fd_evaluator=_retrofit_plan_fd,
    fp_evaluator=_retrofit_plan_fp,
    req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-002", "REQ-F-ODDSDLC-038", "REQ-F-ODDSDLC-039"),
)

REVIEW_DESIGN_CONSENSUS_ROUND_INTENT = (
    "Run one explicit design-review consensus round: derive review assessments, "
    "reduce them into a consensus decision, and apply the reviewed design result."
)
REVIEW_SUBJECT_CONSENSUS_ROUND_INTENT = (
    "Run one reusable subject-review consensus round over a typed host subject, "
    "publishing review assessment, decision, and reviewed-subject contract metadata."
)
REVIEW_COMMENT_CONSENSUS_ROUND_INTENT = (
    "Bind the reusable subject-review consensus round to odd_sdlc comment-review subjects."
)
SUBJECT_CONSENSUS_HARNESS_CONTRACT = {
    "subject_asset": "subject_surface",
    "assessment_asset": "review_assessment_surface",
    "decision_asset": "consensus_decision_surface",
    "reviewed_asset": "reviewed_subject_surface",
    "assessment_vector_asset": "review_assessment_vector",
    "injected_functions": {
        "review_round": "review_subject_assessment_round",
        "reduce": "reduce_subject_consensus_decision",
        "apply": "apply_subject_consensus_decision",
    },
    "policy_rule": "subject_consensus_rule",
    "composable": True,
    "recursive": True,
}
DESIGN_CONSENSUS_HARNESS_CONTRACT = {
    "subject_asset": "design_surface",
    "assessment_asset": "review_assessment_surface",
    "decision_asset": "consensus_decision_surface",
    "reviewed_asset": "reviewed_design_surface",
    "assessment_vector_asset": "review_assessment_vector",
    "injected_functions": {
        "review_round": "review_design_assessment_round",
        "reduce": "reduce_design_consensus_decision",
        "apply": "apply_design_consensus_decision",
    },
    "policy_rule": "design_consensus_rule",
    "composable": True,
    "recursive": True,
}
COMMENT_REVIEW_CONSENSUS_HARNESS_CONTRACT = {
    "subject_asset": "comment_review_subject_surface",
    "assessment_asset": "review_assessment_surface",
    "decision_asset": "consensus_decision_surface",
    "reviewed_asset": "reviewed_comment_surface",
    "assessment_vector_asset": "review_assessment_vector",
    "binding_of": "review_subject_by_consensus",
    "host_binding_kind": "comment_review",
    "composable": True,
    "recursive": True,
}


GF_REVIEW_DESIGN_CONSENSUS_ROUND = _annotate_graph_function(
    _executive_graph_function(
        name="review_design_consensus_round",
        intent=REVIEW_DESIGN_CONSENSUS_ROUND_INTENT,
        functions=(
            GF_DERIVE_REVIEW_ASSESSMENT,
            GF_DERIVE_CONSENSUS_DECISION,
            GF_DERIVE_REVIEWED_DESIGN,
        ),
    ),
    function_kind="odd_consensus_round_graph_function",
    intent=REVIEW_DESIGN_CONSENSUS_ROUND_INTENT,
    extra_declarations={
        "harness_kind": "consensus_round",
        "harness_contract": DESIGN_CONSENSUS_HARNESS_CONTRACT,
        "host_binding_of": "review_subject_consensus_round",
        "host_binding_kind": "design_review",
        "host_subject_asset": "design_surface",
        "host_reviewed_asset": "reviewed_design_surface",
    },
    tags=("consensus", "round"),
)

GF_REVIEW_DESIGN_ASSESSMENT_ROUND = GraphFunction(
    name="review_design_assessment_round",
    inputs=_design_surface if isinstance(_design_surface, tuple) else (_design_surface,),
    outputs=(_review_assessment_surface,),
    environment=EnvRef.from_contract(requires=(_design_surface,), provides=(_review_assessment_surface,)),
    template=_graph_function(
        name="review_design_assessment_round",
        source=_design_surface,
        target=_review_assessment_surface,
        fd_evaluator=_review_assessment_fd,
        fp_evaluator=_review_assessment_fp,
        req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-004"),
    ).template,
    declarations=Attrs.coerce(
        {
            "function_kind": "odd_consensus_injected_graph_function",
            "selection_visible": False,
        }
    ),
    tags=("consensus", "review_round"),
)

GF_REDUCE_DESIGN_CONSENSUS_DECISION = GraphFunction(
    name="reduce_design_consensus_decision",
    inputs=(_review_assessment_surface,),
    outputs=(_consensus_decision_surface,),
    environment=EnvRef.from_contract(requires=(_review_assessment_surface,), provides=(_consensus_decision_surface,)),
    template=_graph_function(
        name="reduce_design_consensus_decision",
        source=_review_assessment_surface,
        target=_consensus_decision_surface,
        fd_evaluator=_consensus_decision_fd,
        fp_evaluator=_consensus_decision_fp,
        req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-004"),
    ).template,
    declarations=Attrs.coerce(
        {
            "function_kind": "odd_consensus_injected_graph_function",
            "selection_visible": False,
        }
    ),
    tags=("consensus", "reduce"),
)

GF_APPLY_DESIGN_CONSENSUS_DECISION = GraphFunction(
    name="apply_design_consensus_decision",
    inputs=(_design_surface, _consensus_decision_surface),
    outputs=(_reviewed_design_surface,),
    environment=EnvRef.from_contract(
        requires=(_design_surface, _consensus_decision_surface),
        provides=(_reviewed_design_surface,),
    ),
    template=_graph_function(
        name="apply_design_consensus_decision",
        source=(_design_surface, _consensus_decision_surface),
        target=_reviewed_design_surface,
        fd_evaluator=_reviewed_design_fd,
        fp_evaluator=_reviewed_design_fp,
        req_refs=("REQ-F-ASSET-004", "REQ-F-ODDSDLC-004"),
    ).template,
    declarations=Attrs.coerce(
        {
            "function_kind": "odd_consensus_injected_graph_function",
            "selection_visible": False,
        }
    ),
    tags=("consensus", "apply"),
)

_design_review_worker_round = _symbolic_graph_function(
    name="review_design_assessment_round",
    ref="review_design_assessment_round",
    inputs=(_design_surface,),
    outputs=(_review_assessment_surface,),
    declarations=Attrs(),
    tags=("consensus", "review_round"),
)
_design_consensus_reducer = _symbolic_graph_function(
    name="reduce_design_consensus_decision",
    ref="reduce_design_consensus_decision",
    inputs=(_review_assessment_surface,),
    outputs=(_consensus_decision_surface,),
    declarations=Attrs(),
    tags=("consensus", "reduce"),
)
_design_consensus_applier = _symbolic_graph_function(
    name="apply_design_consensus_decision",
    ref="apply_design_consensus_decision",
    inputs=(_design_surface, _consensus_decision_surface),
    outputs=(_reviewed_design_surface,),
    declarations=Attrs(),
    tags=("consensus", "apply"),
)

_subject_consensus_rule = Rule(
    name="subject_consensus_rule",
    kind="consensus",
    config={
        "quorum": 2,
        "max_rounds": 3,
        "on_open": "repeat_round",
        "on_exhaust": "escalate_f_h",
        "assessment_shape": "review_assessment_surface",
    },
)
_design_consensus_rule = Rule(
    name="design_consensus_rule",
    kind="consensus",
    config={
        "quorum": 2,
        "max_rounds": 3,
        "on_open": "repeat_round",
        "on_exhaust": "escalate_f_h",
        "assessment_shape": "review_assessment_surface",
    },
)

GF_REVIEW_SUBJECT_CONSENSUS_ROUND = _annotate_graph_function(
    _symbolic_graph_function(
        name="review_subject_consensus_round",
        ref="odd_sdlc.shared.consensus:review_subject_consensus_round",
        inputs=(_subject_surface,),
        outputs=(_reviewed_subject_surface,),
        declarations=Attrs(),
        tags=("consensus", "plugin", "round"),
    ),
    function_kind="odd_consensus_plugin_round_graph_function",
    intent=REVIEW_SUBJECT_CONSENSUS_ROUND_INTENT,
    extra_declarations={
        "plugin_kind": "shared_consensus_plugin",
        "harness_kind": "consensus_round",
        "harness_contract": SUBJECT_CONSENSUS_HARNESS_CONTRACT,
        "harness_implementation": {
            "custom_functions": (
                "review_subject_assessment_round",
                "reduce_subject_consensus_decision",
                "apply_subject_consensus_decision",
            ),
            "policy_rule": _subject_consensus_rule.name,
        },
    },
    tags=("plugin",),
)

GF_REVIEW_SUBJECT_BY_CONSENSUS = _annotate_graph_function(
    _symbolic_graph_function(
        name="review_subject_by_consensus",
        ref="odd_sdlc.shared.consensus:review_subject_by_consensus",
        inputs=(_subject_surface,),
        outputs=(_reviewed_subject_surface,),
        declarations=Attrs(),
        tags=("consensus", "plugin", "library"),
    ),
    function_kind="odd_consensus_plugin_graph_function",
    intent=(
        "Run reusable subject-based consensus over GTL higher-order operators while "
        "keeping the outer subject/assessment/decision/reviewed-subject contract stable."
    ),
    extra_declarations={
        "plugin_kind": "shared_consensus_plugin",
        "harness_kind": "consensus_harness",
        "harness_contract": SUBJECT_CONSENSUS_HARNESS_CONTRACT,
        "harness_implementation": {
            "custom_functions": (
                "review_subject_assessment_round",
                "reduce_subject_consensus_decision",
                "apply_subject_consensus_decision",
            ),
            "policy_rule": _subject_consensus_rule.name,
        },
    },
    tags=("plugin",),
)

GF_REVIEW_DESIGN_BY_CONSENSUS = _annotate_graph_function(
    recurse(
        compose(
            _design_review_worker_round,
            _design_consensus_reducer,
            _design_consensus_applier,
        ),
        _design_consensus_termination,
        foldback={
            "mode": "rebind",
            "binding": "reviewed_design_surface",
            "requires_parent_evaluation": True,
        },
    ),
    name="review_design_by_consensus",
    function_kind="odd_consensus_library_graph_function",
    intent=(
        "Run explicit design consensus over GTL higher-order operators: "
        "promote design into review requests, fan out review work, gate the "
        "reduced consensus decision, apply it back to the design, and recurse until termination."
    ),
    extra_declarations={
        "harness_kind": "consensus_harness",
        "harness_contract": DESIGN_CONSENSUS_HARNESS_CONTRACT,
        "harness_implementation": {
            "custom_functions": (
                GF_REVIEW_DESIGN_ASSESSMENT_ROUND.name,
                GF_REDUCE_DESIGN_CONSENSUS_DECISION.name,
                GF_APPLY_DESIGN_CONSENSUS_DECISION.name,
            ),
            "policy_rule": _design_consensus_rule.name,
        },
        "host_binding_of": "review_subject_by_consensus",
        "host_binding_kind": "design_review",
        "host_subject_asset": "design_surface",
        "host_reviewed_asset": "reviewed_design_surface",
    },
    tags=("consensus", "library"),
)

GF_REVIEW_COMMENT_CONSENSUS_ROUND = _annotate_graph_function(
    _symbolic_graph_function(
        name="review_comment_consensus_round",
        ref="review_subject_consensus_round",
        inputs=(_comment_review_subject_surface,),
        outputs=(_reviewed_comment_surface,),
        declarations=Attrs(),
        tags=("consensus", "host_binding", "comment_review", "round"),
    ),
    function_kind="odd_consensus_host_binding_round_graph_function",
    intent=REVIEW_COMMENT_CONSENSUS_ROUND_INTENT,
    extra_declarations={
        "plugin_kind": "host_binding",
        "host_binding_of": "review_subject_consensus_round",
        "host_binding_kind": "comment_review",
        "host_subject_asset": "comment_review_subject_surface",
        "host_reviewed_asset": "reviewed_comment_surface",
        "harness_kind": "consensus_round",
        "harness_contract": COMMENT_REVIEW_CONSENSUS_HARNESS_CONTRACT,
    },
    tags=("host_binding", "comment_review"),
)

GF_REVIEW_COMMENT_BY_CONSENSUS = _annotate_graph_function(
    _symbolic_graph_function(
        name="review_comment_by_consensus",
        ref="review_subject_by_consensus",
        inputs=(_comment_review_subject_surface,),
        outputs=(_reviewed_comment_surface,),
        declarations=Attrs(),
        tags=("consensus", "host_binding", "comment_review", "library"),
    ),
    function_kind="odd_consensus_host_binding_graph_function",
    intent=(
        "Bind the reusable subject-based consensus plugin to odd_sdlc comment-review "
        "subjects without making odd_sdlc the owner of the consensus law."
    ),
    extra_declarations={
        "plugin_kind": "host_binding",
        "host_binding_of": "review_subject_by_consensus",
        "host_binding_kind": "comment_review",
        "host_subject_asset": "comment_review_subject_surface",
        "host_reviewed_asset": "reviewed_comment_surface",
        "harness_kind": "consensus_harness",
        "harness_contract": COMMENT_REVIEW_CONSENSUS_HARNESS_CONTRACT,
        "harness_implementation": {
            "plugin_graph_function": "review_subject_by_consensus",
            "policy_rule": _subject_consensus_rule.name,
        },
    },
    tags=("host_binding", "comment_review"),
)

LEAF_GRAPH_FUNCTIONS: tuple[GraphFunction, ...] = (
    GF_DERIVE_INTENT,
    GF_DERIVE_PRODUCT,
    GF_DERIVE_GOALS,
    GF_DERIVE_REQUIREMENTS,
    GF_DERIVE_FEATURE_DECOMP,
    GF_DERIVE_UAT_TESTCASES,
    GF_DERIVE_DESIGN,
    GF_DERIVE_SCENARIOS,
    GF_DERIVE_IMPLEMENTATION_DESIGN,
    GF_SELECT_IMPLEMENTATION_STACK_PROFILE,
    GF_DERIVE_IMPLEMENTATION_MODULE,
    GF_DERIVE_CODE,
    GF_DERIVE_TEST_DESIGN,
    GF_SELECT_TEST_STACK_PROFILE,
    GF_DERIVE_TEST_MODULE,
    GF_DERIVE_TEST_RUN_ARCHIVE,
    GF_QUALIFY_TESTCASE_AUTHORITY,
    GF_PREPARE_RELEASE,
)
OPERATIONAL_LEAF_GRAPH_FUNCTIONS: tuple[GraphFunction, ...] = (
    GF_PREPARE_BUILD_EXECUTION,
    GF_DERIVE_BUILD_EXECUTION_RESULT,
    GF_PREPARE_TEST_EXECUTION,
    GF_DERIVE_TEST_EXECUTION_RESULT,
    GF_PREPARE_DEPLOYMENT,
    GF_DERIVE_DEPLOYMENT_RESULT,
    GF_DERIVE_DEPLOYED_ENVIRONMENT,
    GF_DERIVE_RUNTIME_OBSERVATION,
    GF_DERIVE_RETROFIT_PLAN,
)
CATALOG_VISIBLE_LIBRARY_GRAPH_FUNCTIONS: tuple[GraphFunction, ...] = (
    GF_REVIEW_SUBJECT_CONSENSUS_ROUND,
    GF_REVIEW_SUBJECT_BY_CONSENSUS,
    GF_REVIEW_DESIGN_CONSENSUS_ROUND,
    GF_REVIEW_DESIGN_BY_CONSENSUS,
    GF_REVIEW_COMMENT_CONSENSUS_ROUND,
    GF_REVIEW_COMMENT_BY_CONSENSUS,
)

BOOTSTRAP_RELEASE_SELF_TEST_INTENT = (
    "Act as the current top-level GTL executive over the odd_sdlc bootstrap, "
    "recursive implementation branch, recursive test branch, authority qualification, and release preparation "
    "asset functions."
)


GF_BOOTSTRAP_RELEASE_SELF_TEST = _executive_graph_function(
    name="bootstrap_release_self_test",
    intent=BOOTSTRAP_RELEASE_SELF_TEST_INTENT,
    functions=LEAF_GRAPH_FUNCTIONS,
)

BOOTSTRAP_RELEASE_SELF_TEST_STEPS: tuple[str, ...] = tuple(
    vector.name
    for vector in GF_BOOTSTRAP_RELEASE_SELF_TEST.materialize().vectors
)

RELEASE_OPERATIONAL_CYCLE_INTENT = (
    "Act as the current operational continuation executive over the odd_sdlc release, "
    "build command/result, test command/result, deployment command/result, current deployed-state, "
    "runtime-return, and retrofit-planning asset functions."
)

def _build_release_operational_cycle(functions: tuple[GraphFunction, ...]) -> GraphFunction | None:
    if not functions:
        return None
    vectors = tuple(function.materialize().vectors[0] for function in functions)
    produced_targets = [vector.target for vector in vectors]
    produced_target_names = {node.name for node in produced_targets}
    graph_nodes: list[Node] = []
    graph_inputs: list[Node] = []
    for vector in vectors:
        sources = vector.source if isinstance(vector.source, tuple) else (vector.source,)
        for node in (*sources, vector.target):
            if node not in graph_nodes:
                graph_nodes.append(node)
        for node in sources:
            if node.name not in produced_target_names and node not in graph_inputs:
                graph_inputs.append(node)
    graph_outputs: tuple[Node, ...] = (vectors[-1].target,)
    environment_provides = tuple(dict.fromkeys(produced_targets))

    graph = Graph(
        name="release_operational_cycle_graph",
        inputs=tuple(graph_inputs),
        outputs=graph_outputs,
        nodes=tuple(dict.fromkeys(graph_nodes)),
        vectors=vectors,
    )
    return GraphFunction.from_graph(
        name="release_operational_cycle",
        graph=graph,
        environment=EnvRef.from_contract(
            requires=graph.inputs,
            provides=environment_provides,
        ),
        declarations=Attrs(
            entries=(
                ("function_kind", "odd_executive_graph_function"),
                ("intent", RELEASE_OPERATIONAL_CYCLE_INTENT),
                ("entrypoint", True),
            )
        ),
        tags=("executive",),
    )


GF_RELEASE_OPERATIONAL_CYCLE = _build_release_operational_cycle(OPERATIONAL_LEAF_GRAPH_FUNCTIONS)

RELEASE_OPERATIONAL_CYCLE_STEPS: tuple[str, ...] = tuple(
    vector.name for vector in GF_RELEASE_OPERATIONAL_CYCLE.materialize().vectors
)

_ROLE_CONSTRUCTOR = Role(name="constructor", tags=("f_p",))


def _job(name: str, graph_function: GraphFunction) -> Job:
    return Job(
        name=name,
        contracts=(ContractRef(kind="graph_function", target_id=graph_function.id),),
        roles=(_ROLE_CONSTRUCTOR,),
    )


def _active_workspace_root(start: Path | None = None) -> Path:
    current = (start or Path.cwd()).resolve()
    for candidate in (current, *current.parents):
        if (candidate / PROJECT_CONSTRAINTS_PATH).exists():
            return candidate
    return current


def _module_workspace_root() -> Path:
    return _active_workspace_root(Path(__file__).resolve().parent)


def _workspace_declares_project_constraints(workspace_root: Path) -> bool:
    return (workspace_root / PROJECT_CONSTRAINTS_PATH).exists()


def _active_operational_leaf_graph_functions(workspace_root: Path) -> tuple[GraphFunction, ...]:
    if not _workspace_declares_project_constraints(workspace_root):
        return ()
    profile = load_project_profile(workspace_root)
    active: list[GraphFunction] = []
    if profile.has_build_execution_capability():
        active.append(GF_PREPARE_BUILD_EXECUTION)
        active.append(GF_DERIVE_BUILD_EXECUTION_RESULT)
    if profile.has_test_execution_capability():
        active.append(GF_PREPARE_TEST_EXECUTION)
        active.append(GF_DERIVE_TEST_EXECUTION_RESULT)
    if profile.has_deployment_capability():
        active.append(GF_PREPARE_DEPLOYMENT)
        active.append(GF_DERIVE_DEPLOYMENT_RESULT)
        active.append(GF_DERIVE_DEPLOYED_ENVIRONMENT)
    if profile.has_deployment_capability() and profile.has_runtime_observation_capability():
        active.append(GF_DERIVE_RUNTIME_OBSERVATION)
        active.append(GF_DERIVE_RETROFIT_PLAN)
    return tuple(active)


def _active_function_catalog(active_operational_functions: tuple[GraphFunction, ...]) -> tuple[dict[str, object], ...]:
    active_names = {function.name for function in LEAF_GRAPH_FUNCTIONS}
    active_names.update(function.name for function in active_operational_functions)
    active_names.update(function.name for function in CATALOG_VISIBLE_LIBRARY_GRAPH_FUNCTIONS)
    return tuple(
        entry.to_dict()
        for entry in FUNCTION_CATALOG
        if entry.backing_graph_function in active_names
    )


def _clone_leaf_graph_function(
    graph_function: GraphFunction,
    *,
    extra_evaluators: tuple[Evaluator, ...] = (),
    extra_vector_declarations: dict[str, object] | None = None,
) -> GraphFunction:
    if not extra_evaluators:
        return graph_function
    graph = graph_function.template.graph
    if graph is None or len(graph.vectors) != 1:
        return graph_function
    vector = graph.vectors[0]
    declarations = vector.declarations.to_dict()
    declarations.update(dict(extra_vector_declarations or {}))
    cloned_vector = GraphVector(
        name=vector.name,
        source=vector.source,
        target=vector.target,
        operators=vector.operators,
        evaluators=tuple((*vector.evaluators, *extra_evaluators)),
        contexts=vector.contexts,
        rule=vector.rule,
        allows_subwork=vector.allows_subwork,
        declarations=Attrs.coerce(declarations),
        tags=vector.tags,
    )
    cloned_graph = Graph(
        name=graph.name,
        inputs=graph.inputs,
        outputs=graph.outputs,
        nodes=graph.nodes,
        vectors=(cloned_vector,),
        contexts=graph.contexts,
        rules=graph.rules,
        effects=graph.effects,
        tags=graph.tags,
    )
    return GraphFunction.from_graph(
        name=graph_function.name,
        graph=cloned_graph,
        environment=graph_function.environment,
        effects=graph_function.effects,
        declarations=graph_function.declarations,
        tags=graph_function.tags,
    )


def _ambiguity_fh_evaluator(edge_name: str, entries: tuple[dict[str, Any], ...]) -> Evaluator:
    ambiguity_titles = ", ".join(sorted(str(entry.get("title") or entry.get("ambiguity_id") or "") for entry in entries))
    return Evaluator(
        name=f"{edge_name}_ambiguity_review_approved",
        regime=F_H,
        description=(
            "Human approval is required under the current ambiguity risk appetite "
            f"before closing `{edge_name}`. Active ambiguity: {ambiguity_titles}."
        ),
    )


def _configured_leaf_graph_functions(
    workspace_root: Path,
) -> tuple[tuple[GraphFunction, ...], tuple[Evaluator, ...], dict[str, list[dict[str, Any]]], dict[str, Any]]:
    ambiguity_register = load_or_build_ambiguity_register(workspace_root)
    fh_required_by_edge: dict[str, list[dict[str, Any]]] = {}
    for entry in ambiguity_register.get("ambiguities", []):
        if not isinstance(entry, dict):
            continue
        if str(entry.get("status") or "") in {"resolved", "superseded"}:
            continue
        if str(entry.get("policy_action") or "") != "escalate_fh":
            continue
        edge = str(entry.get("expected_resolving_edge") or "")
        if not edge:
            continue
        fh_required_by_edge.setdefault(edge, []).append(entry)
    configured: list[GraphFunction] = []
    dynamic_fh_evaluators: list[Evaluator] = []

    for graph_function in LEAF_GRAPH_FUNCTIONS:
        edge_entries = tuple(fh_required_by_edge.get(graph_function.name, ()))
        if not edge_entries:
            configured.append(graph_function)
            continue
        fh_evaluator = _ambiguity_fh_evaluator(graph_function.name, edge_entries)
        dynamic_fh_evaluators.append(fh_evaluator)
        configured.append(
            _clone_leaf_graph_function(
                graph_function,
                extra_evaluators=(fh_evaluator,),
                extra_vector_declarations={
                    "ambiguity_policy": Attrs.coerce(
                        {
                            "review_required": True,
                            "ambiguity_ids": tuple(
                                str(entry.get("ambiguity_id") or "")
                                for entry in edge_entries
                            ),
                            "policy_actions": tuple(
                                (
                                    str(entry.get("ambiguity_id") or ""),
                                    str(entry.get("policy_action") or ""),
                                )
                                for entry in edge_entries
                            ),
                        }
                    ),
                },
            )
        )

    return tuple(configured), tuple(dynamic_fh_evaluators), fh_required_by_edge, ambiguity_register


def _build_module(workspace_root: Path) -> Module:
    active_leaf_functions, dynamic_fh_evaluators, fh_required_by_edge, ambiguity_register = _configured_leaf_graph_functions(workspace_root)
    active_operational_functions = _active_operational_leaf_graph_functions(workspace_root)
    active_operational_executive = _build_release_operational_cycle(active_operational_functions)
    bootstrap_executive = _executive_graph_function(
        name="bootstrap_release_self_test",
        intent=BOOTSTRAP_RELEASE_SELF_TEST_INTENT,
        functions=active_leaf_functions,
    )
    executive_graph_functions = [bootstrap_executive]
    if active_operational_executive is not None:
        executive_graph_functions.append(active_operational_executive)

    graph_functions = [
        *executive_graph_functions,
        GF_REVIEW_SUBJECT_CONSENSUS_ROUND,
        GF_REVIEW_SUBJECT_BY_CONSENSUS,
        GF_REVIEW_DESIGN_CONSENSUS_ROUND,
        GF_REVIEW_DESIGN_BY_CONSENSUS,
        GF_REVIEW_COMMENT_CONSENSUS_ROUND,
        GF_REVIEW_COMMENT_BY_CONSENSUS,
    ]
    refinement_vectors = [
        *bootstrap_executive.materialize().vectors,
    ]
    if active_operational_executive is not None:
        refinement_vectors.extend(active_operational_executive.materialize().vectors)
    refinement_vectors.extend(GF_REVIEW_DESIGN_CONSENSUS_ROUND.materialize().vectors)

    jobs = [
        _job("bootstrap_release_self_test_job", bootstrap_executive),
    ]
    if active_operational_executive is not None:
        jobs.append(_job("release_operational_cycle_job", active_operational_executive))

    return Module(
        name="odd_sdlc",
        graphs=tuple(
            function.template.graph
            for function in graph_functions
            if function.template.graph is not None
        ),
        graph_functions=tuple(graph_functions),
        refinement_boundaries=tuple(
            RefinementBoundary(
                name=vector.name,
                inputs=vector.source if isinstance(vector.source, tuple) else (vector.source,),
                outputs=(vector.target,),
                hints=Attrs(entries=(("terminal", True),)),
            )
            for vector in refinement_vectors
        ),
        jobs=tuple(jobs),
        roles=(_ROLE_CONSTRUCTOR,),
        operators=(_builder,),
        evaluators=(
            _bootstrap_fd,
            _product_fd,
            _goal_fd,
            _requirements_fd,
            _feature_decomp_fd,
            _uat_testcases_fd,
            _design_fd,
            _review_assessment_fd,
            _consensus_decision_fd,
            _reviewed_design_fd,
            _testcase_authority_fd,
            _testcase_authority_obligation_fd,
            _scenario_fd,
            _implementation_design_fd,
            _implementation_stack_profile_fd,
            _implementation_module_fd,
            _code_fd,
            _code_obligation_fd,
            _release_fd,
            _release_obligation_fd,
            _deployment_fd,
            _runtime_observation_fd,
            _retrofit_plan_fd,
            _test_design_fd,
            _test_design_obligation_fd,
            _test_stack_profile_fd,
            _test_module_fd,
            _test_module_obligation_fd,
            _planned_test_traceability_fd,
            _test_run_archive_fd,
            _test_run_archive_obligation_fd,
            _realized_test_traceability_fd,
            _intent_fp,
            _product_fp,
            _goal_fp,
            _requirements_fp,
            _feature_decomp_fp,
            _uat_testcases_fp,
            _design_fp,
            _review_assessment_fp,
            _consensus_decision_fp,
            _reviewed_design_fp,
            _testcase_authority_fp,
            _design_consensus_gate_fp,
            _design_consensus_termination,
            _scenario_fp,
            _implementation_design_fp,
            _implementation_stack_profile_fp,
            _implementation_module_fp,
            _code_fp,
            _release_fp,
            _deployment_fp,
            _runtime_observation_fp,
            _retrofit_plan_fp,
            _test_design_fp,
            _test_stack_profile_fp,
            _test_module_fp,
            _test_run_archive_fp,
            *dynamic_fh_evaluators,
        ),
        rules=(
            _subject_consensus_rule,
            _design_consensus_rule,
        ),
        metadata=Attrs(
            entries=(
                ("requirements", (
                    "REQ-F-GFUNC-001",
                    "REQ-F-GFUNC-004",
                    "REQ-F-RUNTIME-001",
                    "REQ-F-RUNTIME-002",
                    "REQ-F-RUNTIME-003",
                    "REQ-F-RUNTIME-004",
                    "REQ-F-ASSET-001",
                    "REQ-F-ASSET-002",
                    "REQ-F-ASSET-003",
                    "REQ-F-ASSET-004",
                    "REQ-F-ASSETMODEL-001",
                    "REQ-F-ASSETMODEL-002",
                    "REQ-F-ASSETMODEL-003",
                    "REQ-F-ASSETMODEL-004",
                    "REQ-F-ODDSDLC-001",
                    "REQ-F-ODDSDLC-002",
                    "REQ-F-ODDSDLC-003",
                    "REQ-F-ODDSDLC-004",
                    "REQ-F-ODDSDLC-006",
                    "REQ-F-ODDSDLC-025",
                    "REQ-F-ODDSDLC-026",
                    "REQ-F-ODDSDLC-027",
                    "REQ-F-ODDSDLC-028",
                )),
                ("function_catalog", _active_function_catalog(active_operational_functions)),
                ("executive_graph_function", bootstrap_executive.name),
                ("executive_graph_functions", tuple(function.name for function in executive_graph_functions)),
                ("library_graph_functions", (
                    GF_REVIEW_SUBJECT_CONSENSUS_ROUND.name,
                    GF_REVIEW_SUBJECT_BY_CONSENSUS.name,
                    GF_REVIEW_DESIGN_CONSENSUS_ROUND.name,
                    GF_REVIEW_DESIGN_BY_CONSENSUS.name,
                )),
                ("host_binding_graph_functions", (
                    GF_REVIEW_DESIGN_CONSENSUS_ROUND.name,
                    GF_REVIEW_DESIGN_BY_CONSENSUS.name,
                    GF_REVIEW_COMMENT_CONSENSUS_ROUND.name,
                    GF_REVIEW_COMMENT_BY_CONSENSUS.name,
                )),
                ("operational_capability_gated", True),
                ("ambiguity_risk_appetite", ambiguity_register.get("project_profile", {}).get("ambiguity_risk_appetite", "")),
                ("ambiguity_fh_required_edges", tuple(sorted(fh_required_by_edge))),
                ("active_operational_steps", tuple(function.name for function in active_operational_functions)),
                ("domain_package", "odd_sdlc"),
            )
        ),
    )


MODULE = _build_module(_module_workspace_root())


def module(workspace_root: Path | str | None = None) -> Module:
    if workspace_root is None:
        return MODULE
    return _build_module(Path(workspace_root).resolve())

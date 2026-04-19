# Implements: REQ-F-ODDSDLC-009
# Implements: REQ-F-ODDSDLC-010
# Implements: REQ-F-ODDSDLC-011
# Implements: REQ-F-ODDSDLC-012
# Implements: REQ-F-ODDSDLC-013
# Implements: REQ-F-ODDSDLC-014
# Implements: REQ-F-ODDSDLC-015
# Implements: REQ-F-ODDSDLC-016
"""Software-domain descriptor registry for odd_sdlc."""
from __future__ import annotations

from .domain_model import AssetFamilyDescriptor, EdgeContractDescriptor, WorkActDescriptor


ASSET_FAMILIES: tuple[AssetFamilyDescriptor, ...] = (
    AssetFamilyDescriptor(
        name="worksite_inputs",
        description="Operator-supplied and constitutional inputs that open a bounded software-domain wave of work.",
        lifecycle_role="entry",
        representative_asset_types=("intent_doc", "product_doc", "goal_surface", "requirement_surface"),
        realization_status="active_first_slice",
    ),
    AssetFamilyDescriptor(
        name="solution_design",
        description="Structured design, decomposition, and scenario surfaces that define what is being built and how it will be qualified.",
        lifecycle_role="design",
        representative_asset_types=("feature_decomp_surface", "design_surface", "scenario_surface"),
        realization_status="active_first_slice",
    ),
    AssetFamilyDescriptor(
        name="implementation_branch",
        description="Implementation design, stack, module, and code surfaces for the active software branch under construction.",
        lifecycle_role="build",
        representative_asset_types=(
            "implementation_design_surface",
            "implementation_stack_profile",
            "implementation_module_surface",
            "code_surface",
        ),
        realization_status="active_first_slice",
    ),
    AssetFamilyDescriptor(
        name="qualification_branch",
        description="Test design, planned coverage, and archived evidence surfaces used to qualify the active software branch, including realized developer-test source generated under the archive stage.",
        lifecycle_role="qualification",
        representative_asset_types=(
            "uat_testcases_surface",
            "test_design_surface",
            "test_stack_profile",
            "test_module_surface",
            "test_run_archive_surface",
            "testcase_authority_surface",
        ),
        realization_status="active_first_slice",
    ),
    AssetFamilyDescriptor(
        name="release_readiness",
        description="Release-oriented decision surfaces that summarize whether the current software branch is qualified for launch.",
        lifecycle_role="release",
        representative_asset_types=("release_surface", "release_document_surface"),
        realization_status="active_first_slice",
    ),
    AssetFamilyDescriptor(
        name="deployment_records",
        description="Governed records describing how a qualified software branch is launched into an operating environment.",
        lifecycle_role="deployment",
        representative_asset_types=("deployment_record_surface",),
        realization_status="active_first_slice",
    ),
    AssetFamilyDescriptor(
        name="runtime_evidence",
        description="Operational observations, incidents, and comparative evidence returned from launched software back into the worksite.",
        lifecycle_role="operation",
        representative_asset_types=("runtime_observation_surface", "operational_evidence_surface"),
        realization_status="active_first_slice",
    ),
    AssetFamilyDescriptor(
        name="retrofit_plans",
        description="Maintenance and retrofit planning surfaces that govern corrective work, upgrades, and relaunch decisions.",
        lifecycle_role="retrofit",
        representative_asset_types=("maintenance_plan_surface", "retrofit_design_surface"),
        realization_status="active_first_slice",
    ),
)


WORK_ACT_TYPES: tuple[WorkActDescriptor, ...] = (
    WorkActDescriptor(
        name="generate",
        description="Construct new governed artifacts for the current bounded branch of work.",
        mutates_workspace=True,
        produces_governed_evidence=True,
        typical_asset_families=("solution_design", "implementation_branch", "qualification_branch"),
        realization_status="active_first_slice",
    ),
    WorkActDescriptor(
        name="adopt",
        description="Bring existing artifacts under governed provenance without pretending they were freshly generated in this workspace.",
        mutates_workspace=True,
        produces_governed_evidence=True,
        typical_asset_families=("implementation_branch", "qualification_branch", "runtime_evidence"),
        realization_status="declared_domain_contract",
    ),
    WorkActDescriptor(
        name="import",
        description="Register external artifacts or evidence into the worksite with explicit provenance and scope.",
        mutates_workspace=True,
        produces_governed_evidence=True,
        typical_asset_families=("worksite_inputs", "runtime_evidence"),
        realization_status="declared_domain_contract",
    ),
    WorkActDescriptor(
        name="qualify",
        description="Produce governed evidence and authority surfaces that determine whether the current branch is fit for downstream use.",
        mutates_workspace=True,
        produces_governed_evidence=True,
        typical_asset_families=("qualification_branch", "release_readiness"),
        realization_status="active_first_slice",
    ),
    WorkActDescriptor(
        name="release",
        description="Stabilize a bounded branch as ready for launch into a deployment environment.",
        mutates_workspace=True,
        produces_governed_evidence=True,
        typical_asset_families=("release_readiness", "deployment_records"),
        realization_status="active_first_slice",
    ),
    WorkActDescriptor(
        name="deploy",
        description="Launch a qualified branch into service and record the governed deployment state.",
        mutates_workspace=True,
        produces_governed_evidence=True,
        typical_asset_families=("deployment_records", "runtime_evidence"),
        realization_status="active_first_slice",
    ),
    WorkActDescriptor(
        name="observe",
        description="Return governed operational evidence from a launched branch back to the active worksite.",
        mutates_workspace=True,
        produces_governed_evidence=True,
        typical_asset_families=("runtime_evidence",),
        realization_status="active_first_slice",
    ),
    WorkActDescriptor(
        name="retrofit",
        description="Repair, extend, or reconfigure the active branch using returned operational evidence.",
        mutates_workspace=True,
        produces_governed_evidence=True,
        typical_asset_families=("retrofit_plans", "implementation_branch", "qualification_branch"),
        realization_status="active_first_slice",
    ),
)


EDGE_CONTRACTS: tuple[EdgeContractDescriptor, ...] = (
    EdgeContractDescriptor(
        name="bootstrap_spec_foundation",
        description="Traverse from worksite inputs into requirement, design, and scenario surfaces that establish the bounded branch under construction.",
        source_asset_families=("worksite_inputs",),
        target_asset_family="solution_design",
        configured_fp_role="Construct and revise the next governing surface for the active branch under an explicit output contract.",
        preflight_fd_layers=("core_fd",),
        postflight_fd_layers=("core_fd",),
        work_report_contract="surface_transform_report",
        representative_functions=(
            "derive_intent_surface",
            "derive_product_surface",
            "derive_goal_surface",
            "derive_requirement_surface",
            "derive_feature_decomp_surface",
            "derive_uat_testcases_surface",
            "derive_design_surface",
            "derive_scenario_surface",
        ),
        realization_status="active_first_slice",
    ),
    EdgeContractDescriptor(
        name="materialize_implementation_branch",
        description="Traverse from the current design branch into implementation design, stack, module, and code surfaces.",
        source_asset_families=("solution_design",),
        target_asset_family="implementation_branch",
        configured_fp_role="Build or revise the implementation branch and declare what changed, what target was used, and what evidence was produced.",
        preflight_fd_layers=("core_fd",),
        postflight_fd_layers=("core_fd", "capability_fd"),
        work_report_contract="implementation_branch_report",
        representative_functions=(
            "derive_implementation_design_surface",
            "select_implementation_stack_profile",
            "derive_implementation_module_surface",
            "derive_code_surface",
        ),
        realization_status="active_first_slice",
    ),
    EdgeContractDescriptor(
        name="materialize_qualification_branch",
        description="Traverse from the current design branch into test design, test structure, archived evidence, and testcase authority surfaces while materializing realized developer-test source under the archive stage.",
        source_asset_families=("solution_design",),
        target_asset_family="qualification_branch",
        configured_fp_role="Build or revise the qualification branch and emit the governed evidence model used by later proof and closure acts.",
        preflight_fd_layers=("core_fd",),
        postflight_fd_layers=("core_fd", "capability_fd"),
        work_report_contract="qualification_branch_report",
        representative_functions=(
            "derive_test_design_surface",
            "select_test_stack_profile",
            "derive_test_module_surface",
            "derive_test_run_archive_surface",
            "qualify_testcase_authority",
        ),
        realization_status="active_first_slice",
    ),
    EdgeContractDescriptor(
        name="prepare_release_readiness",
        description="Traverse from implementation and qualification evidence into a bounded release-readiness decision surface.",
        source_asset_families=("solution_design", "implementation_branch", "qualification_branch"),
        target_asset_family="release_readiness",
        configured_fp_role="Summarize whether the current branch is qualified for downstream release-oriented work without bypassing governed evidence.",
        preflight_fd_layers=("core_fd",),
        postflight_fd_layers=("core_fd", "operational_fd"),
        work_report_contract="release_readiness_report",
        representative_functions=("prepare_release_surface",),
        realization_status="active_first_slice",
    ),
    EdgeContractDescriptor(
        name="publish_deployment_record",
        description="Traverse from bounded release readiness into a governed deployment record for the active software branch.",
        source_asset_families=("release_readiness",),
        target_asset_family="deployment_records",
        configured_fp_role="Project the qualified release state into a deployment record without bypassing governed implementation or evidence surfaces.",
        preflight_fd_layers=("core_fd",),
        postflight_fd_layers=("core_fd", "operational_fd"),
        work_report_contract="deployment_record_report",
        representative_functions=("prepare_deployment_surface",),
        realization_status="active_first_slice",
    ),
    EdgeContractDescriptor(
        name="return_runtime_evidence",
        description="Traverse from deployment and operation back into governed runtime evidence that can reopen worksite activity.",
        source_asset_families=("deployment_records",),
        target_asset_family="runtime_evidence",
        configured_fp_role="Ingest, summarize, and bind operational return evidence back into the worksite with explicit provenance.",
        preflight_fd_layers=("core_fd",),
        postflight_fd_layers=("core_fd", "operational_fd"),
        work_report_contract="runtime_return_report",
        representative_functions=("derive_runtime_observation_surface",),
        realization_status="active_first_slice",
    ),
    EdgeContractDescriptor(
        name="retrofit_and_relaunch",
        description="Traverse from returned runtime evidence into a governed retrofit plan that can reopen repair, requalification, and relaunch work for the active software branch.",
        source_asset_families=("runtime_evidence", "retrofit_plans"),
        target_asset_family="retrofit_plans",
        configured_fp_role="Act as the builder-supervisor for repair and retrofit work, coordinating domain-specific deterministic authorities where available.",
        preflight_fd_layers=("core_fd",),
        postflight_fd_layers=("core_fd", "capability_fd", "operational_fd"),
        work_report_contract="retrofit_work_report",
        representative_functions=("derive_retrofit_plan_surface",),
        realization_status="active_first_slice",
    ),
)

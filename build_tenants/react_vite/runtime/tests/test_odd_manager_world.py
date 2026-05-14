from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def _load_world_module():
    module_path = Path(__file__).resolve().parents[1] / "odd_manager_world.py"
    spec = importlib.util.spec_from_file_location("odd_manager_world", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


world = _load_world_module()


class RequirementProjectionTests(unittest.TestCase):
    def test_surface_read_permission_denied_returns_unreadable_surface(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace_root = Path(temp_dir)
            secret_path = workspace_root / "secret.json"
            secret_path.write_text("{}", encoding="utf-8")
            original_read_text = Path.read_text
            secret_resolved = secret_path.resolve()

            def deny_read_text(path: Path, *args: object, **kwargs: object) -> str:
                if path.resolve() == secret_resolved:
                    raise PermissionError(13, "Permission denied", str(path))
                return original_read_text(path, *args, **kwargs)

            with patch.object(Path, "read_text", deny_read_text):
                surface = world._read_surface(workspace_root, "secret.json")

            self.assertEqual(surface["kind"], "unreadable")
            self.assertEqual(surface["reason"], "permission_denied")
            self.assertEqual(surface["relative_path"], "secret.json")

    def test_surface_read_rejects_paths_outside_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace_root = Path(temp_dir)
            surface = world._read_surface(workspace_root, "../outside.json")

            self.assertEqual(surface["kind"], "unreadable")
            self.assertEqual(surface["reason"], "outside_workspace")

    def test_projects_block_style_requirement_inventory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace_root = Path(temp_dir)
            requirements_root = workspace_root / "specification" / "requirements"
            requirements_root.mkdir(parents=True)
            runtime_root = workspace_root / ".ai-workspace" / "runtime"
            runtime_root.mkdir(parents=True)

            (requirements_root / "00-starter.md").write_text(
                "\n".join(
                    [
                        "# Requirement Family: Starter Requirements",
                        "",
                        "**Family**: starter",
                        "**Status**: specified",
                        "**Traces To**: INT-001, INT-002",
                        "**Derives From**: INT-ROOT",
                        "",
                        "### REQ-START-01 — Block Style Requirement",
                        "",
                        "**Priority**: High",
                        "**Type**: Functional",
                        "**Description**: A fully authored requirement block.",
                        "",
                        "Acceptance Criteria",
                        "- First proof point",
                        "- Second proof point",
                    ]
                ),
                encoding="utf-8",
            )
            (runtime_root / "odd_sdlc-requirement-closure.json").write_text(
                json.dumps(
                    {
                        "requirements": [
                            {
                                "requirement_id": "REQ-START-01",
                                "status": "realized",
                                "authority_refs": ["specification/requirements/00-starter.md"],
                                "code_refs": ["imp_scala_spark/src/main/scala/example/Main.scala"],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            projected = world._project_requirements(workspace_root)

            self.assertEqual(len(projected), 1)
            requirement = projected[0]
            self.assertEqual(requirement["requirement_id"], "REQ-START-01")
            self.assertEqual(requirement["title"], "Block Style Requirement")
            self.assertEqual(requirement["family"], "starter")
            self.assertEqual(requirement["family_title"], "Starter Requirements")
            self.assertEqual(requirement["status"], "realized")
            self.assertEqual(requirement["delivery_status"], "converged")
            self.assertEqual(requirement["traces_to"], ["INT-001", "INT-002"])
            self.assertEqual(requirement["derives_from"], ["INT-ROOT"])
            self.assertEqual(
                requirement["acceptance_criteria"],
                ["First proof point", "Second proof point"],
            )
            self.assertEqual(
                requirement["source_path"],
                "specification/requirements/00-starter.md",
            )

    def test_projects_table_style_requirement_inventory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace_root = Path(temp_dir)
            requirements_root = workspace_root / "specification" / "requirements"
            requirements_root.mkdir(parents=True)
            runtime_root = workspace_root / ".ai-workspace" / "runtime"
            runtime_root.mkdir(parents=True)

            (requirements_root / "10-generated-bootstrap.md").write_text(
                "\n".join(
                    [
                        "# Generated Bootstrap Requirements",
                        "",
                        "### 11. Record Accounting (ACC) — INT-008",
                        "",
                        "| ID | Title | Priority | Type |",
                        "|----|-------|----------|------|",
                        "| REQ-ACC-01 | Accounting Invariant | Critical | Functional |",
                        "| REQ-ACC-02 | Accounting Ledger | Critical | Functional |",
                        "",
                        "### 12. Implementation Constraints (RIC) — INT-009",
                        "",
                        "| ID | Title | Priority | Type |",
                        "|----|-------|----------|------|",
                        "| RIC-LIN-01 | Lineage Modes | Medium | Non-Functional (Performance) |",
                    ]
                ),
                encoding="utf-8",
            )
            (runtime_root / "odd_sdlc-requirement-closure.json").write_text(
                json.dumps({"requirements": []}),
                encoding="utf-8",
            )

            projected = world._project_requirements(workspace_root)

            self.assertEqual(len(projected), 3)
            indexed = {entry["requirement_id"]: entry for entry in projected}

            self.assertEqual(indexed["REQ-ACC-01"]["title"], "Accounting Invariant")
            self.assertEqual(indexed["REQ-ACC-01"]["family_title"], "Record Accounting (ACC)")
            self.assertEqual(indexed["REQ-ACC-01"]["priority"], "Critical")
            self.assertEqual(indexed["REQ-ACC-01"]["type"], "Functional")
            self.assertEqual(indexed["REQ-ACC-01"]["traces_to"], ["INT-008"])
            self.assertEqual(indexed["REQ-ACC-01"]["delivery_status"], "attention")

            self.assertEqual(indexed["RIC-LIN-01"]["title"], "Lineage Modes")
            self.assertEqual(indexed["RIC-LIN-01"]["family_title"], "Implementation Constraints (RIC)")
            self.assertEqual(indexed["RIC-LIN-01"]["traces_to"], ["INT-009"])
            self.assertEqual(
                indexed["RIC-LIN-01"]["source_path"],
                "specification/requirements/10-generated-bootstrap.md",
            )


class DomainContractProjectionTests(unittest.TestCase):
    def test_reports_supported_query_contract_versions_explicitly(self) -> None:
        projected = world._project_domain_contract(
            {
                "name": "odd_sdlc.query-domain",
                "version": "v10",
                "top_level_keys": [
                    "query_contract",
                    "workspace_root",
                    "analysis_manifest",
                    "semantic_facets",
                    "asset_types",
                    "asset_families",
                    "assets",
                    "ambiguity_register",
                    "requirement_closure_register",
                    "collections",
                    "functions",
                    "edge_contracts",
                    "programs",
                    "work_act_types",
                    "jobs",
                    "graph_functions",
                    "bindings",
                    "gaps",
                ],
            }
        )

        self.assertEqual(projected["compatibility"], "supported")
        self.assertEqual(projected["projection_name"], "odd_manager.domain-world")
        self.assertEqual(projected["projection_version"], "v1")
        self.assertEqual(projected["source_name"], "odd_sdlc.query-domain")
        self.assertEqual(projected["source_version"], "v10")
        self.assertEqual(projected["missing_top_level_keys"], [])
        self.assertEqual(projected["extra_top_level_keys"], [])
        self.assertEqual(
            projected["source_contract_ref"],
            "odd_sdlc.query_contract.query_domain_contract",
        )
        self.assertEqual(projected["source_domain_model_ref"], "odd_sdlc.domain_model")
        self.assertEqual(projected["source_query_ref"], "odd_sdlc.query.query_domain")

    def test_supports_v16_query_contract_shape(self) -> None:
        projected = world._project_domain_contract(
            {
                "name": "odd_sdlc.query-domain",
                "version": "v16",
                "top_level_keys": [
                    "query_contract",
                    "workspace_root",
                    "semantic_facets",
                    "asset_types",
                    "asset_families",
                    "assets",
                    "start_target_catalog",
                    "asset_ownership_index",
                    "operational_capabilities",
                    "ambiguity_register",
                    "requirement_closure_register",
                    "collections",
                    "functions",
                    "edge_contracts",
                    "execution_contract_surface",
                    "programs",
                    "work_act_types",
                    "jobs",
                    "graph_functions",
                    "bindings",
                    "gap_dossier",
                ],
            }
        )

        self.assertEqual(projected["compatibility"], "supported")
        self.assertEqual(projected["source_version"], "v16")
        self.assertEqual(projected["missing_top_level_keys"], [])
        self.assertEqual(projected["extra_top_level_keys"], [])

    def test_marks_unknown_contract_versions_unsupported(self) -> None:
        projected = world._project_domain_contract(
            {
                "name": "odd_sdlc.query-domain",
                "version": "v99",
                "top_level_keys": ["query_contract", "workspace_root"],
            }
        )

        self.assertEqual(projected["compatibility"], "unsupported")
        self.assertEqual(projected["expected_top_level_keys"], [])
        self.assertEqual(projected["source_contract_ref"], None)


class GapPayloadProjectionTests(unittest.TestCase):
    def test_projects_v16_gap_dossier_into_manager_gap_overlay(self) -> None:
        projected = world._domain_gap_payload(
            {
                "gap_dossier": {
                    "schema_version": "v1",
                    "scope": "workspace",
                    "summary": {
                        "gap_count": 1,
                        "graph_total_delta": 1.0,
                        "total_delta": 1.0,
                    },
                    "dossiers": [
                        {
                            "edge": "prepare_build_execution_surface",
                            "route_binding": {"state": "blocked_stale_analysis"},
                            "resumption_trigger": "analysis_published",
                            "gap_truth": {
                                "gap_kind": "graph_edge_gap",
                                "total_delta": 1.0,
                                "failing": [
                                    "build_execution_dependency_surfaces_present",
                                ],
                                "graph_failing": [
                                    "build_execution_surface_semantically_converged",
                                ],
                            },
                            "triage": {
                                "authority_basis": {
                                    "failing_evaluators": [
                                        "build_execution_surface_semantically_converged",
                                    ]
                                },
                                "realized_basis": {
                                    "delta": 1.0,
                                    "delta_summary": "delta = 2",
                                },
                            },
                        }
                    ],
                }
            }
        )

        self.assertFalse(projected["converged"])
        self.assertEqual(projected["total_delta"], 1.0)
        self.assertEqual(projected["graph_total_delta"], 1.0)
        self.assertEqual(len(projected["gaps"]), 1)
        gap = projected["gaps"][0]
        self.assertEqual(gap["edge"], "prepare_build_execution_surface")
        self.assertEqual(gap["delta"], 1.0)
        self.assertEqual(gap["route_state"], "blocked_stale_analysis")
        self.assertEqual(gap["resumption_trigger"], "analysis_published")
        self.assertEqual(
            gap["failing"],
            [
                "build_execution_dependency_surfaces_present",
                "build_execution_surface_semantically_converged",
            ],
        )

    def test_keeps_unpublished_gap_dossier_non_converged(self) -> None:
        projected = world._domain_gap_payload(
            {
                "gap_dossier": {
                    "published": False,
                    "unavailable_reason": "published_analysis_stale",
                    "summary": {
                        "published": False,
                        "unavailable_reason": "published_analysis_stale",
                        "gap_count": 0,
                    },
                    "dossiers": [],
                }
            }
        )

        self.assertFalse(projected["converged"])
        self.assertFalse(projected["graph_converged"])
        self.assertFalse(projected["carry_converged"])
        self.assertFalse(projected["fulfillment_converged"])
        self.assertEqual(projected["unavailable_reason"], "published_analysis_stale")


if __name__ == "__main__":
    unittest.main()

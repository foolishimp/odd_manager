# Implements: REQ-F-ODDSDLC-006
"""Executive program runner derived from the current GTL carrier."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from genesis.result_ingest import ingest_fp_result

from .analysis import refresh_analysis
from .app import OddSdlcApp, active_programs, start
from .constructor import construct_manifest
from .homeostatic_loop import run_homeostatic_self_check
from .install_topology import installed_product_code_root
from .program_catalog import BOOTSTRAP_RELEASE_SELF_TEST, PROGRAM_CATALOG, program_by_name, program_for_edge


def programs() -> list[dict[str, Any]]:
    return [entry.to_dict() for entry in PROGRAM_CATALOG]


def _program_runtime_context(app: OddSdlcApp, *, current_program_name: str, edge: Any) -> dict[str, Any]:
    active = active_programs(app)
    follow_on = None
    if isinstance(edge, str):
        candidate = program_for_edge(edge)
        if candidate is not None and candidate.name != current_program_name:
            follow_on = candidate.to_dict()
    return {
        "active_programs": active,
        "other_active_programs": [entry for entry in active if entry["name"] != current_program_name],
        "follow_on_program": follow_on,
    }


def _program_completed_without_iteration(
    app: OddSdlcApp,
    *,
    program_name: str,
    program_payload: dict[str, Any],
    final_state: dict[str, Any],
) -> dict[str, Any]:
    context = _program_runtime_context(
        app,
        current_program_name=program_name,
        edge=final_state.get("edge"),
    )
    return {
        "status": "ok",
        "program": program_payload,
        "already_converged": True,
        "completed_edges": [],
        "steps": [],
        "final_state": final_state,
        **context,
    }


def _program_pending_without_iteration(
    app: OddSdlcApp,
    *,
    program_name: str,
    program_payload: dict[str, Any],
    final_state: dict[str, Any],
) -> dict[str, Any]:
    context = _program_runtime_context(
        app,
        current_program_name=program_name,
        edge=final_state.get("edge"),
    )
    return {
        "status": "ok",
        "program": program_payload,
        "already_converged": False,
        "blocked_by_pending_dispatch": True,
        "completed_edges": [],
        "steps": [],
        "final_state": final_state,
        **context,
    }


def run_program(app: OddSdlcApp, *, name: str) -> dict[str, Any]:
    program = program_by_name(name)
    program_payload = program.to_dict()
    workspace_root = app.config.workspace_root
    steps: list[dict[str, Any]] = []
    step_index = 0
    pending_retries_for_step = 0
    yielded_retries_for_step = 0

    while step_index < len(program.steps):
        expected_edge = program.steps[step_index]
        refresh_analysis(workspace_root, stage="self_test")
        start_result = start(app)
        status = start_result.get("status")
        actual_edge = start_result.get("edge")
        manifest_path = start_result.get("fp_manifest_path")
        if not steps and status == "converged":
            return _program_completed_without_iteration(
                app,
                program_name=program.name,
                program_payload=program_payload,
                final_state=start_result,
            )
        if not steps and status == "pending":
            if isinstance(actual_edge, str):
                follow_on = program_for_edge(actual_edge)
                if follow_on is not None and follow_on.name != program.name:
                    return _program_completed_without_iteration(
                        app,
                        program_name=program.name,
                        program_payload=program_payload,
                        final_state=start_result,
                    )
                if actual_edge in program.steps:
                    return _program_pending_without_iteration(
                        app,
                        program_name=program.name,
                        program_payload=program_payload,
                        final_state=start_result,
                    )
        if (
            status == "pending"
            and isinstance(actual_edge, str)
            and actual_edge in program.steps
            and isinstance(manifest_path, str)
            and manifest_path
        ):
            resumed_index = program.steps.index(actual_edge)
            if resumed_index != step_index:
                step_index = resumed_index
                expected_edge = program.steps[step_index]
            status = "iterated"
        if status == "pending" and actual_edge == expected_edge:
            if pending_retries_for_step < 1:
                pending_retries_for_step += 1
                continue
            raise RuntimeError(
                f"executive program {program.name!r} remained pending on {expected_edge!r} "
                "after retry"
            )
        if status == "pending" and isinstance(actual_edge, str) and actual_edge in program.steps:
            resumed_index = program.steps.index(actual_edge)
            if resumed_index != step_index:
                step_index = resumed_index
                pending_retries_for_step = 0
                continue
        if status != "iterated":
            raise RuntimeError(
                f"executive program {program.name!r} expected {expected_edge!r} "
                f"but start returned non-iterated status {status!r}"
            )
        if actual_edge != expected_edge:
            if not steps:
                follow_on = program_for_edge(actual_edge) if isinstance(actual_edge, str) else None
                if follow_on is not None and follow_on.name != program.name:
                    return _program_completed_without_iteration(
                        app,
                        program_name=program.name,
                        program_payload=program_payload,
                        final_state=start_result,
                    )
                if isinstance(actual_edge, str) and actual_edge in program.steps:
                    resumed_index = program.steps.index(actual_edge)
                    if resumed_index > step_index:
                        step_index = resumed_index
                        expected_edge = program.steps[step_index]
                if actual_edge != expected_edge:
                    raise RuntimeError(
                        f"executive program {program.name!r} expected {expected_edge!r} "
                        f"but start selected {actual_edge!r}"
                    )
        if not isinstance(manifest_path, str) or not manifest_path:
            raise RuntimeError(
                f"executive program {program.name!r} step {expected_edge!r} "
                "did not produce fp_manifest_path"
            )
        constructor_result = construct_manifest(manifest_path, workspace_root=workspace_root)
        assessed_result = ingest_fp_result(constructor_result["result_path"], workspace_root)
        steps.append(
            {
                "edge": expected_edge,
                "start": start_result,
                "constructor": constructor_result,
                "assessed": assessed_result,
            }
        )
        if assessed_result.get("status") == "yield":
            yielded_retries_for_step += 1
            if yielded_retries_for_step > 4:
                raise RuntimeError(
                    f"executive program {program.name!r} remained yielded on {expected_edge!r} "
                    "after repeated same-edge re-entry"
                )
            pending_retries_for_step = 0
            continue
        if assessed_result.get("status") != "ok":
            raise RuntimeError(
                f"executive program {program.name!r} expected admitted result on {expected_edge!r} "
                f"but assess-result returned {assessed_result.get('status')!r}"
            )
        step_index += 1
        pending_retries_for_step = 0
        yielded_retries_for_step = 0

    final_state = start(app)
    context = _program_runtime_context(
        app,
        current_program_name=program.name,
        edge=final_state.get("edge"),
    )
    return {
        "status": "ok",
        "program": program_payload,
        "already_converged": False,
        "completed_edges": [step["edge"] for step in steps],
        "steps": steps,
        "final_state": final_state,
        **context,
    }


def _emit_boundary_check(workspace_root: Path) -> dict[str, Any]:
    code_root = installed_product_code_root(workspace_root) / "odd_sdlc"
    if not code_root.exists():
        code_root = Path(__file__).resolve().parent
    allowed_emit_import_paths = {"runtime_effects.py"}
    direct_emit_imports: list[str] = []
    for path in sorted(code_root.rglob("*.py")):
        lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
        if any(
            line.startswith("from genesis.events import") and "emit" in line
            for line in lines
        ):
            direct_emit_imports.append(path.name)
    passes = sorted(direct_emit_imports) == sorted(allowed_emit_import_paths)
    return {
        "passes": passes,
        "allowed_emit_import_paths": sorted(allowed_emit_import_paths),
        "observed_emit_import_paths": sorted(direct_emit_imports),
    }


def self_test(app: OddSdlcApp) -> dict[str, Any]:
    result = run_program(app, name=BOOTSTRAP_RELEASE_SELF_TEST.name)
    result["emit_boundary"] = _emit_boundary_check(app.config.workspace_root)
    result["homeostatic_loop"] = run_homeostatic_self_check(app)
    return result

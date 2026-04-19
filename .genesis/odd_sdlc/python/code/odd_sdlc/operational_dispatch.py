# Implements: REQ-F-ODDSDLC-003
"""Local operational dispatch for declarative odd_sdlc command surfaces."""
from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, UTC
from pathlib import Path
from typing import Any

from genesis.result_ingest import ingest_fp_result

from .analysis import refresh_analysis
from .app import OddSdlcApp, active_programs, gap_snapshot, start
from .constructor import construct_manifest
from .project_profile import load_project_profile


OPERATIONAL_DISPATCH_REGISTER_PATH = Path(".ai-workspace/runtime/odd_sdlc-operational-dispatch.json")
OPERATIONAL_DISPATCH_LOG_DIR = Path(".ai-workspace/runtime/operational_dispatch")

_PREPARE_EDGE_TO_RESULT_EDGE = {
    "prepare_build_execution_surface": "derive_build_execution_result_surface",
    "prepare_test_execution_surface": "derive_test_execution_result_surface",
    "prepare_deployment_surface": "derive_deployment_result_surface",
}
_RESULT_EDGE_TO_LANE = {
    "derive_build_execution_result_surface": "build",
    "derive_test_execution_result_surface": "test",
    "derive_deployment_result_surface": "deployment",
}
_RESULT_EDGE_TO_COMMAND_FIELD = {
    "derive_build_execution_result_surface": "build_execution_contract",
    "derive_test_execution_result_surface": "test_execution_contract",
    "derive_deployment_result_surface": "deployment_contract",
}
_PROJECTION_ONLY_EDGES = {
    "derive_deployed_environment_surface",
    "derive_runtime_observation_surface",
    "derive_retrofit_plan_surface",
}


def _timestamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def _register_default() -> dict[str, Any]:
    return {
        "register_kind": "odd_sdlc_operational_dispatch_register",
        "lanes": {},
        "history": [],
    }


def load_operational_dispatch_register(workspace_root: Path) -> dict[str, Any]:
    path = workspace_root / OPERATIONAL_DISPATCH_REGISTER_PATH
    if not path.exists():
        return _register_default()
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return _register_default()
    payload = _register_default()
    payload.update(raw)
    if not isinstance(payload.get("lanes"), dict):
        payload["lanes"] = {}
    if not isinstance(payload.get("history"), list):
        payload["history"] = []
    return payload


def latest_operational_dispatch(workspace_root: Path, lane: str) -> dict[str, Any]:
    payload = load_operational_dispatch_register(workspace_root)
    lanes = payload.get("lanes", {})
    if not isinstance(lanes, dict):
        return {}
    entry = lanes.get(lane, {})
    return dict(entry) if isinstance(entry, dict) else {}


def classify_operational_binding(contract: str) -> str:
    lowered = contract.strip().lower()
    if not lowered:
        return "undeclared"
    if "sbt" in lowered:
        return "local_scala_sbt"
    if "pytest" in lowered:
        return "local_python_pytest"
    if lowered.startswith("python "):
        return "local_python_command"
    return "local_shell_command"


def _write_dispatch_register(workspace_root: Path, entry: dict[str, Any]) -> None:
    path = workspace_root / OPERATIONAL_DISPATCH_REGISTER_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = load_operational_dispatch_register(workspace_root)
    lanes = payload.setdefault("lanes", {})
    history = payload.setdefault("history", [])
    lane = str(entry.get("lane") or "").strip()
    if lane:
        lanes[lane] = entry
    history.append(entry)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _dispatch_local_contract(
    workspace_root: Path,
    *,
    edge: str,
    lane: str,
    contract: str,
) -> dict[str, Any]:
    binding = classify_operational_binding(contract)
    dispatch_id = f"{lane}_{_timestamp()}"
    log_dir = workspace_root / OPERATIONAL_DISPATCH_LOG_DIR / lane / dispatch_id
    log_dir.mkdir(parents=True, exist_ok=True)
    stdout_path = log_dir / "stdout.log"
    stderr_path = log_dir / "stderr.log"

    env = os.environ.copy()
    completed = subprocess.run(
        ["/bin/zsh", "-lc", contract],
        cwd=workspace_root,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    stdout_path.write_text(completed.stdout, encoding="utf-8")
    stderr_path.write_text(completed.stderr, encoding="utf-8")

    status = "succeeded" if completed.returncode == 0 else "failed"
    entry = {
        "dispatch_id": dispatch_id,
        "lane": lane,
        "edge": edge,
        "contract": contract,
        "binding": binding,
        "status": status,
        "exit_code": completed.returncode,
        "stdout_path": str(stdout_path.relative_to(workspace_root)),
        "stderr_path": str(stderr_path.relative_to(workspace_root)),
        "dispatched_at": _timestamp(),
        "completed_at": _timestamp(),
    }
    _write_dispatch_register(workspace_root, entry)
    return entry


def _current_operational_dispatch_step(
    app: OddSdlcApp,
    *,
    expected_edge: str | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    workspace_root = app.config.workspace_root
    completed: list[dict[str, Any]] = []
    current = start(app)
    while current.get("edge") in _PROJECTION_ONLY_EDGES:
        manifest_path = current.get("fp_manifest_path")
        if not isinstance(manifest_path, str) or not manifest_path:
            raise RuntimeError(f"projection edge {current.get('edge')!r} did not produce fp_manifest_path")
        constructor_result = construct_manifest(manifest_path, workspace_root=workspace_root)
        result_admission = ingest_fp_result(constructor_result["result_path"], workspace_root)
        completed.append(
            {
                "kind": "projection",
                "edge": current.get("edge"),
                "start": current,
                "constructor": constructor_result,
                "result_admission": result_admission,
            }
        )
        refresh_analysis(workspace_root, stage="operational_dispatch")
        current = start(app)
    if expected_edge is not None and current.get("edge") != expected_edge:
        raise RuntimeError(
            f"expected operational edge {expected_edge!r} but current edge is {current.get('edge')!r}"
        )
    return current, completed


def dispatch_operational(app: OddSdlcApp) -> dict[str, Any]:
    workspace_root = app.config.workspace_root
    refresh_analysis(workspace_root, stage="operational_dispatch")

    initial = start(app)
    steps: list[dict[str, Any]] = []
    current = initial

    if current.get("edge") in _PREPARE_EDGE_TO_RESULT_EDGE:
        manifest_path = current.get("fp_manifest_path")
        if not isinstance(manifest_path, str) or not manifest_path:
            raise RuntimeError(f"prepare edge {current.get('edge')!r} did not produce fp_manifest_path")
        constructor_result = construct_manifest(manifest_path, workspace_root=workspace_root)
        result_admission = ingest_fp_result(constructor_result["result_path"], workspace_root)
        steps.append(
            {
                "kind": "prepare",
                "edge": current.get("edge"),
                "start": current,
                "constructor": constructor_result,
                "result_admission": result_admission,
            }
        )
        refresh_analysis(workspace_root, stage="operational_dispatch")
        expected_edge = _PREPARE_EDGE_TO_RESULT_EDGE[str(current["edge"])]
        current, projection_steps = _current_operational_dispatch_step(app, expected_edge=expected_edge)
        steps.extend(projection_steps)
    else:
        current, projection_steps = _current_operational_dispatch_step(app)
        steps.extend(projection_steps)

    edge = str(current.get("edge") or "")
    lane = _RESULT_EDGE_TO_LANE.get(edge)
    contract_field = _RESULT_EDGE_TO_COMMAND_FIELD.get(edge)
    if lane is None or contract_field is None:
        return {
            "status": "noop",
            "workspace_root": str(workspace_root),
            "reason": "current edge is not an operational dispatch edge",
            "initial_state": initial,
            "current_state": current,
            "completed_steps": steps,
            "active_programs": active_programs(app),
        }

    profile = load_project_profile(workspace_root)
    contract = str(getattr(profile, contract_field) or "").strip()
    if not contract:
        return {
            "status": "error",
            "workspace_root": str(workspace_root),
            "reason": f"missing declared contract for {lane} operational lane",
            "initial_state": initial,
            "current_state": current,
            "completed_steps": steps,
            "active_programs": active_programs(app),
        }

    dispatch_record = _dispatch_local_contract(
        workspace_root,
        edge=edge,
        lane=lane,
        contract=contract,
    )
    manifest_path = current.get("fp_manifest_path")
    if not isinstance(manifest_path, str) or not manifest_path:
        raise RuntimeError(f"operational edge {edge!r} did not produce fp_manifest_path")
    constructor_result = construct_manifest(manifest_path, workspace_root=workspace_root)
    result_admission = ingest_fp_result(constructor_result["result_path"], workspace_root)
    steps.append(
        {
            "kind": "dispatch",
            "edge": edge,
            "start": current,
            "dispatch": dispatch_record,
            "constructor": constructor_result,
            "result_admission": result_admission,
        }
    )

    refresh_analysis(workspace_root, stage="operational_dispatch")
    final_state, projection_steps = _current_operational_dispatch_step(app)
    steps.extend(projection_steps)
    snapshot = gap_snapshot(app)
    return {
        "status": "ok",
        "workspace_root": str(workspace_root),
        "initial_state": initial,
        "final_state": final_state,
        "completed_steps": steps,
        "gap_snapshot": snapshot,
        "active_programs": active_programs(app),
    }

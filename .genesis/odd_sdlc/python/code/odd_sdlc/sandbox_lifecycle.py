# Implements: REQ-F-VERIFY-003
"""First-class odd_sdlc sandbox lifecycle helpers."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from .install_topology import (
    INSTALLED_PRODUCT_CODE_ROOT_RELATIVE,
    INSTALLED_PRODUCT_DESIGN_ROOT_RELATIVE,
    INSTALLED_PRODUCT_ROOT_RELATIVE,
)


_CODE_DIR = Path(__file__).resolve().parent
_TENANT_ROOT = _CODE_DIR.parents[1]
_DESIGN_FP_ROOT = _TENANT_ROOT / "design" / "fp"
_PACKAGE_ROOT = _CODE_DIR
_APPS_ROOT = _CODE_DIR.parents[4]
_ABI_INSTALLER = _APPS_ROOT / "abiogenesis" / "build_tenants" / "abiogenesis" / "python" / "code" / "gen-install.py"


def install_kernel_sandbox(target: Path) -> dict[str, Any]:
    target.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [sys.executable, str(_ABI_INSTALLER), "--target", str(target), "--project-slug", "odd_sdlc_sandbox"],
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    )
    return json.loads(result.stdout)


def seed_odd_sdlc_package(target: Path) -> None:
    package_root = target / INSTALLED_PRODUCT_CODE_ROOT_RELATIVE
    design_root = target / INSTALLED_PRODUCT_DESIGN_ROOT_RELATIVE
    package_root.mkdir(parents=True, exist_ok=True)
    design_root.mkdir(parents=True, exist_ok=True)
    shutil.copytree(_PACKAGE_ROOT, package_root / "odd_sdlc", dirs_exist_ok=True)
    shutil.copytree(_DESIGN_FP_ROOT, design_root / "fp", dirs_exist_ok=True)


def assert_installed_genesis_runtime(target: Path) -> None:
    runtime_root = target / ".genesis"
    genesis_root = runtime_root / "genesis"
    gtl_root = runtime_root / "gtl"
    required_paths = (
        runtime_root,
        genesis_root,
        gtl_root,
        gtl_root / "obligation_ledger.py",
    )
    missing = [
        path.relative_to(target).as_posix()
        for path in required_paths
        if not path.exists()
    ]
    if missing:
        raise AssertionError(
            "kernel sandbox install must provide the ABG runtime under .genesis; "
            f"missing: {missing}"
        )


def seed_canonical_spec_surface(target: Path) -> None:
    spec_root = target / "specification"
    context_root = target / ".ai-workspace" / "context"
    (spec_root / "requirements").mkdir(parents=True, exist_ok=True)
    context_root.mkdir(parents=True, exist_ok=True)
    (spec_root / "INTENT.md").write_text(
        "# Intent\n\n`odd_sdlc` exists to prove asset-typed GTL/ABG app execution.\n",
        encoding="utf-8",
    )
    (spec_root / "PRODUCT.md").write_text(
        "# Product\n\nThe canonical sandbox use case is a toy app with real GTL publication and ABG runtime audit.\n",
        encoding="utf-8",
    )
    (spec_root / "GOALS.md").write_text(
        "# Goals\n\n- run the sandbox\n- inspect emitted facts\n- reset and rerun\n",
        encoding="utf-8",
    )
    (spec_root / "requirements" / "10-canonical-sandbox.md").write_text(
        "# Canonical Sandbox Requirements\n\nThe sandbox lane must be repeatable.\n",
        encoding="utf-8",
    )
    (context_root / "project_constraints.yml").write_text(
        "\n".join(
            (
                "# Project Constraints — odd_sdlc_sandbox",
                "",
                "project:",
                '  name: "odd_sdlc_sandbox"',
                '  kind: "software-project"',
                '  language: "Python"',
                '  test_runner: "pytest"',
                '  ambiguity_risk_appetite: "medium"',
                "",
                "constraints: {}",
                "",
                "structure:",
                "  design_tenants:",
                '    - name: "python_default"',
                '      output_dir: ""',
                '      description: "Sandbox proving layout"',
                '      build_execution_contract: "python -m build"',
                '      test_execution_contract: "pytest"',
                '      deployment_contract: "docs/deployment-contract.md"',
                '      runtime_observation_contract: "docs/runtime-observation-contract.md"',
                "  root_code_policy: reject",
                "",
            )
        ),
        encoding="utf-8",
    )


def prepare_sandbox(target: Path) -> dict[str, Any]:
    install_payload = install_kernel_sandbox(target)
    assert_installed_genesis_runtime(target)
    seed_odd_sdlc_package(target)
    seed_canonical_spec_surface(target)
    return {
        "status": "prepared",
        "workspace_root": str(target),
        "install": install_payload,
        "runtime_root": ".genesis",
        "product_root": INSTALLED_PRODUCT_ROOT_RELATIVE.as_posix(),
    }


def reset_sandbox_runtime_state(target: Path) -> dict[str, Any]:
    runtime_root = target / ".ai-workspace"
    existed = runtime_root.exists()
    if existed:
        shutil.rmtree(runtime_root)
    return {
        "status": "reset",
        "workspace_root": str(target),
        "runtime_root": ".ai-workspace",
        "removed": existed,
    }


def observe_sandbox(target: Path) -> dict[str, Any]:
    events_path = target / ".ai-workspace" / "events" / "events.jsonl"
    events = []
    if events_path.exists():
        events = [
            json.loads(line)
            for line in events_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    return {
        "workspace_root": str(target),
        "event_count": len(events),
        "latest_event_type": None if not events else events[-1]["event_type"],
        "installer_runtime_present": (target / ".genesis" / "genesis").exists(),
        "product_package_present": (target / INSTALLED_PRODUCT_CODE_ROOT_RELATIVE / "odd_sdlc").exists(),
        "runtime_state_present": (target / ".ai-workspace").exists(),
    }


def sandbox_env(workspace: Path) -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join(
        (
            str(workspace / ".genesis"),
            str(workspace / INSTALLED_PRODUCT_CODE_ROOT_RELATIVE),
        )
    )
    env.pop("PYTEST_CURRENT_TEST", None)
    return env

# Implements: REQ-F-ODDSDLC-003
"""Public installed result-admission and continuation surface for odd_sdlc."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from genesis.result_ingest import ingest_fp_result

from .analysis import refresh_analysis
from .app import OddSdlcApp, active_programs, gap_snapshot


def continue_with_result(app: OddSdlcApp, *, result_path: str | Path) -> dict[str, Any]:
    workspace_root = app.config.workspace_root
    resolved_result_path = Path(result_path).resolve()
    result_admission = ingest_fp_result(resolved_result_path, workspace_root)
    analysis = refresh_analysis(workspace_root, stage="result_admission")
    snapshot = gap_snapshot(app)

    status = result_admission.get("status")
    if status == "ok":
        status = "converged" if snapshot.get("converged") else "continued"

    return {
        "status": status,
        "workspace_root": str(workspace_root),
        "result_path": str(resolved_result_path),
        "result_admission": result_admission,
        "analysis": analysis,
        "gap_snapshot": snapshot,
        "active_programs": active_programs(app),
    }

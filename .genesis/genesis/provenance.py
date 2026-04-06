# Implements: REQ-R-ABG3-PROVENANCE
"""
provenance — Spec/workflow/selection provenance.

req_hash, executable_job_hash, spec_hash_for, _read_workflow_version.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterable
from pathlib import Path

from genesis.binding import ExecutableJob


def req_hash(requirements: list[str]) -> str:
    """
    Compute a stable hash of Module.metadata["requirements"].

    Fallback: used only when scope.workflow_version == "unknown".
    New code should use executable_job_hash(job) instead.
    """
    return hashlib.sha256(
        json.dumps(sorted(requirements)).encode()
    ).hexdigest()[:16]


def executable_job_hash(job: ExecutableJob) -> str:
    """
    Hash of GTL job identity, role semantics, evaluator definitions,
    and bound context digests.

    Covers: GTL job.name, role names, F_D (binding), F_P/F_H (description),
    name+regime for all evaluators, plus every context digest on the vector.
    Uses names (not ids) for cross-process stability — ids are UUID-minted
    at import time. Used as spec_hash when scope.workflow_version != "unknown".
    """
    parts: list[str] = [f"job:{job.job.name}"]
    if job.graph_function is not None:
        parts.append(f"graph_function:{job.graph_function.name}")
    parts.extend(sorted(f"role:{r.name}" for r in job.job.roles))
    parts.extend(sorted(
        f"{ev.name}:{ev.regime.__name__}:{ev.binding}:{ev.description}"
        for ev in job.evaluators
    ))
    parts.extend(sorted(
        f"ctx:{ctx.name}:{ctx.digest}"
        for ctx in (job.vector.contexts or [])
    ))
    raw = "\n".join(re.sub(r'\s+', ' ', line.strip()) for line in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def spec_hash_for(
    *,
    workflow_version: str,
    executable_job: ExecutableJob,
    requirements: Iterable[str] = (),
) -> str:
    """
    Canonical spec-hash policy for command/runtime surfaces.

    Workspaces without a declared workflow version use the requirements hash.
    Versioned workspaces use the executable-job structural hash.
    """
    if workflow_version == "unknown":
        return req_hash(list(requirements))
    return executable_job_hash(executable_job)


def _read_workflow_version(workspace: Path, active_workflow_path: str | None = None) -> str:
    """
    Read active-workflow.json and return "{workflow}@{version}".

    Returns "unknown" on any failure.
    """
    if active_workflow_path:
        active_wf = (workspace / active_workflow_path).resolve()
    else:
        active_wf = workspace / ".ai-workspace" / "runtime" / "active-workflow.json"
    try:
        data = json.loads(active_wf.read_text(encoding="utf-8"))
        workflow = data["workflow"]
        version = data["version"]
        if not isinstance(workflow, str) or not isinstance(version, str):
            return "unknown"
        return f"{workflow}@{version}"
    except Exception:
        return "unknown"

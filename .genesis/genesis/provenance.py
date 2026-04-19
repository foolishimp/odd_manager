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

from . import __version__ as GENESIS_VERSION
from genesis.binding import ExecutableJob
from gtl.graph import interface_contract


DEFAULT_WORKFLOW_NAME = "abiogenesis.standard"
DEFAULT_ACTIVE_WORKFLOW_PATH = Path(".ai-workspace") / "runtime" / "active-workflow.json"


class WorkflowVersionError(ValueError):
    """Raised when runtime workflow provenance metadata is missing or malformed."""


def default_active_workflow_payload() -> dict[str, str]:
    """Return the default mutable workflow metadata for bootstrapped runtimes."""
    return {
        "workflow": DEFAULT_WORKFLOW_NAME,
        "version": GENESIS_VERSION,
    }


def ensure_active_workflow(workspace: Path, active_workflow_path: str | None = None) -> Path:
    """
    Seed active workflow metadata when absent.

    The kernel runtime is provenance-ready by construction. Domain installers may
    later point runtime contracts at a different active_workflow path.
    """
    if active_workflow_path:
        active_wf = (workspace / active_workflow_path).resolve()
    else:
        active_wf = workspace / DEFAULT_ACTIVE_WORKFLOW_PATH
    active_wf.parent.mkdir(parents=True, exist_ok=True)
    if not active_wf.exists():
        active_wf.write_text(
            json.dumps(default_active_workflow_payload(), indent=2) + "\n",
            encoding="utf-8",
        )
    return active_wf


def _contract_token(nodes) -> str:
    return json.dumps(interface_contract(nodes), separators=(",", ":"), sort_keys=False)


def req_hash(requirements: list[str]) -> str:
    """
    Compute a stable hash of Module.metadata["requirements"].

    Retained only for stale-event rejection and migration forensics.
    Runtime provenance must use executable_job_hash(job) instead.
    """
    return hashlib.sha256(
        json.dumps(sorted(requirements)).encode()
    ).hexdigest()[:16]


def executable_job_hash(job: ExecutableJob) -> str:
    """
    Hash of GTL job identity, role semantics, evaluator definitions,
    graph-function environment/materialization identity, and bound context digests.

    Covers: GTL job.name, role names, F_D (binding), F_P/F_H (description),
    name+regime for all evaluators, the graph-function template/environment,
    the materialized vector contract, plus every context digest on the vector.
    Uses names (not ids) for cross-process stability — ids are UUID-minted
    at import time. Used as the canonical runtime spec_hash.
    """
    parts: list[str] = [f"job:{job.job.name}"]
    if job.graph_function is not None:
        parts.append(f"graph_function:{job.graph_function.name}")
        parts.append(
            "template:"
            f"{job.graph_function.template.kind}:"
            f"{job.graph_function.template.ref}:"
            f"{job.graph_function.template.version or ''}"
        )
        parts.append(f"env_requires:{_contract_token(job.graph_function.environment.requires)}")
        parts.append(f"env_provides:{_contract_token(job.graph_function.environment.provides)}")
        parts.append(f"env_carries:{_contract_token(job.graph_function.environment.carries)}")
    if job.materialization_id is not None:
        parts.append(f"materialization:{job.materialization_id}")
    source = job.vector.source if isinstance(job.vector.source, tuple) else (job.vector.source,)
    parts.append(f"vector_inputs:{_contract_token(source)}")
    parts.append(f"vector_outputs:{_contract_token((job.vector.target,))}")
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

    Runtime provenance is versioned by construction. The canonical spec-hash
    binds the active workflow version, executable-job structural identity, and
    current requirements snapshot into one runtime proof token.
    """
    parts = {
        "workflow_version": workflow_version,
        "executable_job_hash": executable_job_hash(executable_job),
        "requirements_hash": req_hash(list(requirements)),
    }
    return hashlib.sha256(
        json.dumps(parts, separators=(",", ":"), sort_keys=True).encode()
    ).hexdigest()[:16]


def _read_workflow_version(workspace: Path, active_workflow_path: str | None = None) -> str:
    """
    Read active-workflow.json and return "{workflow}@{version}".

    Fail closed when workflow metadata is absent or malformed.
    """
    if active_workflow_path:
        active_wf = (workspace / active_workflow_path).resolve()
    else:
        active_wf = workspace / DEFAULT_ACTIVE_WORKFLOW_PATH
    if not active_wf.exists():
        raise WorkflowVersionError(
            f"active workflow metadata missing: {active_wf}"
        )
    try:
        data = json.loads(active_wf.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise WorkflowVersionError(
            f"active workflow metadata is not valid JSON: {active_wf}: {exc}"
        ) from exc
    except OSError as exc:
        raise WorkflowVersionError(
            f"active workflow metadata unreadable: {active_wf}: {exc}"
        ) from exc
    if not isinstance(data, dict):
        raise WorkflowVersionError(
            f"active workflow metadata must be a JSON object: {active_wf}"
        )
    workflow = data.get("workflow")
    version = data.get("version")
    if not isinstance(workflow, str) or not workflow.strip():
        raise WorkflowVersionError(
            f"active workflow metadata missing non-empty 'workflow': {active_wf}"
        )
    if not isinstance(version, str) or not version.strip():
        raise WorkflowVersionError(
            f"active workflow metadata missing non-empty 'version': {active_wf}"
        )
    return f"{workflow}@{version}"

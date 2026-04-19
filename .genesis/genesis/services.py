# Implements: REQ-R-ABG3-INTERPRET
# Implements: REQ-R-ABG3-BINDING
# Implements: REQ-R-ABG3-SELECTION-APPLICATION
"""
genesis.services — Named app services.

Orchestrates kernel modules into user-facing commands:
gen_gaps, gen_iterate, gen_start, Scope.

Three commands as named compositions of core functions. None introduce new
primitives. See ADR-004 (Scope).

  /gen-gaps    = bind_fd over scope → delta_summary fields
  /gen-iterate = discover one unconverged work item → traverse once
  /gen-start   = derive state → select work item → traverse
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from gtl.module_model import Module

from .binding import (
    ExecutableJob,
    Worker,
    module_to_executable_jobs,
)
from .binding import WorkSurface
from .events import EventStream
from .identity import RuntimeIdentity
from .interpret import (
    derive_operational_gaps,
    derive_operational_state,
    plan_next_traversal,
    traverse,
)
from .lineage import _discover_children, active_work_keys
from .provenance import _read_workflow_version
from .selection import (
    validate_job_callable_vectors_are_published,
    validate_module_selection_surface,
    validate_module_traversal_surface,
)


# ── Workflow provenance helpers ───────────────────────────────────────────────

def _read_carry_forward(scope: "Scope") -> list[dict]:
    """
    Read approved_carry_forward from the variant manifest.json.

    Path: {workflow_root}/{pkg}/{variant}/{version}/manifest.json
    where workflow "my_domain.standard@0.2.0" → pkg="my_domain",
    variant="standard", version="0.2.0".

    When scope.workflow_root is set (from genesis.yml runtime contract), it is
    used as the base directory. Otherwise falls back to .genesis/workflows/.

    Returns [] if the manifest is absent or key missing.
    """
    workflow, version = scope.workflow_version.split("@", 1)
    parts = workflow.split(".", 1)
    pkg_name = parts[0]
    variant = parts[1] if len(parts) > 1 else "default"
    version_dir = "v" + version.replace(".", "_")
    if scope.workflow_root:
        wf_base = (scope.workspace_root / scope.workflow_root).resolve()
    else:
        wf_base = scope.workspace_root / ".genesis" / "workflows"
    manifest_path = (
        wf_base / pkg_name / variant / version_dir / "manifest.json"
    )
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        cf = data.get("approved_carry_forward", [])
        return cf if isinstance(cf, list) else []
    except Exception:
        return []


# ── Scope ─────────────────────────────────────────────────────────────────────

@dataclass
class Scope:
    """
    First-class scope object. Every command requires one. No ambient inference.

    Ambiguous scope fails closed — the command returns an error describing the
    available scopes rather than guessing. See ADR-004.

    module: Module — the authoritative entry point. ExecutableJobs and Worker are
        derived directly from Module via module_to_executable_jobs().

    workflow_version: derived at construction from active-workflow.json.
        "{workflow}@{version}" when file present and valid.
        Missing or malformed workflow metadata is a runtime defect.

    Runtime identity is distinct from worker binding. `build` remains nullable
    reporting metadata, not canonical worker/role/binding truth.
    """
    module: Module = None
    workspace_root: Path = field(default_factory=lambda: Path("."))
    work_key_filter: Optional[str] = None   # work_key scope (CLI --feature normalizes here)
    edge_filter: Optional[str] = None       # edge name scope (CLI --edge normalizes here)
    build: str | None = None
    runtime_identity: Optional[RuntimeIdentity] = None
    worker: Optional[Worker] = None   # explicit worker; None = derived
    active_workflow_path: Optional[str] = None  # runtime contract: path to active-workflow.json
    workflow_root: Optional[str] = None         # runtime contract: base dir for workflow releases
    work_key: Optional[str] = None    # work identity (ADR-023); None = global scope
    run_id: Optional[str] = None      # attempt identity (ADR-023); None = global scope
    runtime_config: dict = field(default_factory=dict)
    workflow_version: str = field(init=False, default="")

    def __post_init__(self) -> None:
        if self.module is None:
            raise ValueError("Scope requires a Module.")
        validate_module_selection_surface(self.module)
        validate_job_callable_vectors_are_published(self.module)
        validate_module_traversal_surface(self.module)

        if self.runtime_identity is None:
            self.runtime_identity = RuntimeIdentity(build_id=self.build)
        else:
            self.runtime_identity = self.runtime_identity.with_report_build_id(self.build)

        # Derive Worker from Module's graph-function-bound jobs.
        # ADR-030 §5: a single resolved worker may satisfy all declared roles.
        if self.worker is None:
            jobs = module_to_executable_jobs(self.module)
            role_ids = tuple(r.id for r in self.module.roles)
            self.worker = Worker(
                id=self.runtime_identity.worker_id or self.runtime_identity.engine_id,
                can_execute=jobs,
                role_ids=role_ids,
                authority_ref=self.runtime_identity.authority_ref,
            )

        self.runtime_identity = self.runtime_identity.bind_worker(self.worker)
        self.build = self.runtime_identity.report_build_id()

        self.workflow_version = _read_workflow_version(
            self.workspace_root, self.active_workflow_path
        )


# ── work_key enumeration ────────────────────────────────────────────────────

# active_work_keys is re-exported from .lineage (imported above).


def _resolve_work_keys(scope: "Scope",
                       stream: Optional["EventStream"] = None) -> list[str]:
    """
    Determine active work_keys for this scope.

    Priority:
    1. scope.work_key set explicitly (CLI override) → [scope.work_key]
    2. scope.work_key_filter set (feature_id IS work_key) → [scope.work_key_filter]
    3. Enumerate from active feature vectors + spawned children
    4. Empty list → global scope (no work_key scoping)
    """
    if scope.work_key is not None:
        return [scope.work_key]
    if scope.work_key_filter is not None:
        return [scope.work_key_filter]
    return active_work_keys(scope.workspace_root, stream)


# ── gen_gaps — bind_fd over scope ─────────────────────────────────────────────

def gen_gaps(scope: Scope, stream: EventStream) -> dict:
    """
    /gen-gaps = bind_fd over selected jobs → return delta_summary fields.

    Requires explicit Scope — fails closed on ambiguity.
    Runs bind_fd only (no F_P dispatch).

    Returns: jobs considered, failing evaluators per job, total delta.
    """
    worker = _resolve_worker(scope)
    return derive_operational_gaps(
        module=scope.module,
        workspace_root=scope.workspace_root,
        stream=stream,
        worker=worker,
        jobs=_scoped_jobs(scope, worker),
        work_keys=tuple(_resolve_work_keys(scope, stream)),
        requirements=scope.module.metadata.get("requirements", ()),
        workflow_version=scope.workflow_version,
        runtime_identity=scope.runtime_identity,
        runtime_config=scope.runtime_config,
        edge_filter=scope.edge_filter,
        work_key_filter=scope.work_key_filter,
        carry_forward=_read_carry_forward(scope),
    )


# ── gen_iterate — bind + iterate once ─────────────────────────────────────────

def gen_iterate(
    scope: Scope,
    stream: EventStream,
) -> dict:
    """
    /gen-iterate = bind one executable contract boundary → iterate exactly once.

    The most important command to keep pure.
    One Job. One contract boundary. One iterate call.
    When work_keys are active, selects the first unconverged (job, work_key) pair.
    """
    worker = _resolve_worker(scope)
    jobs = _scoped_jobs(scope, worker)

    if not jobs:
        return {"status": "nothing_to_do", "reason": "no jobs in scope"}

    plan = plan_next_traversal(
        module=scope.module,
        workspace_root=scope.workspace_root,
        stream=stream,
        worker=worker,
        jobs=jobs,
        work_keys=tuple(_resolve_work_keys(scope, stream)),
        requirements=scope.module.metadata.get("requirements", ()),
        workflow_version=scope.workflow_version,
        runtime_identity=scope.runtime_identity,
        build=scope.build,
        edge_filter=scope.edge_filter,
        run_id=scope.run_id,
        runtime_config=scope.runtime_config,
        carry_forward=_read_carry_forward(scope),
    )
    if plan.traversal is None or plan.runtime is None:
        return dict(plan.result)
    outcome = traverse(plan.traversal, runtime=plan.runtime, surface=WorkSurface())

    return outcome.result


# ── gen_start — state machine ──────────────────────────────────────────────────

def gen_start(
    scope: Scope,
    stream: EventStream,
    auto: bool = False,
) -> dict:
    """
    /gen-start = derive state → select job → traverse exactly once.

    Product-layer auto orchestration lives above the engine. The `auto` flag is
    a caller hint for projection and does not change ABG runtime semantics.
    """
    state = _derive_state(scope, stream)

    if state["status"] == "converged":
        _close_completed_features(scope)
        return {
            "status": "converged",
            "message": "All jobs in scope have delta = 0. Run /gen-gaps for full report.",
        }

    if state["status"] == "nothing_to_do":
        return {
            "status": "nothing_to_do",
            "reason": state.get("reason", ""),
        }

    result = gen_iterate(scope, stream)
    if auto:
        result = dict(result)
        result["auto"] = True
    return result


def _derive_state(scope: Scope, stream: EventStream) -> dict:
    """
    Derive project state from workspace. Never stored — always derived.

    Uses typed convergence checking over precomputed manifests.
    """
    worker = _resolve_worker(scope)
    return derive_operational_state(
        workspace_root=scope.workspace_root,
        stream=stream,
        module=scope.module,
        worker=worker,
        jobs=_scoped_jobs(scope, worker),
        work_keys=tuple(_resolve_work_keys(scope, stream)),
        requirements=scope.module.metadata.get("requirements", ()),
        workflow_version=scope.workflow_version,
        edge_filter=scope.edge_filter,
        carry_forward=_read_carry_forward(scope),
    )


# ── internal helpers ──────────────────────────────────────────────────────────

def _resolve_worker(scope: Scope) -> Worker:
    """
    Resolve the worker for the given scope.

    Domain-blind: scope.worker must be explicitly supplied by the caller.
    The CLI resolves worker from --worker flag or .genesis/genesis.yml.
    """
    if scope.worker is None:
        raise RuntimeError(
            "scope.worker is None — supply worker via Scope(worker=...) "
            "or configure .genesis/genesis.yml (written by gen-install.py)"
        )
    return scope.worker


def _scoped_jobs(scope: Scope, worker: Worker) -> list[ExecutableJob]:
    """
    Return jobs from worker.can_execute, filtered by scope overrides.

    edge override: exact match on job.vector.name — narrows which jobs run.

    feature override: existence validation only.
      Single-trajectory scope — Jobs are not tagged by feature_id.
      --feature FEAT-CORE validates that feature exists in the workspace;
      it does not narrow which jobs run (all jobs cover the single trajectory).
      Unknown feature ID → empty list (fails closed; caller reports error).
    """
    jobs = list(worker.can_execute)

    if scope.work_key_filter:
        known = _known_feature_ids(scope.workspace_root)
        if scope.work_key_filter not in known:
            return []  # fail closed — unknown feature

    if scope.edge_filter:
        jobs = [j for j in jobs if j.vector.name == scope.edge_filter]

    return jobs


def _close_completed_features(scope: Scope) -> None:
    """
    Move all active feature YAMLs to features/completed/ and update status field.

    Called by gen_start when it arrives and finds all edges have delta=0 — the
    worker came back, found the work done, closes the ticket.
    """
    active_dir = scope.workspace_root / ".ai-workspace" / "features" / "active"
    completed_dir = scope.workspace_root / ".ai-workspace" / "features" / "completed"
    completed_dir.mkdir(parents=True, exist_ok=True)

    if not active_dir.exists():
        return

    for yml in sorted(active_dir.glob("*.yml")):
        text = yml.read_text(encoding="utf-8")
        # Update status field regardless of current value
        for old_status in ("status: not_started", "status: active", "status: iterating"):
            if old_status in text:
                text = text.replace(old_status, "status: completed", 1)
                break
        (completed_dir / yml.name).write_text(text, encoding="utf-8")
        yml.unlink()


def _known_feature_ids(workspace_root: Path) -> set[str]:
    """Return feature IDs from YAML filenames in .ai-workspace/features/."""
    features_dir = workspace_root / ".ai-workspace" / "features"
    ids: set[str] = set()
    for subdir in ("active", "completed"):
        d = features_dir / subdir
        if d.exists():
            ids.update(f.stem for f in d.glob("*.yml"))
    return ids

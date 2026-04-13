# Implements: REQ-R-ABG3-JOB-WORKER
# Implements: REQ-R-ABG3-BINDING
# Implements: REQ-R-ABG3-WORKER
# Implements: REQ-R-ABG3-PROVENANCE
# Implements: REQ-R-ABG3-CORRECTION
# Implements: REQ-R-ABG3-CONVERGENCE
"""
binding — Executable job resolution, deterministic precomputation, and capability model.

ExecutableJob, WorkSurface, Worker, ContextResolver,
PrecomputedManifest, bind_fd, bind_fp, bind_fh, bind_fp_certified,
run_fd_evaluator, select_relevant_contexts, render_delta.
"""
from __future__ import annotations

import hashlib
import json as _json
import os
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from gtl.function_model import GraphFunction
from gtl.graph import Attrs, Graph, GraphVector, Node, Context, node_contract_key, _schema_key
from gtl.module_model import Module
from gtl.operator_model import Evaluator, F_D, F_H, F_P
from gtl.work_model import Job as GtlJob, Role, ContractRef

from .correction import find_latest_reset
from .events import EventStream
from .materialization import MaterializationRequest, materialize_graph_function
from .projection import project


# ── WorkSurface ────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class WorkSurface:
    """
    Immutable execution dossier — structured side-effect product of execution.

    events:            control surface — appended to event log.
    artifacts:         trace surface — evidence file paths.
    context_consumed:  provenance — Contexts read during execution.
    context_emitted:   provenance — Contexts emitted during execution.
    findings:          structured findings derived during execution.
    attestations:      structured attestations derived during execution.
    metadata:          realized output-side runtime metadata only.
    """
    events: tuple[dict, ...] = ()
    artifacts: tuple[str, ...] = ()
    context_consumed: tuple[Context, ...] = ()
    context_emitted: tuple[Context, ...] = ()
    findings: tuple[dict, ...] = ()
    attestations: tuple[dict, ...] = ()
    metadata: Attrs = field(default_factory=Attrs)

    def __post_init__(self) -> None:
        object.__setattr__(self, "metadata", Attrs.coerce(self.metadata))

    def is_auditable(self) -> bool:
        return bool(
            self.artifacts
            or self.events
            or self.findings
            or self.attestations
        )


# ── ExecutableJob ────────────────────────────────────────────────────────────

@dataclass
class ExecutableJob:
    """
    ABG runtime realization of a GTL Job over one internal GraphVector.

    Public semantic work binds published GraphFunction carriers.
    The runtime materializes that graph function, then traverses internal vectors.
    Source/target are Nodes (typed loci with markov conditions).
    The type signature is the worker capability discriminator.

    Invariant: vector.evaluators must not be empty (Bootloader §XVII).
    """
    job: GtlJob
    graph_function: GraphFunction | None
    materialization_id: str | None
    vector: GraphVector

    def __post_init__(self):
        if not self.vector.evaluators:
            raise ValueError(
                f"ExecutableJob '{self.vector.name}': evaluators must not be empty "
                f"(Bootloader §XVII invariant)"
            )
        if self.job.contracts:
            if any(ref.kind != "graph_function" for ref in self.job.contracts):
                raise ValueError(
                    "ExecutableJob requires GTL job contracts over published graph functions"
                )
            if self.graph_function is None:
                raise ValueError(
                    "ExecutableJob with GTL job contracts requires a resolved GraphFunction carrier"
                )
            contract_ids = {ref.target_id for ref in self.job.contracts}
            if self.graph_function.id not in contract_ids:
                raise ValueError(
                    f"ExecutableJob graph function {self.graph_function.name!r} is not bound by job "
                    f"{self.job.name!r}"
                )

    @property
    def evaluators(self) -> tuple:
        """Evaluators come from the GraphVector — no duplicate surface."""
        return self.vector.evaluators

    @property
    def source_type(self) -> Node | tuple[Node, ...]:
        """Input type — what this job reads."""
        return self.vector.source

    @property
    def target_type(self) -> Node:
        """Output type — what this job writes. Uniquely identifies write territory."""
        return self.vector.target


def module_to_executable_jobs(module: Module) -> list[ExecutableJob]:
    """
    Resolve Module's GTL Jobs to ExecutableJobs.

    Each Job's ContractRef is resolved to a published GraphFunction by id.
    The GraphFunction is materialized and each realized GraphVector becomes one
    executable internal traversal boundary.
    Module.jobs must be populated — no auto-derivation.
    """
    if not module.jobs:
        raise ValueError(
            f"Module {module.name!r} has no explicit jobs. "
            f"All modules must declare jobs with ContractRef bindings."
        )

    gf_by_id: dict[str, GraphFunction] = {}
    for graph_function in module.graph_functions:
        gf_by_id[graph_function.id] = graph_function

    executable_jobs: list[ExecutableJob] = []
    for gtl_job in module.jobs:
        for ref in gtl_job.contracts:
            if ref.kind != "graph_function":
                raise ValueError(
                    f"Unsupported contract kind {ref.kind!r} in job {gtl_job.name!r}. "
                    "This build supports 'graph_function' only."
                )
            graph_function = gf_by_id.get(ref.target_id)
            if graph_function is None:
                raise ValueError(
                    f"ContractRef target_id {ref.target_id!r} in job {gtl_job.name!r} "
                    f"does not resolve to any published GraphFunction in the module."
                )
            record = materialize_graph_function(
                MaterializationRequest(graph_function=graph_function.name),
                module,
                published_graph_functions=(graph_function,),
            )
            for vector in record.graph.vectors:
                executable_jobs.append(
                    ExecutableJob(
                        job=gtl_job,
                        graph_function=graph_function,
                        materialization_id=record.materialization_id,
                        vector=vector,
                    )
                )
    return executable_jobs


# ── Worker ───────────────────────────────────────────────────────────────────

@dataclass
class Worker:
    """
    Concrete actor identity with executable capability.

    Scheduling rule:
        workers with disjoint writable_types run in parallel (safe)
        workers with overlapping writable_types must serialise (conflict)
    """
    id: str
    can_execute: list[ExecutableJob] = field(default_factory=list)
    role_ids: tuple[str, ...] = ()
    authority_ref: str | None = None

    def __post_init__(self):
        if not self.can_execute:
            raise ValueError(f"Worker '{self.id}': can_execute must not be empty")

    @property
    def writable_types(self) -> set[str]:
        """Target asset type names — this worker's write territory."""
        return {j.target_type.name for j in self.can_execute}

    @property
    def readable_types(self) -> set[str]:
        """Source asset type names — what this worker consumes."""
        result: set[str] = set()
        for j in self.can_execute:
            src = j.source_type
            if isinstance(src, tuple):
                result.update(a.name for a in src)
            else:
                result.add(src.name)
        return result

    def conflicts_with(self, other: Worker) -> bool:
        """True if serialisation is required — overlapping write territory."""
        return bool(self.writable_types & other.writable_types)

    def is_eligible(self, job: ExecutableJob) -> bool:
        """
        ADR-030 §5: conjunctive eligibility.

        A worker may lawfully realize a job only when:
        1. the ExecutableJob is in can_execute
        2. the worker satisfies the job's required roles
        3. authority_ref satisfies external policy (not enforced in this build)

        Returns True if eligible, False otherwise. Fails closed.
        """
        if job not in self.can_execute:
            return False
        if job.job.roles:
            required_role_ids = {r.id for r in job.job.roles}
            if not required_role_ids.issubset(set(self.role_ids)):
                return False
        return True


# ── ContextResolver ──────────────────────────────────────────────────────────

class ContextResolver:
    """
    Loads Context content by locator scheme + verifies digest.

    Schemes:
      workspace:// — local file or directory relative to workspace root
      git://        — NOT YET IMPLEMENTED
      event://      — NOT YET IMPLEMENTED
      registry://   — NOT YET IMPLEMENTED
    """

    def __init__(self, workspace_root: Path) -> None:
        self.workspace_root = workspace_root

    def load(self, ctx: Context) -> str:
        """Load context content and verify digest."""
        scheme = ctx.locator.split("://")[0]
        dispatch = {
            "workspace": self._load_workspace,
            "git":       self._load_git,
            "event":     self._load_event,
            "registry":  self._load_registry,
        }
        loader = dispatch.get(scheme)
        if loader is None:
            raise ValueError(f"Unknown context scheme: {scheme!r} in {ctx.locator!r}")

        content = loader(ctx.locator)
        self._verify_digest(ctx, content)
        return content

    def _load_workspace(self, locator: str) -> str:
        path_str = locator[len("workspace://"):]
        path = self.workspace_root / path_str

        if path.is_dir():
            parts: list[str] = []
            for pattern in ("*.md", "*.py", "*.txt", "*.yml"):
                for f in sorted(path.rglob(pattern)):
                    parts.append(f"# {f.relative_to(self.workspace_root)}")
                    parts.append(f.read_text(encoding="utf-8"))
                    parts.append("")
            if not parts:
                raise FileNotFoundError(
                    f"Context directory exists but contains no readable files: {path}"
                )
            return "\n".join(parts)

        if path.is_file():
            return path.read_text(encoding="utf-8")

        raise FileNotFoundError(f"Required context not found: {path}")

    def _load_git(self, locator: str) -> str:
        raise NotImplementedError(
            f"git:// context loading is not yet implemented: {locator!r}"
        )

    def _load_event(self, locator: str) -> str:
        raise NotImplementedError(
            f"event:// context loading is not yet implemented: {locator!r}"
        )

    def _load_registry(self, locator: str) -> str:
        raise NotImplementedError(
            f"registry:// context loading is not yet implemented: {locator!r}"
        )

    def _verify_digest(self, ctx: Context, content: str) -> None:
        """Verify sha256 digest. PENDING digests (all zeros) are skipped."""
        pending = "sha256:" + "0" * 64
        if ctx.digest == pending:
            return

        actual = "sha256:" + hashlib.sha256(content.encode("utf-8")).hexdigest()
        if actual != ctx.digest:
            raise ValueError(
                f"Context digest mismatch for {ctx.name!r}:\n"
                f"  expected: {ctx.digest}\n"
                f"  actual:   {actual}\n"
                "Replay integrity violation — context content has changed."
            )


# ── Runtime Environment ──────────────────────────────────────────────────────


@dataclass(frozen=True)
class ResolvedEnvironmentBinding:
    """
    One runtime binding visible at an executable contract boundary.

    produced_within_carrier distinguishes bindings that must be replay-derived
    from the current carrier from external/root inputs that remain authoritative
    entry conditions.
    """
    node: Node
    projection: dict[str, Any]
    required: bool = False
    provided: bool = False
    produced_within_carrier: bool = False
    required_sources: tuple[str, ...] = ()

    @property
    def display_status(self) -> str:
        status = str(self.projection.get("status", "unknown"))
        if not self.produced_within_carrier and status == "not_started":
            return "external_authority"
        return status


@dataclass(frozen=True)
class ResolvedEnvironment:
    """
    Runtime-resolved cumulative environment snapshot for one executable job.

    requires/provides describe the local execution boundary for the live vector.
    carries preserves the larger published carrier closure when available.
    """
    requires: tuple[Node, ...] = ()
    provides: tuple[Node, ...] = ()
    carries: tuple[Node, ...] = ()
    bindings: tuple[ResolvedEnvironmentBinding, ...] = ()
    vector_source_required_contexts: tuple[str, ...] = ()
    asset_surface_required_contexts: tuple[str, ...] = ()
    asset_surface_injected_required_contexts: tuple[str, ...] = ()
    missing_required: tuple[str, ...] = ()
    missing_asset_surface_contexts: tuple[str, ...] = ()
    conflicting_contracts: tuple[str, ...] = ()

    @classmethod
    def empty(cls) -> "ResolvedEnvironment":
        return cls()

    @property
    def ready(self) -> bool:
        return (
            not self.missing_required
            and not self.missing_asset_surface_contexts
            and not self.conflicting_contracts
        )

    def summary_lines(self) -> list[str]:
        lines: list[str] = []
        if self.asset_surface_injected_required_contexts:
            lines.append(
                "effective runtime boundary includes asset_surface-injected required bindings: "
                + ", ".join(self.asset_surface_injected_required_contexts)
            )
        if self.missing_required:
            lines.append(
                "missing internally produced required bindings: "
                + ", ".join(self.missing_required)
            )
        if self.missing_asset_surface_contexts:
            lines.append(
                "target asset_surface requires undeclared carried contexts: "
                + ", ".join(self.missing_asset_surface_contexts)
            )
        if self.conflicting_contracts:
            lines.append(
                "conflicting carried binding contracts: "
                + ", ".join(self.conflicting_contracts)
            )
        return lines


@dataclass(frozen=True)
class TargetAssetBinding:
    """Concrete workspace binding for a named asset/node when discoverable."""

    asset_id: str
    uri: str
    relative_path: str | None = None
    path_kind: str | None = None
    exists: bool | None = None
    binding_source: str = "workspace_asset_query"

    def to_dict(self) -> dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "uri": self.uri,
            "relative_path": self.relative_path,
            "path_kind": self.path_kind,
            "exists": self.exists,
            "binding_source": self.binding_source,
        }


ASSET_BINDING_QUERY_TIMEOUT_SECONDS: int = int(
    os.environ.get("ASSET_BINDING_QUERY_TIMEOUT_SECONDS", "15")
)


def _coerce_command_tokens(raw: Any, *, label: str) -> list[str]:
    if isinstance(raw, str):
        tokens = shlex.split(raw)
    elif isinstance(raw, (list, tuple)) and all(isinstance(token, str) for token in raw):
        tokens = list(raw)
    else:
        raise ValueError(f"{label} must be a shell-like string or list[str]")
    if not tokens:
        raise ValueError(f"{label} must not be empty")
    return tokens


def _dig_path(payload: Any, dotted_path: str) -> Any:
    current = payload
    for segment in dotted_path.split("."):
        if not isinstance(current, dict) or segment not in current:
            return None
        current = current[segment]
    return current


def _coerce_boolish(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    return None


def _asset_binding_query_contract(runtime_config: dict[str, Any] | None) -> tuple[dict[str, Any] | None, bool]:
    """Return a resolved asset-binding query contract and whether it was explicit."""
    config = dict(runtime_config or {})
    explicit = config.get("asset_binding_contract")
    if explicit is not None:
        if not isinstance(explicit, dict):
            raise ValueError("runtime_config.asset_binding_contract must be a mapping")
        contract = dict(explicit)
        contract["command"] = _coerce_command_tokens(
            contract.get("command"),
            label="runtime_config.asset_binding_contract.command",
        )
        contract.setdefault("assets_key", "assets")
        contract.setdefault("asset_id_key", "asset_id")
        contract.setdefault("uri_key", "uri")
        contract.setdefault("relative_path_key", "metadata.relative_path")
        contract.setdefault("path_kind_key", "checkpoint.path_kind")
        contract.setdefault("exists_key", "checkpoint.exists")
        contract.setdefault("timeout_seconds", ASSET_BINDING_QUERY_TIMEOUT_SECONDS)
        contract.setdefault("binding_source", "runtime_config.asset_binding_contract")
        return contract, True

    domain_package = config.get("domain_package")
    if not isinstance(domain_package, str) or not domain_package.strip():
        return None, False
    return (
        {
            "command": [
                sys.executable,
                "-m",
                domain_package.strip(),
                "query-domain",
                "--workspace",
                ".",
            ],
            "assets_key": "assets",
            "asset_id_key": "asset_id",
            "uri_key": "uri",
            "relative_path_key": "metadata.relative_path",
            "path_kind_key": "checkpoint.path_kind",
            "exists_key": "checkpoint.exists",
            "timeout_seconds": ASSET_BINDING_QUERY_TIMEOUT_SECONDS,
            "binding_source": "runtime_config.domain_package",
        },
        False,
    )


def resolve_workspace_asset_bindings(
    *,
    workspace_root: Path | None,
    runtime_config: dict[str, Any] | None = None,
) -> dict[str, TargetAssetBinding]:
    """
    Resolve concrete asset bindings from an optional workspace asset query surface.

    When runtime_config provides an explicit asset_binding_contract, failures are
    configuration defects and must fail closed. When only a default domain_package
    query is available, discovery remains best-effort.
    """
    contract, explicit = _asset_binding_query_contract(runtime_config)
    if contract is None:
        return {}
    if workspace_root is None:
        if explicit:
            raise ValueError(
                "runtime_config.asset_binding_contract requires a workspace_root"
            )
        return {}

    timeout = contract.get("timeout_seconds", ASSET_BINDING_QUERY_TIMEOUT_SECONDS)
    try:
        result = subprocess.run(
            contract["command"],
            cwd=workspace_root,
            capture_output=True,
            text=True,
            timeout=float(timeout),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        if explicit:
            raise ValueError(
                f"workspace asset query failed: {exc}"
            ) from exc
        return {}

    if result.returncode != 0:
        if explicit:
            detail = result.stderr.strip() or result.stdout.strip() or f"returncode={result.returncode}"
            raise ValueError(f"workspace asset query failed: {detail}")
        return {}

    try:
        payload = _json.loads(result.stdout)
    except _json.JSONDecodeError as exc:
        if explicit:
            raise ValueError("workspace asset query did not return valid JSON") from exc
        return {}

    assets = _dig_path(payload, str(contract["assets_key"]))
    if not isinstance(assets, list):
        if explicit:
            raise ValueError("workspace asset query JSON must expose a list at assets_key")
        return {}

    resolved: dict[str, TargetAssetBinding] = {}
    for entry in assets:
        if not isinstance(entry, dict):
            continue
        asset_id = _dig_path(entry, str(contract["asset_id_key"]))
        uri = _dig_path(entry, str(contract["uri_key"]))
        if not isinstance(asset_id, str) or not asset_id or not isinstance(uri, str) or not uri:
            continue
        relative_path = _dig_path(entry, str(contract["relative_path_key"]))
        path_kind = _dig_path(entry, str(contract["path_kind_key"]))
        exists = _coerce_boolish(_dig_path(entry, str(contract["exists_key"])))
        resolved[asset_id] = TargetAssetBinding(
            asset_id=asset_id,
            uri=uri,
            relative_path=relative_path if isinstance(relative_path, str) and relative_path else None,
            path_kind=path_kind if isinstance(path_kind, str) and path_kind else None,
            exists=exists,
            binding_source=str(contract["binding_source"]),
        )
    return resolved


def _source_nodes(source: Node | tuple[Node, ...]) -> tuple[Node, ...]:
    return source if isinstance(source, tuple) else (source,)


def _stable_node_union(*values: tuple[Node, ...]) -> tuple[Node, ...]:
    merged: list[Node] = []
    seen_names: set[str] = set()
    for nodes in values:
        for node in nodes:
            if node.name in seen_names:
                continue
            seen_names.add(node.name)
            merged.append(node)
    return tuple(merged)


def _materialized_carrier_graph(
    job: ExecutableJob,
    module: Module | None,
) -> Graph | None:
    if module is None or job.graph_function is None:
        return None
    record = materialize_graph_function(
        MaterializationRequest(graph_function=job.graph_function.name),
        module,
        published_graph_functions=(job.graph_function,),
    )
    return record.graph


def resolve_runtime_environment(
    job: ExecutableJob,
    stream: EventStream,
    *,
    module: Module | None = None,
    work_key: str | None = None,
) -> ResolvedEnvironment:
    """
    Resolve the executable runtime environment for one live vector.

    Local execution requires the vector source contract. The carried closure is
    inherited from the published graph function when present, then widened with
    the live vector boundary. Required bindings produced inside the same carrier
    must be replay-visible before dispatch.
    """
    requires = list(_source_nodes(job.vector.source))
    vector_source_required_contexts = tuple(node.name for node in requires)
    provides = (job.vector.target,)
    published_carries = (
        job.graph_function.environment.carries
        if job.graph_function is not None
        else ()
    )
    carries = _stable_node_union(published_carries, tuple(requires), provides)
    carry_nodes_by_name = {node.name: node for node in carries}

    missing_asset_surface_contexts: list[str] = []
    asset_surface_required_contexts: list[str] = []
    asset_surface_injected_required_contexts: list[str] = []
    required_names = {node.name for node in requires}
    for context_name in job.vector.target.asset_surface.required_contexts:
        if context_name not in asset_surface_required_contexts:
            asset_surface_required_contexts.append(context_name)
        context_node = carry_nodes_by_name.get(context_name)
        if context_node is None:
            if context_name not in missing_asset_surface_contexts:
                missing_asset_surface_contexts.append(context_name)
            continue
        if context_name not in required_names:
            requires.append(context_node)
            required_names.add(context_name)
            asset_surface_injected_required_contexts.append(context_name)
    requires = tuple(requires)

    contract_by_name: dict[str, tuple[str, str, tuple[str, ...]]] = {}
    conflicting_contracts: list[str] = []
    for node in carries:
        contract = node_contract_key(node)
        existing = contract_by_name.get(node.name)
        if existing is None:
            contract_by_name[node.name] = contract
            continue
        if existing != contract and node.name not in conflicting_contracts:
            conflicting_contracts.append(node.name)

    materialized_graph = _materialized_carrier_graph(job, module)
    produced_within_carrier = (
        {vector.target.name for vector in materialized_graph.vectors}
        if materialized_graph is not None
        else set()
    )

    bindings: list[ResolvedEnvironmentBinding] = []
    binding_by_name: dict[str, ResolvedEnvironmentBinding] = {}
    provided_names = {node.name for node in provides}
    for node in carries:
        if node.name in binding_by_name:
            continue
        binding = ResolvedEnvironmentBinding(
            node=node,
            projection=project(stream, node.name, "current", work_key=work_key),
            required=node.name in required_names,
            provided=node.name in provided_names,
            produced_within_carrier=node.name in produced_within_carrier,
            required_sources=tuple(
                source
                for source, enabled in (
                    ("vector_source", node.name in vector_source_required_contexts),
                    ("asset_surface", node.name in asset_surface_required_contexts),
                )
                if enabled
            ),
        )
        bindings.append(binding)
        binding_by_name[node.name] = binding

    missing_required = tuple(
        node.name
        for node in requires
        if node.name not in conflicting_contracts
        and binding_by_name[node.name].produced_within_carrier
        and binding_by_name[node.name].projection.get("status") == "not_started"
    )

    return ResolvedEnvironment(
        requires=requires,
        provides=provides,
        carries=carries,
        bindings=tuple(bindings),
        vector_source_required_contexts=vector_source_required_contexts,
        asset_surface_required_contexts=tuple(asset_surface_required_contexts),
        asset_surface_injected_required_contexts=tuple(asset_surface_injected_required_contexts),
        missing_required=missing_required,
        missing_asset_surface_contexts=tuple(missing_asset_surface_contexts),
        conflicting_contracts=tuple(conflicting_contracts),
    )


# ── PrecomputedManifest and BoundJob ─────────────────────────────────────────

@dataclass
class PrecomputedManifest:
    """
    F_D pre-computation output. The residual gap.

    passing_evaluators are NEVER included in the F_P prompt.
    """
    executable_job: ExecutableJob
    current_asset: dict
    failing_evaluators: list[Evaluator]
    passing_evaluators: list[Evaluator]
    fd_results: dict[str, Any]
    relevant_contexts: dict[str, str]
    resolved_environment: ResolvedEnvironment = field(default_factory=ResolvedEnvironment.empty)
    missing_contexts: list[str] = field(default_factory=list)
    delta_summary: str = ""

    @property
    def has_gap(self) -> bool:
        return bool(self.failing_evaluators) or not self.resolved_environment.ready

    @property
    def unresolved_count(self) -> int:
        return len(self.failing_evaluators) + (0 if self.resolved_environment.ready else 1)

    @property
    def delta(self) -> float:
        total = len(self.executable_job.evaluators)
        if total == 0:
            return 0.0
        return self.unresolved_count / total


@dataclass
class BoundJob:
    """Implementation helper — an executable job with resolved context, ready for F_P dispatch."""
    executable_job: ExecutableJob
    precomputed: PrecomputedManifest
    prompt: str
    result_path: str = ""
    manifest_id: str = ""
    worker_id: str = ""
    role_id: str = ""
    authority_ref: str = ""
    selected_worker_id: str = ""
    selected_backend: str = ""
    assignment_source: str = ""
    resolved_runtime_ref: str = ""
    target_asset_binding: dict[str, Any] | None = None
    environment_asset_bindings: dict[str, dict[str, Any]] = field(default_factory=dict)
    target_asset_surface: dict[str, Any] | None = None
    environment_asset_surfaces: dict[str, dict[str, Any]] = field(default_factory=dict)
    runtime_environment_contract: dict[str, Any] = field(default_factory=dict)


def _asset_surface_summary(node: Node) -> dict[str, Any] | None:
    surface = node.asset_surface
    if not surface.declared:
        return None
    return {
        "kind": surface.kind,
        "schema": _schema_key(node.schema),
        "required_contexts": list(surface.required_contexts),
        "standards_refs": list(surface.standards_refs),
        "output_contract_refs": list(surface.output_contract_refs),
    }


def _runtime_environment_contract_summary(
    resolved_environment: ResolvedEnvironment,
) -> dict[str, Any]:
    return {
        "vector_source_required_contexts": list(
            resolved_environment.vector_source_required_contexts
        ),
        "asset_surface_required_contexts": list(
            resolved_environment.asset_surface_required_contexts
        ),
        "asset_surface_injected_required_contexts": list(
            resolved_environment.asset_surface_injected_required_contexts
        ),
        "effective_required_contexts": [
            node.name for node in resolved_environment.requires
        ],
    }


def _event_time_value(event: dict) -> datetime | None:
    raw = event.get("event_time")
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


# ── F_H gate — Event Calculus ────────────────────────────────────────────────

def bind_fh(
    job: ExecutableJob,
    all_events: list[dict],
    current_workflow_version: str = "unknown",
    carry_forward: list[dict] | None = None,
    *,
    work_key: str | None = None,
) -> bool:
    """
    Evaluate holdsAt(operative(edge, work_key, wv), now) for the F_H gate.

    Event Calculus semantics:
      approved{kind: fh_review}  initiates  operative(edge, work_key, wv)
      approved{kind: fh_intent}  initiates  operative(edge, work_key, wv)
      revoked{kind: fh_approval} terminates operative(edge, work_key, wv)
    """
    if carry_forward is None:
        carry_forward = []

    latest_approved_time: datetime | None = None
    found_approved = False

    for e in all_events:
        etype = e.get("event_type")
        edata = e.get("data", {})

        is_approved = (
            etype == "approved" and edata.get("kind") in ("fh_review", "fh_intent")
        )

        if is_approved and edata.get("edge") == job.vector.name:
            if work_key is not None:
                event_wk = edata.get("work_key")
                if event_wk is not None and event_wk != work_key:
                    continue
            elif edata.get("work_key") is not None:
                continue
            if current_workflow_version == "unknown":
                found_approved = True
                latest_approved_time = _event_time_value(e)
                continue

            ev_wv = edata.get("workflow_version")

            if ev_wv == current_workflow_version:
                found_approved = True
                latest_approved_time = _event_time_value(e)
                continue

            for cf in carry_forward:
                if (cf.get("edge") == job.vector.name
                        and cf.get("from_version") == ev_wv
                        and cf.get("work_key", None) == (work_key or None)):
                    found_approved = True
                    latest_approved_time = _event_time_value(e)
                    break

    if not found_approved:
        return False

    for e in all_events:
        etype = e.get("event_type")
        edata = e.get("data", {})
        if etype == "revoked" and edata.get("kind") == "fh_approval":
            revoked_edge = edata.get("edge")
            if revoked_edge == job.vector.name or revoked_edge == "*":
                rev_wk = edata.get("work_key")
                if work_key is not None and rev_wk is not None and rev_wk != work_key:
                    continue
                if work_key is None and rev_wk is not None:
                    continue
                if current_workflow_version != "unknown":
                    rev_wv = edata.get("workflow_version")
                    if rev_wv != current_workflow_version:
                        continue
                event_time = _event_time_value(e)
                if latest_approved_time is None or (event_time is not None and event_time > latest_approved_time):
                    return False

    return True


# ── F_P certification — Event Calculus ───────────────────────────────────────

def bind_fp_certified(
    job: ExecutableJob,
    ev: Evaluator,
    all_events: list[dict],
    spec_hash: str | None = None,
    current_workflow_version: str = "unknown",
    *,
    work_key: str | None = None,
) -> bool:
    """
    Evaluate holdsAt(certified(edge, work_key, evaluator, spec_hash, wv), now).

    Reset boundary (ADR-026): certifications before the latest applicable reset
    are shadowed.
    """
    reset_boundary = find_latest_reset(all_events, edge=job.vector.name, work_key=work_key)
    reset_time = _event_time_value(reset_boundary) if reset_boundary else None

    latest_assessed_time: datetime | None = None
    found_assessed = False

    for e in all_events:
        etype = e.get("event_type")
        edata = e.get("data", {})

        is_assessed = (
            etype == "assessed"
            and edata.get("kind") == "fp"
            and edata.get("edge") == job.vector.name
            and edata.get("evaluator") == ev.name
            and edata.get("result") == "pass"
        )

        if is_assessed:
            if spec_hash is not None and edata.get("spec_hash") != spec_hash:
                continue
            if work_key is not None:
                event_wk = edata.get("work_key")
                if event_wk is not None and event_wk != work_key:
                    continue
            elif edata.get("work_key") is not None:
                continue
            event_time = _event_time_value(e)
            if reset_time is not None and event_time is not None and event_time <= reset_time:
                continue
            found_assessed = True
            latest_assessed_time = event_time

    if not found_assessed:
        return False

    for e in all_events:
        etype = e.get("event_type")
        edata = e.get("data", {})
        if etype == "revoked" and edata.get("kind") == "fp_assessment":
            revoked_edge = edata.get("edge")
            if revoked_edge == job.vector.name or revoked_edge == "*":
                rev_wk = edata.get("work_key")
                if work_key is not None and rev_wk is not None and rev_wk != work_key:
                    continue
                if work_key is None and rev_wk is not None:
                    continue
                if current_workflow_version != "unknown":
                    rev_wv = edata.get("workflow_version")
                    if rev_wv != current_workflow_version:
                        continue
                event_time = _event_time_value(e)
                if latest_assessed_time is None or (event_time is not None and event_time > latest_assessed_time):
                    return False

    return True


# ── F_D evaluator runner ──────────────────────────────────────────────────────

FD_TIMEOUT_SECONDS: int = int(os.environ.get("FD_TIMEOUT_SECONDS", "120"))


def run_fd_evaluator(
    ev: Evaluator,
    current_asset: dict,
    workspace_root: Path,
    *,
    work_key: str | None = None,
) -> tuple[bool, Any]:
    """
    Run one F_D evaluator. Returns (passes: bool, detail: Any).

    Fails closed: an F_D evaluator with no binding is a misconfigured evaluator.
    """
    if ev.regime is not F_D:
        raise TypeError(
            f"run_fd_evaluator called on non-F_D evaluator: {ev.name!r} "
            f"(regime={ev.regime.__name__})"
        )
    # Extract shell command from binding URI (ABG runtime concern)
    shell_command = ev.binding
    if shell_command.startswith("exec://"):
        shell_command = shell_command[len("exec://"):]
    if not shell_command:
        return False, {
            "status": "error",
            "reason": f"F_D evaluator {ev.name!r} has no binding — misconfigured evaluator",
        }

    env = os.environ.copy()
    extra = os.pathsep.join(p for p in sys.path if p)
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = os.pathsep.join(filter(None, [extra, existing]))
    if work_key is not None:
        env["WORK_KEY"] = work_key

    try:
        result = subprocess.run(
            shell_command, shell=True, cwd=workspace_root,
            capture_output=True, text=True, env=env,
            timeout=FD_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return False, {
            "status": "timeout",
            "reason": (
                f"F_D evaluator {ev.name!r} exceeded {FD_TIMEOUT_SECONDS}s wall-clock limit. "
                "Check that the command does not re-enter orchestration (start/iterate/gaps/emit-event) "
                "and excludes long-running test suites."
            ),
        }
    return result.returncode == 0, {
        "returncode": result.returncode,
        "stdout": result.stdout[-3000:],
        "stderr": result.stderr[-500:],
    }


# ── bind_fd ───────────────────────────────────────────────────────────────────

def bind_fd(
    job: ExecutableJob,
    stream: EventStream,
    resolver: ContextResolver,
    workspace_root: Path,
    spec_hash: str | None = None,
    current_workflow_version: str = "unknown",
    carry_forward: list[dict] | None = None,
    module: Module | None = None,
    *,
    work_key: str | None = None,
) -> PrecomputedManifest:
    """
    F_D pre-computation phase. Everything computable without an LLM.
    Produces the residual gap — the minimal surface F_P must address.
    """
    resolved_environment = resolve_runtime_environment(
        job,
        stream,
        module=module,
        work_key=work_key,
    )
    source_name = resolved_environment.requires[0].name
    current = next(
        (
            binding.projection
            for binding in resolved_environment.bindings
            if binding.node.name == source_name
        ),
        project(stream, source_name, "current", work_key=work_key),
    )

    all_events = stream.all_events()
    fd_results: dict[str, Any] = {}
    for ev in job.evaluators:
        if ev.regime is F_D:
            passes, detail = run_fd_evaluator(
                ev, current, workspace_root, work_key=work_key,
            )
            fd_results[ev.name] = {"passes": passes, "detail": detail}

    def _passes(ev: Evaluator) -> bool:
        if ev.regime is F_D:
            return fd_results.get(ev.name, {}).get("passes", False)
        if ev.regime is F_H:
            return bind_fh(
                job, all_events, current_workflow_version, carry_forward,
                work_key=work_key,
            )
        if ev.regime is F_P:
            return bind_fp_certified(
                job, ev, all_events, spec_hash, current_workflow_version,
                work_key=work_key,
            )
        return False

    failing = [ev for ev in job.evaluators if not _passes(ev)]
    passing = [ev for ev in job.evaluators if _passes(ev)]

    relevant_ctxs = select_relevant_contexts(job.vector.contexts, failing)
    resolved: dict[str, str] = {}
    _missing_contexts: list[str] = []
    for ctx in relevant_ctxs:
        try:
            resolved[ctx.name] = resolver.load(ctx)
        except NotImplementedError as exc:
            resolved[ctx.name] = f"[context unavailable: {exc}]"
        except FileNotFoundError as exc:
            resolved[ctx.name] = f"[context not found: {exc}]"
            _missing_contexts.append(ctx.name)

    summary = render_delta(fd_results, failing, environment=resolved_environment)

    return PrecomputedManifest(
        executable_job=job,
        current_asset=current,
        resolved_environment=resolved_environment,
        failing_evaluators=failing,
        passing_evaluators=passing,
        fd_results=fd_results,
        relevant_contexts=resolved,
        missing_contexts=_missing_contexts,
        delta_summary=summary,
    )


# ── bind_fp ───────────────────────────────────────────────────────────────────

def bind_fp(
    pre: PrecomputedManifest,
    job: ExecutableJob,
    result_path: str = "",
    *,
    workspace_root: Path | None = None,
    runtime_config: dict[str, Any] | None = None,
) -> BoundJob:
    """
    Assemble the minimal F_P manifest from pre-computed material.
    Raises FileNotFoundError if required context failed to resolve.
    """
    if pre.missing_contexts:
        raise FileNotFoundError(
            f"Cannot dispatch F_P: required context(s) not found: "
            f"{', '.join(pre.missing_contexts)}. "
            f"Fix the context locators or provide the missing files before iterating."
        )
    if not pre.resolved_environment.ready:
        details = pre.resolved_environment.summary_lines()
        raise ValueError(
            "Cannot dispatch F_P: runtime environment unresolved: "
            + "; ".join(details)
        )
    asset_bindings = resolve_workspace_asset_bindings(
        workspace_root=workspace_root,
        runtime_config=runtime_config,
    )
    target_binding = asset_bindings.get(job.vector.target.name)
    if asset_bindings and target_binding is None:
        raise ValueError(
            f"Cannot dispatch F_P: target asset binding for {job.vector.target.name!r} "
            "is not present in the workspace asset query surface."
        )
    prompt = _assemble_prompt(
        pre,
        job,
        result_path,
        asset_bindings=asset_bindings,
        target_binding=target_binding,
    )
    environment_names = {
        env_binding.node.name
        for env_binding in pre.resolved_environment.bindings
    }
    return BoundJob(
        executable_job=job,
        precomputed=pre,
        prompt=prompt,
        result_path=result_path,
        target_asset_binding=None if target_binding is None else target_binding.to_dict(),
        environment_asset_bindings={
            name: binding.to_dict()
            for name, binding in asset_bindings.items()
            if name in environment_names
        },
        target_asset_surface=_asset_surface_summary(job.vector.target),
        environment_asset_surfaces={
            binding.node.name: summary
            for binding in pre.resolved_environment.bindings
            if (summary := _asset_surface_summary(binding.node)) is not None
        },
        runtime_environment_contract=_runtime_environment_contract_summary(
            pre.resolved_environment
        ),
    )


def _assemble_prompt(
    pre: PrecomputedManifest,
    job: ExecutableJob,
    result_path: str = "",
    *,
    asset_bindings: dict[str, TargetAssetBinding] | None = None,
    target_binding: TargetAssetBinding | None = None,
) -> str:
    """Assemble the F_P prompt."""
    sections: list[str] = []
    asset_bindings = asset_bindings or {}

    src = job.vector.source
    if isinstance(src, tuple):
        src_name = " × ".join(a.name for a in src)
        src_markov = {a.name: a.markov for a in src}
    else:
        src_name = src.name
        src_markov = {src.name: src.markov}
    precond_lines = [
        "[PRECONDITIONS] — upstream asset stability (these hold):"
    ]
    for name, conditions in src_markov.items():
        if conditions:
            precond_lines.append(f"  {name}: {conditions}")
        else:
            precond_lines.append(f"  {name}: (no markov conditions)")
    sections.append("\n".join(precond_lines))

    sections.append(
        f"[CURRENT STATE]\n"
        f"Edge: {job.vector.name}\n"
        f"Source asset: {src_name}\n"
        f"Target asset: {job.vector.target.name}\n"
        f"Status: {pre.current_asset.get('status', 'unknown')}\n"
        f"Edges converged: {pre.current_asset.get('edges_converged', [])}"
    )

    gap_lines = [f"[GAP] — {len(pre.failing_evaluators)} evaluator(s) failing:"]
    for ev in pre.failing_evaluators:
        detail = pre.fd_results.get(ev.name, {})
        gap_lines.append(f"  {ev.name} ({ev.regime.__name__}): {ev.description}")
        if detail:
            gap_lines.append(f"    F_D result: {detail.get('detail', detail)}")
    if not pre.failing_evaluators:
        gap_lines.append("  (none — all evaluators pass)")
    sections.append("\n".join(gap_lines))

    fd_failures = [ev for ev in pre.failing_evaluators if ev.regime is F_D]
    if fd_failures:
        deterministic_lines = [
            "[DETERMINISTIC FAILURES] — clear these before asking for assessment:"
        ]
        for ev in fd_failures:
            detail = pre.fd_results.get(ev.name, {}).get("detail", {})
            if isinstance(detail, dict):
                reason = (
                    str(detail.get("stderr", "")).strip()
                    or str(detail.get("stdout", "")).strip()
                    or str(detail)
                )
            else:
                reason = str(detail)
            deterministic_lines.append(f"  {ev.name}: {reason}")
        sections.append("\n".join(deterministic_lines))

    if pre.relevant_contexts:
        ctx_lines = ["[CONTEXT] — constraint surface for this edge:"]
        for name, content in pre.relevant_contexts.items():
            ctx_lines.append(f"\n--- {name} ---\n{content}")
        sections.append("\n".join(ctx_lines))

    target = job.vector.target
    mandatory_contexts = tuple(
        dict.fromkeys(
            list(
                name
                for name in pre.relevant_contexts
                if "standard" in name or "output_contract" in name or "contract" in name
            )
            + list(target.asset_surface.standards_refs)
            + list(target.asset_surface.output_contract_refs)
        )
    )

    if pre.resolved_environment.bindings:
        env_lines = ["[ENVIRONMENT] — resolved runtime environment for this edge:"]
        for binding in pre.resolved_environment.bindings:
            roles: list[str] = []
            if binding.required:
                roles.append("required")
            if binding.provided:
                roles.append("provided")
            if not roles:
                roles.append("carried")
            origin = (
                "internal_carrier"
                if binding.produced_within_carrier
                else "external_entry"
            )
            required_via_suffix = ""
            if binding.required_sources:
                required_via_suffix = (
                    " required_via=" + "+".join(binding.required_sources)
                )
            asset_kind_suffix = ""
            if binding.node.asset_surface.kind:
                asset_kind_suffix = f" asset_kind={binding.node.asset_surface.kind}"
            asset_binding = asset_bindings.get(binding.node.name)
            location_suffix = ""
            if asset_binding is not None:
                location_parts = []
                if asset_binding.relative_path:
                    location_parts.append(f"path={asset_binding.relative_path}")
                if asset_binding.path_kind:
                    location_parts.append(f"kind={asset_binding.path_kind}")
                if asset_binding.exists is not None:
                    location_parts.append(f"exists={str(asset_binding.exists).lower()}")
                if asset_binding.uri:
                    location_parts.append(f"uri={asset_binding.uri}")
                if location_parts:
                    location_suffix = " " + " ".join(location_parts)
            env_lines.append(
                f"  {binding.node.name} [{', '.join(roles)}] "
                f"schema={binding.node.schema!r} status={binding.display_status} origin={origin}"
                f"{required_via_suffix}{asset_kind_suffix}{location_suffix}"
            )
        if not pre.resolved_environment.ready:
            env_lines.extend(
                f"  BLOCKED: {line}"
                for line in pre.resolved_environment.summary_lines()
            )
        sections.append("\n".join(env_lines))

    contract_summary = _runtime_environment_contract_summary(pre.resolved_environment)
    boundary_lines = [
        "[REQUIRED BOUNDARY] — invocation-local effective required bindings for this edge:",
        "  vector_source_required_contexts: "
        + (
            ", ".join(contract_summary["vector_source_required_contexts"])
            or "(none)"
        ),
        "  asset_surface_required_contexts: "
        + (
            ", ".join(contract_summary["asset_surface_required_contexts"])
            or "(none)"
        ),
        "  asset_surface_injected_required_contexts: "
        + (
            ", ".join(contract_summary["asset_surface_injected_required_contexts"])
            or "(none)"
        ),
        "  effective_required_contexts: "
        + (
            ", ".join(contract_summary["effective_required_contexts"])
            or "(none)"
        ),
        "  note: this merge is invocation-local runtime interpretation, not a rewrite of published GTL module topology.",
    ]
    sections.append("\n".join(boundary_lines))

    if target.asset_surface.declared:
        asset_surface_lines = [
            "[ASSET SURFACE] — declared target asset contract:",
            f"  kind: {target.asset_surface.kind or '(unspecified)'}",
            f"  schema: {_schema_key(target.schema)}",
        ]
        if target.asset_surface.required_contexts:
            asset_surface_lines.append(
                "  required_contexts: " + ", ".join(target.asset_surface.required_contexts)
            )
        if target.asset_surface.standards_refs:
            asset_surface_lines.append(
                "  standards_refs: " + ", ".join(target.asset_surface.standards_refs)
            )
        if target.asset_surface.output_contract_refs:
            asset_surface_lines.append(
                "  output_contract_refs: "
                + ", ".join(target.asset_surface.output_contract_refs)
            )
        sections.append("\n".join(asset_surface_lines))

    if target_binding is not None:
        target_lines = [
            "[TARGET BINDING] — concrete workspace destination for the produced asset:",
            f"  asset_id: {target_binding.asset_id}",
            f"  uri: {target_binding.uri}",
        ]
        if target_binding.relative_path:
            target_lines.append(f"  relative_path: {target_binding.relative_path}")
        if target_binding.path_kind:
            target_lines.append(f"  path_kind: {target_binding.path_kind}")
        if target_binding.exists is not None:
            target_lines.append(f"  exists: {str(target_binding.exists).lower()}")
        sections.append("\n".join(target_lines))

    fp_failing = [ev for ev in pre.failing_evaluators if ev.regime is F_P]
    assessment_contract = ""
    if fp_failing and result_path:
        ev_assessments = [
            f'{{"evaluator": "{ev.name}", "result": "pass|fail", "evidence": "..."}}'
            for ev in fp_failing
        ]
        assessment_contract = (
            f"\n\nWrite assessment JSON to: {result_path}\n"
            f"Format: {{{{'edge': '{job.vector.name}', 'actor': '<your_agent_id>', 'assessments': [{', '.join(ev_assessments)}]}}}}\n"
            "The app reads this file and emits assessed events — do NOT call emit-event yourself."
        )

    sections.append(
        f"[OUTPUT CONTRACT]\n"
        f"Produce: {target.name} asset\n"
        f"Satisfying markov conditions: {target.markov}\n"
        f"Evaluators to pass: {[ev.name for ev in pre.failing_evaluators]}"
        + assessment_contract
    )

    execution_lines = [
        "[EXECUTION RULES]",
        "- Update the workspace artifact(s), not just the assessment file.",
        "- Clear every deterministic F_D failure before treating the work as done.",
        "- Treat standards and output-contract contexts as mandatory acceptance checks.",
        "- Self-check the artifact against the target markov conditions before writing assessment JSON.",
    ]
    if mandatory_contexts:
        execution_lines.append(
            "- Mandatory contexts for this edge: " + ", ".join(mandatory_contexts)
        )
    sections.append("\n".join(execution_lines))

    return "\n\n".join(sections)


# ── select_relevant_contexts ──────────────────────────────────────────────────

def select_relevant_contexts(
    all_contexts: list[Context],
    failing: list[Evaluator],
) -> list[Context]:
    """F_D: filter contexts to those relevant to the failing evaluators."""
    if not failing:
        return []
    fp_failing = [ev for ev in failing if ev.regime is F_P]
    if not fp_failing:
        return []
    return list(all_contexts)


# ── render_delta ─────────────────────────────────────────────────────────────

def render_delta(
    fd_results: dict[str, Any],
    failing: list[Evaluator],
    environment: ResolvedEnvironment | None = None,
) -> str:
    """Render a structured human-readable gap description."""
    if environment is not None and not environment.ready and not failing:
        lines = ["delta = 1 — runtime environment unresolved:"]
        lines.extend(f"  {line}" for line in environment.summary_lines())
        return "\n".join(lines)

    if not failing:
        return "delta = 0 — all evaluators pass"

    lines = [f"delta = {len(failing)} — {len(failing)} evaluator(s) failing:"]
    for ev in failing:
        detail = fd_results.get(ev.name, {})
        det = detail.get("detail", detail) if isinstance(detail, dict) else detail
        lines.append(f"  {ev.name} ({ev.regime.__name__}): {det}")
    if environment is not None and not environment.ready:
        lines.append("  runtime environment unresolved:")
        lines.extend(f"    {line}" for line in environment.summary_lines())

    return "\n".join(lines)

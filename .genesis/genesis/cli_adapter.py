# Implements: REQ-R-ABG3-INTERPRET
# Implements: REQ-R-ABG3-SELFHOSTING
# Implements: REQ-P-POLICY
"""
genesis.cli_adapter — CLI adapter.

Parser construction, command wiring, traceability checks.
Named cli_adapter to avoid collision with stdlib cli modules.

Usage:
  python -m genesis start  [--auto] [--human-proxy] [--feature F] [--edge E] [--workspace W]
  python -m genesis iterate [--feature F] [--edge E] [--workspace W]
  python -m genesis gaps    [--feature F] [--workspace W]
  python -m genesis run-status [--run-id RUN] [--workspace W]
  python -m genesis assess-result --result PATH [--workspace W]
  python -m genesis emit-event --type TYPE [--data JSON] [--workspace W]
  python -m genesis check-tags --type implements|validates --path PATH

  gen start ...   (via project.scripts entry point)

Exit codes for start/iterate:
  0 — converged or nothing_to_do
  1 — error
  2 — fp_dispatched (F_P actor required; fp_manifest_path in output)
  3 — fh_gate_pending (F_H evaluation required; gate criteria in output)
"""
from __future__ import annotations

import argparse
import json
import shlex
import sys
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="genesis",
        description="Genesis engine — GTL-native runtime",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # ── gen start ────────────────────────────────────────────────────────────
    p_start = sub.add_parser("start", help="Derive state → bind → iterate")
    p_start.add_argument("--auto", action="store_true",
                         help="Loop until converged or blocked by F_H gate")
    p_start.add_argument("--human-proxy", action="store_true",
                         help="Allow F_H gates to be evaluated by proxy (requires --auto)")
    p_start.add_argument("--supervised-root", action="store_true",
                         help="Run start --auto under root supervision with live recovery/status projection")
    p_start.add_argument("--feature", metavar="F",
                         help="Scope to a specific feature vector ID")
    p_start.add_argument("--edge", metavar="E",
                         help="Override edge selection")
    p_start.add_argument("--workspace", metavar="W", default=".",
                         help="Workspace root (default: cwd)")

    # ── gen iterate ───────────────────────────────────────────────────────────
    p_iter = sub.add_parser("iterate", help="Bind one Job → iterate exactly once")
    p_iter.add_argument("--feature", metavar="F", help="Feature vector ID")
    p_iter.add_argument("--edge", metavar="E", help="Edge name")
    p_iter.add_argument("--workspace", metavar="W", default=".",
                        help="Workspace root (default: cwd)")

    # ── gen gaps ──────────────────────────────────────────────────────────────
    p_gaps = sub.add_parser("gaps", help="bind_fd over scope → delta summary")
    p_gaps.add_argument("--feature", metavar="F",
                        help="Scope to a specific feature vector ID")
    p_gaps.add_argument("--workspace", metavar="W", default=".",
                        help="Workspace root (default: cwd)")

    # --module on all three engine commands
    for p in (p_start, p_iter, p_gaps):
        p.add_argument("--module", metavar="MODULE:VAR",
                       help="Module to load (overrides genesis.yml)")

    # ── gen run-status ───────────────────────────────────────────────────────
    p_status = sub.add_parser("run-status", help="Project live operator-grade run status")
    p_status.add_argument("--run-id", metavar="RUN",
                          help="Specific run id to inspect (defaults to latest run in workspace)")
    p_status.add_argument("--workspace", metavar="W", default=".",
                          help="Workspace root (default: cwd)")

    # ── emit-event ────────────────────────────────────────────────────────────
    p_emit = sub.add_parser("emit-event",
                            help="Append one event to .ai-workspace/events/events.jsonl")
    p_emit.add_argument("--type", required=True, metavar="TYPE",
                        help="Event type (e.g. approved, assessed, revoked)")
    p_emit.add_argument("--data", default="{}", metavar="JSON",
                        help="Event data as a JSON object (default: {})")
    p_emit.add_argument("--workspace", metavar="W", default=".",
                        help="Workspace root (default: cwd)")

    # ── assess-result ──────────────────────────────────────────────────────────
    p_assess = sub.add_parser("assess-result",
                              help="Ingest F_P result JSON and emit assessed events")
    p_assess.add_argument("--result", required=True, metavar="PATH",
                          help="Path to F_P result JSON file")
    p_assess.add_argument("--workspace", metavar="W", default=".",
                          help="Workspace root (default: cwd)")

    # ── check-tags ────────────────────────────────────────────────────────────
    p_tags = sub.add_parser("check-tags",
                            help="Verify Implements:/Validates: tags in source files")
    p_tags.add_argument("--type", choices=["implements", "validates"], required=True,
                        help="Tag type to check")
    p_tags.add_argument("--path", required=True,
                        help="Directory to scan")

    # ── check-req-coverage ────────────────────────────────────────────────────
    p_cov = sub.add_parser("check-req-coverage",
                           help="Verify every REQ-* key in a Module appears in a feature vector")
    p_cov.add_argument("--package", required=True, metavar="MODULE:VAR",
                       help="Import path to a Module object, e.g. my_domain.spec:module")
    p_cov.add_argument("--features", required=True,
                       help="Directory containing feature vector YAML files")

    # ── check-impl-coverage ───────────────────────────────────────────────────
    p_impl = sub.add_parser("check-impl-coverage",
                            help="Verify every REQ-* key appears in a # Implements: tag")
    p_impl.add_argument("--package", required=True, metavar="MODULE:VAR",
                        help="Module to load requirements from")
    p_impl.add_argument("--path", required=True,
                        help="Directory to scan for # Implements: tags")

    # ── check-validates-coverage ──────────────────────────────────────────────
    p_val = sub.add_parser("check-validates-coverage",
                           help="Verify every REQ-* key appears in a # Validates: tag")
    p_val.add_argument("--package", required=True, metavar="MODULE:VAR",
                       help="Module to load requirements from")
    p_val.add_argument("--path", required=True,
                       help="Directory to scan for # Validates: tags")

    # ── check-bootloader-consistency ─────────────────────────────────────────
    p_boot = sub.add_parser("check-bootloader-consistency",
                            help="Verify bootloader doc references all exported types from spec module")
    p_boot.add_argument("--spec-module", required=True,
                        help="Python module to extract exported type names from (e.g. gtl)")
    p_boot.add_argument("--bootloader", required=True,
                        help="Path to bootloader markdown file (relative to workspace)")

    return parser


def _check_tags(tag_type: str, scan_path: str) -> int:
    """
    Scan .py files for required tags.

    Implements: checks for '# Implements:'
    Validates:  checks for '# Validates:'

    Exits 0 if all files are tagged, 1 if any are untagged.
    Prints untagged file paths to stdout.
    """
    tag = "# Implements:" if tag_type == "implements" else "# Validates:"
    path = Path(scan_path)

    if not path.exists():
        print(f"ERROR: path does not exist: {path}", file=sys.stderr)
        return 1

    # Directories to skip: run archives, caches, installed workspace copies
    _SKIP_DIRS = {"runs", "__pycache__", ".pytest_cache", "node_modules", ".venv", "venv"}

    def _should_skip(filepath: Path) -> bool:
        return any(part in _SKIP_DIRS for part in filepath.parts)

    untagged = []
    for f in sorted(path.rglob("*.py")):
        if f.name == "__init__.py":
            continue
        if _should_skip(f):
            continue
        if tag not in f.read_text(encoding="utf-8"):
            untagged.append(str(f))

    all_files = [f for f in path.rglob("*.py")
                 if f.name != "__init__.py" and not _should_skip(f)]
    result = {
        "tag": tag,
        "path": str(path),
        "scanned": len(all_files),
        "untagged_count": len(untagged),
        "untagged": untagged,
        "passes": len(untagged) == 0,
    }
    print(json.dumps(result, indent=2))
    return 0 if result["passes"] else 1


def _check_req_coverage(package_ref: str, features_dir: str) -> int:
    """
    Verify every REQ-* key in Module.metadata appears in at least one feature vector.

    Exits 0 if all keys covered, 1 if any gaps exist.
    Prints a JSON result to stdout.
    """
    import re

    features = Path(features_dir)
    if not features.exists():
        print(json.dumps({"error": f"features dir not found: {features_dir}"}), file=sys.stderr)
        return 1

    if ":" not in package_ref:
        print(json.dumps({"error": f"--package must be MODULE:VAR, got {package_ref!r}"}),
              file=sys.stderr)
        return 1
    module_name, var_name = package_ref.rsplit(":", 1)
    try:
        import importlib
        mod = importlib.import_module(module_name)
    except ImportError as exc:
        print(json.dumps({"error": f"cannot import {module_name}: {exc}"}), file=sys.stderr)
        return 1
    pkg = getattr(mod, var_name, None)
    if pkg is None:
        print(json.dumps({"error": f"{var_name!r} not found in {module_name}"}),
              file=sys.stderr)
        return 1
    reqs = []
    if hasattr(pkg, "metadata") and isinstance(pkg.metadata, Mapping):
        reqs = pkg.metadata.get("requirements", [])
    spec_keys = set(reqs)
    source = f"package:{package_ref}"

    # ── Scan feature vectors for covered keys ────────────────────────────────
    covered_keys: set[str] = set()
    for yml in features.rglob("*.yml"):
        text = yml.read_text(encoding="utf-8")
        covered_keys.update(re.findall(r"REQ-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*", text))

    uncovered = sorted(spec_keys - covered_keys)
    result = {
        "spec": source,
        "features_dir": features_dir,
        "spec_keys": sorted(spec_keys),
        "covered_count": len(spec_keys) - len(uncovered),
        "total_count": len(spec_keys),
        "uncovered": uncovered,
        "passes": len(uncovered) == 0,
    }
    print(json.dumps(result, indent=2))
    return 0 if result["passes"] else 1


def _check_tag_coverage(tag_type: str, package_ref: str, scan_path: str) -> int:
    """
    Verify every REQ-* key in Module.metadata["requirements"] appears in at least one file
    with the appropriate tag (# Implements: or # Validates:).

    This is the per-key complement to check-tags (which checks file-level presence).
    A new REQ key with no Implements/Validates tag causes this check to fail,
    making spec evolution deterministically detectable by F_D.
    """
    import importlib
    import re

    if ":" not in package_ref:
        print(json.dumps({"error": f"--package must be MODULE:VAR, got {package_ref!r}"}),
              file=sys.stderr)
        return 1

    module_name, var_name = package_ref.rsplit(":", 1)
    try:
        mod = importlib.import_module(module_name)
    except ImportError as exc:
        print(json.dumps({"error": f"cannot import {module_name}: {exc}"}), file=sys.stderr)
        return 1

    pkg = getattr(mod, var_name, None)
    if pkg is None:
        print(json.dumps({"error": f"{var_name!r} not found in {module_name}"}),
              file=sys.stderr)
        return 1

    # Module: requirements in metadata
    reqs = []
    if hasattr(pkg, "metadata") and isinstance(pkg.metadata, Mapping):
        reqs = pkg.metadata.get("requirements", [])
    req_keys = list(reqs)
    path = Path(scan_path)
    if not path.exists():
        print(json.dumps({"error": f"path not found: {scan_path}"}), file=sys.stderr)
        return 1

    tag_prefix = "# Implements:" if tag_type == "implements" else "# Validates:"

    # Collect all REQ-* keys found in matching tag lines across all .py files
    tagged_keys: set[str] = set()
    for f in path.rglob("*.py"):
        if f.name == "__init__.py":
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            if tag_prefix in line:
                tagged_keys.update(re.findall(r"REQ-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*", line))

    missing = sorted(set(req_keys) - tagged_keys)
    result = {
        "tag_type": tag_type,
        "path": str(path),
        "spec_keys": sorted(req_keys),
        "tagged_count": len(req_keys) - len(missing),
        "total_count": len(req_keys),
        "missing": missing,
        "passes": len(missing) == 0,
    }
    print(json.dumps(result, indent=2))
    return 0 if result["passes"] else 1


def _assess_result_cmd(result_path: str, workspace: Path) -> int:
    """
    Ingest an F_P result JSON file, publish typed fulfillment truth, and emit assessed events.

    This is the app-level consumer that closes the result_path protocol:
      1. F_P actor writes fulfillment-assessment JSON to result_path
      2. This command reads it, resolves provenance from the matching manifest
      3. Publishes a merged fulfillment ledger and emits assessed{kind: fp} events

    The result file format (as declared in the manifest OUTPUT CONTRACT):
      {"edge": "X→Y", "actor": "agent_id", "fulfillment_assessments": [
        {
          "id": "obligation-id",
          "evaluator": "declared-evaluator-name",
          "fulfillment_status": "fulfilled|partial|blocked|unfulfilled",
          "fulfillment_detail": "...",
          "blocking_reasons": ["..."],
          "evidence_refs": ["..."]
        }
      ]}

    Callable by both the skill layer (gen-start.md) and the test harness.
    """
    from .result_ingest import ingest_fp_result

    try:
        summary = ingest_fp_result(
            result_path,
            workspace,
            active_workflow_path=_load_project_config(workspace).get("active_workflow"),
            emit_event=_emit_workspace_event,
        )
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    output = dict(summary)
    output["command"] = "assess-result"
    print(json.dumps(output, indent=2))
    return 0


def _emit_event_cmd(event_type: str, data_json: str, workspace: Path) -> int:
    """
    Append one event to .ai-workspace/events/events.jsonl.

    This is an F_D-controlled write path called by the skill layer (gen-start.md),
    never by F_P actors directly. F_P actors write to result_path; the skill reads
    the result and calls emit-event. See GTL Bootloader §V (event-time invariant).

    Governance: required fields validated per event type (prime operators).
      approved  — requires: kind (fh_review | fh_intent), edge, actor (human | human-proxy)
        human-proxy actor additionally requires: proxy_log
      assessed  — requires: kind, edge
      kind=fp additionally requires: obligation_id, spec_hash, published_ledger_ref
      revoked   — requires: kind (fh_approval), edge, actor, reason
    """
    import json as _json

    from .provenance import WorkflowVersionError, _read_workflow_version

    try:
        data = _json.loads(data_json)
    except _json.JSONDecodeError as exc:
        print(f"ERROR: --data is not valid JSON: {exc}", file=sys.stderr)
        return 1

    # Governance validation — required fields per prime event types
    errors: list[str] = []
    if event_type == "approved":
        if "kind" not in data:
            errors.append("approved requires 'kind' field (fh_review | fh_intent)")
        if "edge" not in data:
            errors.append("approved requires 'edge' field")
        if "actor" not in data:
            errors.append("approved requires 'actor' field (human | human-proxy)")
        elif data["actor"] == "human-proxy" and "proxy_log" not in data:
            errors.append("human-proxy actor requires 'proxy_log' path field")
    elif event_type == "assessed":
        # Assessed has two schemas split by kind:
        #   kind=fp        — F_P fulfillment publication pointer: requires obligation_id, spec_hash, published_ledger_ref
        #   kind=fh_review — F_H human rejection: requires actor, reason
        for fld in ("kind", "edge"):
            if fld not in data:
                errors.append(f"assessed requires '{fld}' field")
        kind = data.get("kind")
        if kind == "fp":
            for fld in ("obligation_id", "spec_hash", "published_ledger_ref"):
                if fld not in data:
                    errors.append(f"assessed{{kind: fp}} requires '{fld}' field")
            if "published_ledger_ref" in data:
                from .fulfillment_ledger import coerce_published_fulfillment_ledger_ref

                try:
                    coerce_published_fulfillment_ledger_ref(data["published_ledger_ref"])
                except ValueError as exc:
                    errors.append(str(exc))
        elif kind == "fh_review":
            for fld in ("actor", "reason"):
                if fld not in data:
                    errors.append(f"assessed{{kind: fh_review}} requires '{fld}' field")
            if data.get("result") not in (None, "reject"):
                errors.append("assessed{kind: fh_review} 'result' must be 'reject'")
    elif event_type == "revoked":
        for fld in ("kind", "edge", "actor", "reason"):
            if fld not in data:
                errors.append(f"revoked requires '{fld}' field")
        if data.get("kind") not in (None, "fh_approval"):
            errors.append(f"revoked 'kind' must be 'fh_approval', got '{data.get('kind')!s}'")

    if event_type == "reset":
        if "scope" not in data:
            errors.append("reset requires 'scope' field (workspace | work_key | edge)")
        elif data["scope"] not in ("workspace", "work_key", "edge"):
            errors.append(f"reset 'scope' must be workspace, work_key, or edge, got '{data['scope']}'")
        else:
            if data["scope"] in ("work_key", "edge") and "work_key" not in data:
                errors.append(f"reset with scope='{data['scope']}' requires 'work_key' field")
            if data["scope"] == "edge" and "edge" not in data:
                errors.append("reset with scope='edge' requires 'edge' field")
        for fld in ("actor", "reason"):
            if fld not in data:
                errors.append(f"reset requires '{fld}' field")

    if errors:
        for msg in errors:
            print(f"ERROR: {msg}", file=sys.stderr)
        return 1

    # Annotate workflow_version from active-workflow.json.
    # Reads the file directly — emit-event runs pre-stack without a Scope object.
    # Honour the runtime contract: if genesis.yml declares active_workflow, use it.
    _config = _load_project_config(workspace)
    try:
        workflow_version = _read_workflow_version(
            workspace, _config.get("active_workflow")
        )
    except WorkflowVersionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    data["workflow_version"] = workflow_version
    _emit_workspace_event(
        workspace,
        event_type,
        data,
        workflow_version=workflow_version,
        work_key=data.get("work_key") if isinstance(data.get("work_key"), str) else None,
        run_id=data.get("run_id") if isinstance(data.get("run_id"), str) else None,
    )

    print(_json.dumps({"status": "ok", "event_type": event_type}))
    return 0


def _parse_yaml_config(config_path: Path) -> dict:
    """
    Parse a simple YAML config file — key: value pairs and YAML lists.

    Returns a dict. 'pythonpath' (and any list-valued key) is returned as list[str].
    Returns empty dict if the file does not exist.
    """
    if not config_path.exists():
        return {}
    config: dict = {}
    current_list_key: str | None = None
    for line in config_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            current_list_key = None
            continue
        # YAML list item under a current list key
        if current_list_key is not None and stripped.startswith("- "):
            config[current_list_key].append(stripped[2:].strip())
            continue
        current_list_key = None
        if ":" in stripped:
            key, _, val = stripped.partition(":")
            key = key.strip()
            val = val.strip()
            if val == "":
                # Key with no inline value — start a list
                config[key] = []
                current_list_key = key
            else:
                config[key] = val
    return config


def _load_project_config(workspace: Path) -> dict:
    """
    Load the project runtime contract.

    Single entry point: .genesis/genesis.yml (written by ABG kernel installer).
    If the config contains a `runtime_contract` key, that path is read as the
    authoritative override (domain installer sets this when it installs).

    Discovery chain:
      1. Read .genesis/genesis.yml
      2. If it contains runtime_contract: <path>, read that file instead
      3. Otherwise use the kernel config as-is

    The kernel never hardcodes domain-specific paths. Domain installers
    set runtime_contract in .genesis/genesis.yml to point to their own contract.
    """
    kernel_config = _parse_yaml_config(workspace / ".genesis" / "genesis.yml")

    contract_ref = kernel_config.get("runtime_contract")
    if contract_ref:
        contract_path = (workspace / contract_ref).resolve()
        if contract_path.exists():
            return _parse_yaml_config(contract_path)

    return kernel_config


def _emit_workspace_event(
    workspace: Path,
    event_type: str,
    data: dict,
    *,
    workflow_version: str = "unknown",
    work_key: str | None = None,
    run_id: str | None = None,
) -> None:
    """
    Route app-level event commands through the canonical ABG emission surface.

    CLI commands may validate and annotate payloads, but they do not append to
    the event log directly.
    """
    from .events import EventContext, EventStream, emit

    emit(
        event_type,
        data,
        stream=EventStream.open(workspace),
        context=EventContext(
            workflow_version=workflow_version,
            work_key=work_key,
            run_id=run_id,
        ),
        package_snapshot_id=None,
    )


def _run_status_cmd(workspace: Path, run_id: str | None) -> int:
    from .live_status import project_live_run_status

    status = project_live_run_status(
        workspace,
        run_id=run_id,
        runtime_config=_load_project_config(workspace),
    )
    print(json.dumps(status, indent=2))
    return 0


def _import_symbol(ref: str, workspace: Path):
    """
    Import MODULE:VAR from workspace. Returns the symbol.

    Raises ValueError if ref has no colon.
    Raises ImportError if the module or variable cannot be found.
    """
    if ":" not in ref:
        raise ValueError(f"Expected MODULE:VAR, got {ref!r}")
    module_name, _, var_name = ref.partition(":")
    import importlib
    try:
        mod = importlib.import_module(module_name)
    except ImportError as exc:
        raise ImportError(f"Cannot import {module_name!r}: {exc}") from exc
    sym = getattr(mod, var_name, None)
    if sym is None:
        raise ImportError(f"{var_name!r} not found in {module_name!r}")
    return sym


def _resolve_configured_worker(config: dict, workspace: Path):
    """Resolve the configured Worker from the runtime contract when declared."""
    worker_ref = config.get("worker")
    if not isinstance(worker_ref, str) or ":" not in worker_ref:
        return None
    try:
        worker = _import_symbol(worker_ref, workspace)
    except (ImportError, ValueError):
        return None

    from .binding import Worker

    return worker if isinstance(worker, Worker) else None


def _resolve_runtime_identity(config: dict, worker=None):
    """Resolve the structured runtime identity from flat runtime-contract fields."""
    from .identity import RuntimeIdentity

    def _read(key: str) -> str | None:
        value = config.get(key)
        if isinstance(value, str) and value:
            return value
        return None

    identity = RuntimeIdentity(
        engine_id=_read("runtime_engine") or "genesis",
        build_id=_read("runtime_build"),
        worker_id=_read("runtime_worker_id"),
        backend_id=_read("runtime_backend"),
        authority_ref=_read("runtime_authority_ref"),
        assignment_source=_read("runtime_assignment_source"),
        resolved_runtime_ref=_read("runtime_resolved_runtime_ref"),
    )
    return identity.bind_worker(worker)


def _emit_human_proxy_approval(workspace: Path, edge: str) -> None:
    reviews_dir = workspace / ".ai-workspace" / "reviews"
    reviews_dir.mkdir(parents=True, exist_ok=True)
    proxy_log = reviews_dir / "human_proxy.log"
    with proxy_log.open("a", encoding="utf-8") as handle:
        handle.write(f"{datetime.now(timezone.utc).isoformat()} approved {edge}\n")

    payload = {
        "kind": "fh_review",
        "edge": edge,
        "actor": "human-proxy",
        "proxy_log": str(proxy_log),
    }
    rc = _emit_event_cmd("approved", json.dumps(payload), workspace)
    if rc != 0:
        raise RuntimeError(f"human proxy approval failed for edge {edge!r}")


def _run_start_auto(
    scope,
    stream,
    *,
    workspace: Path,
    config: dict | None,
    human_proxy: bool,
) -> dict:
    """CLI-side auto loop with engine-owned F_P dispatch and CLI-owned F_H proxy handling."""
    from .dispatch_runtime import auto_dispatch_from_result
    from .proof_hold import project_proof_hold
    from .services import gen_start

    max_auto = 50
    result: dict = {}

    for _ in range(max_auto):
        result = gen_start(scope, stream, auto=False)
        result["auto"] = True
        if human_proxy:
            result["human_proxy"] = True

        if result["status"] in ("converged", "nothing_to_do"):
            return result

        blocking_reason = result.get("blocking_reason")
        if blocking_reason == "fp_dispatch":
            proof_hold = project_proof_hold(
                workspace,
                edge=result.get("edge") if isinstance(result.get("edge"), str) else None,
                work_key=result.get("work_key") if isinstance(result.get("work_key"), str) else None,
                spec_hash=None,
                workflow_version=None,
                manifest_id=result.get("manifest_id") if isinstance(result.get("manifest_id"), str) else None,
                runtime_config=config,
            )
            if proof_hold.get("held"):
                result["status"] = "pending"
                result["proof_hold"] = proof_hold
                result["proof_hold_active"] = True
                result["stopped_by"] = "proof_hold"
                return result
            dispatch_result = auto_dispatch_from_result(
                result,
                workspace,
                config=config or {},
            )
            if dispatch_result.get("status") == "ok":
                continue
            if dispatch_result.get("status") == "yield":
                result.update(dispatch_result)
                result["stopped_by"] = dispatch_result.get("stopped_by", "yield")
                return result
            result.update(dispatch_result)
            result["stopped_by"] = dispatch_result.get("stopped_by", "fp_runtime_failure")
            return result

        if blocking_reason == "fh_gate" and human_proxy:
            edge = str(result.get("edge") or result.get("fh_gate", {}).get("edge") or "").strip()
            if not edge:
                result["stopped_by"] = "fh_gate"
                result["human_proxy_error"] = "missing edge for fh_gate approval"
                return result
            _emit_human_proxy_approval(workspace, edge)
            continue

        if result["status"] == "pending":
            if blocking_reason:
                result["stopped_by"] = blocking_reason
            return result

        if blocking_reason is not None:
            result["stopped_by"] = blocking_reason
            return result

    result["auto"] = True
    if human_proxy:
        result["human_proxy"] = True
    result["stopped_by"] = "max_iterations"
    return result


def _attach_pending_recovery_contract(result: Mapping[str, object], workspace: Path) -> dict[str, object]:
    enriched = dict(result)
    if enriched.get("status") != "pending":
        return enriched

    manifest_path: Path | None = None
    manifest_path_value = enriched.get("fp_manifest_path")
    if isinstance(manifest_path_value, str) and manifest_path_value:
        manifest_path = Path(manifest_path_value)
    else:
        manifest_id = enriched.get("manifest_id")
        if isinstance(manifest_id, str) and manifest_id:
            manifest_path = workspace / ".ai-workspace" / "fp_manifests" / f"{manifest_id}.json"

    manifest: dict[str, object] = {}
    if manifest_path is not None and manifest_path.exists():
        try:
            raw_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw_manifest = {}
        if isinstance(raw_manifest, Mapping):
            manifest = dict(raw_manifest)

    result_path = enriched.get("fp_result_path")
    if not isinstance(result_path, str) or not result_path:
        manifest_result_path = manifest.get("result_path")
        if isinstance(manifest_result_path, str) and manifest_result_path:
            result_path = manifest_result_path
            enriched["fp_result_path"] = result_path

    recovery: dict[str, object] = {}
    if isinstance(enriched.get("manifest_id"), str) and enriched["manifest_id"]:
        recovery["manifest_id"] = enriched["manifest_id"]
    if manifest_path is not None:
        recovery["fp_manifest_path"] = str(manifest_path)
    if isinstance(result_path, str) and result_path:
        recovery["fp_result_path"] = result_path
        recovery["next_step"] = "assess-result"
        recovery["assess_result_command"] = " ".join(
            shlex.quote(part)
            for part in (
                "python",
                "-m",
                "genesis",
                "assess-result",
                "--result",
                result_path,
                "--workspace",
                str(workspace),
            )
        )
    if recovery:
        enriched["recovery"] = recovery
    return enriched


def _run_start_auto_supervised(
    scope,
    stream,
    *,
    workspace: Path,
    config: dict | None,
    human_proxy: bool,
) -> dict:
    from .live_status import project_live_run_status

    result = _run_start_auto(
        scope,
        stream,
        workspace=workspace,
        config=config,
        human_proxy=human_proxy,
    )
    result["root_supervision"] = True
    result["live_status"] = project_live_run_status(workspace, runtime_config=config)

    if (
        result.get("status") == "error"
        and result.get("failure_class") == "transport_failure"
        and isinstance(result.get("live_status"), Mapping)
        and result["live_status"].get("result_artifact_valid") is True
    ):
        resumed = _run_start_auto(
            scope,
            stream,
            workspace=workspace,
            config=config,
            human_proxy=human_proxy,
        )
        resumed["root_supervision"] = True
        resumed["resumed_after_transport_failure"] = True
        resumed["live_status"] = project_live_run_status(workspace, runtime_config=config)
        return resumed

    return result


def _resolve_module(args, workspace: Path):
    """
    Resolve Module from --module flag or runtime contract (genesis.yml).

    Precedence: CLI flags > runtime contract > error.
    Returns Module — Scope derives Worker natively.
    """
    from gtl.module_model import Module

    mod_ref = getattr(args, "module", None) or None

    config = _load_project_config(workspace)
    mod_ref = mod_ref or config.get("module")

    if not mod_ref:
        print(
            "ERROR: no module configured.\n"
            "  Pass --module MODULE:VAR, or\n"
            "  run the domain installer to create the runtime contract",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        module = _import_symbol(mod_ref, workspace)
    except (ImportError, ValueError) as exc:
        print(f"ERROR: --module {mod_ref!r}: {exc}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(module, Module):
        print(
            f"ERROR: {mod_ref!r} resolved to {type(module).__name__}, expected Module",
            file=sys.stderr,
        )
        sys.exit(1)

    return module


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    # Lightweight commands — no engine stack needed.
    # These are pure F_D file-scanning commands: no events emitted, no provenance,
    # no workflow_version. They are explicitly out of runtime contract scope.
    if args.command == "check-tags":
        sys.exit(_check_tags(args.type, args.path))
    if args.command == "check-req-coverage":
        sys.exit(_check_req_coverage(
            package_ref=args.package,
            features_dir=args.features,
        ))
    if args.command == "check-impl-coverage":
        sys.exit(_check_tag_coverage("implements", args.package, args.path))
    if args.command == "check-validates-coverage":
        sys.exit(_check_tag_coverage("validates", args.package, args.path))
    if args.command == "check-bootloader-consistency":
        from .selfhosting import _check_bootloader_consistency
        sys.exit(_check_bootloader_consistency(args.spec_module, args.bootloader))

    # assess-result: ingest F_P result JSON → emit assessed events
    if args.command == "assess-result":
        workspace = Path(args.workspace).resolve()
        sys.exit(_assess_result_cmd(args.result, workspace))

    # emit-event: appends one event to events.jsonl — no engine stack needed
    if args.command == "emit-event":
        workspace = Path(args.workspace).resolve()
        sys.exit(_emit_event_cmd(args.type, args.data, workspace))
    if args.command == "run-status":
        workspace = Path(args.workspace).resolve()
        sys.exit(_run_status_cmd(workspace, getattr(args, "run_id", None)))

    # --human-proxy requires --auto
    if getattr(args, "human_proxy", False) and not getattr(args, "auto", False):
        print(json.dumps({"status": "error",
                          "reason": "--human-proxy requires --auto"}))
        sys.exit(1)

    # All other commands need the engine
    workspace = Path(getattr(args, "workspace", ".")).resolve()

    # Ensure spec is importable from workspace root
    if str(workspace) not in sys.path:
        sys.path.insert(0, str(workspace))

    # Insert pythonpath entries from genesis.yml (resolved relative to workspace)
    _config = _load_project_config(workspace)
    for _extra in reversed(_config.get("pythonpath", [])):
        _extra_path = str((workspace / _extra).resolve())
        if _extra_path not in sys.path:
            sys.path.insert(0, _extra_path)

    from .install import workspace_bootstrap
    from .provenance import WorkflowVersionError
    from .services import Scope, gen_gaps, gen_iterate, gen_start

    try:
        stream = workspace_bootstrap(workspace)
    except WorkflowVersionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    module = _resolve_module(args, workspace)
    configured_worker = _resolve_configured_worker(_config, workspace)

    try:
        scope = Scope(
            module=module,
            workspace_root=workspace,
            work_key_filter=getattr(args, "feature", None),
            edge_filter=getattr(args, "edge", None),
            runtime_identity=_resolve_runtime_identity(_config, configured_worker),
            worker=configured_worker,
            active_workflow_path=_config.get("active_workflow"),
            workflow_root=_config.get("workflow_root"),
            runtime_config=_config,
        )
    except WorkflowVersionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    # Bind active snapshot so work events carry package_snapshot_id.
    from .events import init_snapshot
    snapshot_id = f"snap-{module.name}-{scope.workflow_version}"
    init_snapshot(snapshot_id)

    if args.command == "start":
        human_proxy = getattr(args, "human_proxy", False)
        if getattr(args, "auto", False):
            if getattr(args, "supervised_root", False):
                result = _run_start_auto_supervised(
                    scope,
                    stream,
                    workspace=workspace,
                    config=_config,
                    human_proxy=human_proxy,
                )
            else:
                result = _run_start_auto(
                    scope,
                    stream,
                    workspace=workspace,
                    config=_config,
                    human_proxy=human_proxy,
                )
        else:
            result = gen_start(scope, stream, auto=False)
            if human_proxy:
                result["human_proxy"] = True
    elif args.command == "iterate":
        result = gen_iterate(scope, stream)
    elif args.command == "gaps":
        result = gen_gaps(scope, stream)
    else:
        parser.print_help()
        sys.exit(1)

    result = _attach_pending_recovery_contract(result, workspace)
    print(json.dumps(result, indent=2))

    # Exit codes for skill routing:
    #   0 — converged / nothing_to_do  (loop complete)
    #   1 — error (already exited above)
    #   2 — fp_dispatched (F_P actor required; fp_manifest_path in output)
    #   3 — fh_gate_pending (F_H evaluation required; fh_gate.criteria in output)
    #   4 — fd_gap (declared deterministic hard stop before constructive transition)
    #   5 — max_iterations (auto-loop limit hit without convergence)
    #   6 — yield (constructive turn advanced the asset and yielded handoff truth)
    #   7 — proof_hold (product-layer proof hold stopped redispatch)
    #
    # IMPORTANT: exit 0 means ONLY converged/nothing_to_do — never a blocked run.
    stopped_by = result.get("stopped_by", "")
    if stopped_by == "fp_dispatch":
        sys.exit(2)
    if stopped_by == "fh_gate":
        sys.exit(3)
    if stopped_by == "fd_gap":
        sys.exit(4)
    if stopped_by == "max_iterations":
        sys.exit(5)
    if stopped_by == "yield":
        sys.exit(6)
    if stopped_by == "proof_hold":
        sys.exit(7)
    if result.get("status") == "error":
        sys.exit(1)

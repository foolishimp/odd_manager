"""Explicit analysis publication and workspace readiness for odd_sdlc."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .install_topology import INSTALLED_RUNTIME_CONTRACT_RELATIVE
from .ambiguity import AMBIGUITY_REGISTER_PATH, build_ambiguity_register
from .project_profile import (
    ANALYSIS_MANIFEST_PATH,
    PROJECT_CONSTRAINTS_PATH,
    WORKSPACE_STATE_PATH,
    current_workspace_inputs,
    current_workspace_input_fingerprint,
    is_source_domain_repo_workspace,
    load_published_analysis_manifest,
    published_analysis_is_current,
    resolve_project_profile,
)
from .runtime_contexts import publish_runtime_contexts
from .traceability import (
    REQUIREMENT_CLOSURE_PROMPT_CONTEXT_PATH,
    REQUIREMENT_CLOSURE_REGISTER_PATH,
    build_requirement_closure_prompt_context,
    build_requirement_closure_register,
)


def _workspace_mode(workspace_root: Path) -> str:
    if (workspace_root / INSTALLED_RUNTIME_CONTRACT_RELATIVE).exists():
        return "installed_target"
    if is_source_domain_repo_workspace(workspace_root):
        return "source_domain_repo"
    if (workspace_root / PROJECT_CONSTRAINTS_PATH).exists():
        return "governed_workspace"
    return "unclassified_workspace"


def _write_json_if_changed(
    path: Path,
    payload: dict[str, Any],
    *,
    create_kind: str,
    update_kind: str,
    detail: str,
) -> list[dict[str, str]]:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, indent=2, sort_keys=True)
    existing = path.read_text(encoding="utf-8") if path.exists() else None
    if existing == content:
        return []
    path.write_text(content, encoding="utf-8")
    return [
        {
            "kind": update_kind if existing is not None else create_kind,
            "path": path.as_posix(),
            "detail": detail,
        }
    ]


def _write_text_if_changed(
    path: Path,
    content: str,
    *,
    create_kind: str,
    update_kind: str,
    detail: str,
) -> list[dict[str, str]]:
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_text(encoding="utf-8") if path.exists() else None
    if existing == content:
        return []
    path.write_text(content, encoding="utf-8")
    return [
        {
            "kind": update_kind if existing is not None else create_kind,
            "path": path.as_posix(),
            "detail": detail,
        }
    ]


def load_workspace_state(workspace_root: Path | str) -> dict[str, Any] | None:
    root = Path(workspace_root).resolve()
    path = root / WORKSPACE_STATE_PATH
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_analysis_manifest(workspace_root: Path | str) -> dict[str, Any] | None:
    payload = load_published_analysis_manifest(workspace_root)
    if not isinstance(payload, dict):
        return None
    return payload


def workspace_state_ready(workspace_root: Path | str) -> tuple[bool, dict[str, Any] | None]:
    root = Path(workspace_root).resolve()
    payload = load_workspace_state(root)
    if payload is None:
        return False, None
    return bool(payload.get("ready")) and published_analysis_is_current(root), payload


def _artifact_kind_for_path(path: Path) -> str:
    name = path.name
    if name == AMBIGUITY_REGISTER_PATH.name:
        return "ambiguity_register"
    if name == REQUIREMENT_CLOSURE_REGISTER_PATH.name:
        return "requirement_closure_register"
    if name == REQUIREMENT_CLOSURE_PROMPT_CONTEXT_PATH.name:
        return "requirement_closure_prompt_context"
    return "analysis_artifact"


def _input_kind_for_path(relative_path: str) -> str:
    if relative_path == PROJECT_CONSTRAINTS_PATH.as_posix():
        return "project_constraints"
    if relative_path == INSTALLED_RUNTIME_CONTRACT_RELATIVE.as_posix():
        return "runtime_contract"
    if relative_path.startswith("specification/requirements/"):
        return "requirement_surface"
    if relative_path.startswith("specification/scenarios/"):
        return "scenario_surface"
    if relative_path in {
        "specification/INTENT.md",
        "specification/PRODUCT.md",
        "specification/GOALS.md",
    }:
        return "constitutional_surface"
    if relative_path.startswith("build_tenants/"):
        return "realization_surface"
    return "declared_input"


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def build_analysis_manifest(
    workspace_root: Path | str,
    *,
    stage: str,
) -> dict[str, Any]:
    root = Path(workspace_root).resolve()
    profile = resolve_project_profile(root)
    published_paths = (
        root / AMBIGUITY_REGISTER_PATH,
        root / REQUIREMENT_CLOSURE_REGISTER_PATH,
        root / REQUIREMENT_CLOSURE_PROMPT_CONTEXT_PATH,
    )
    published_artifacts: list[dict[str, Any]] = []
    for artifact_path in published_paths:
        if not artifact_path.exists():
            continue
        published_artifacts.append(
            {
                "artifact_kind": _artifact_kind_for_path(artifact_path),
                "path": artifact_path.relative_to(root).as_posix(),
                "fingerprint": _sha256_bytes(artifact_path.read_bytes()),
                "last_written": artifact_path.stat().st_mtime_ns,
            }
        )
    source_inputs = [
        {
            "input_kind": _input_kind_for_path(str(entry["path"])),
            "path": str(entry["path"]),
            "fingerprint": str(entry.get("sha256") or ""),
            "exists": bool(entry.get("exists")),
        }
        for entry in current_workspace_inputs(root)
    ]
    return {
        "manifest_kind": "odd_sdlc.analysis_manifest",
        "schema_version": "v1",
        "workspace_root": str(root),
        "workspace_name": root.name,
        "workspace_mode": _workspace_mode(root),
        "stage": stage,
        "selected_root": profile.output_dir,
        "declared_root": profile.declared_output_dir,
        "analysis_fingerprint": current_workspace_input_fingerprint(root),
        "published_artifacts": published_artifacts,
        "source_inputs": source_inputs,
        "workspace_state_path": WORKSPACE_STATE_PATH.as_posix(),
    }


def write_analysis_manifest(
    workspace_root: Path | str,
    *,
    stage: str,
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    root = Path(workspace_root).resolve()
    payload = build_analysis_manifest(root, stage=stage)
    actions = _write_json_if_changed(
        root / ANALYSIS_MANIFEST_PATH,
        payload,
        create_kind="create_analysis_manifest",
        update_kind="update_analysis_manifest",
        detail="published odd_sdlc analysis manifest for explicit analysis identity and artifact attribution",
    )
    return payload, actions


def write_workspace_state(
    workspace_root: Path | str,
    *,
    stage: str,
    ready: bool,
    analysis_manifest_path: str,
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    root = Path(workspace_root).resolve()
    profile = resolve_project_profile(root)
    analysis_fingerprint = current_workspace_input_fingerprint(root)
    payload = {
        "workspace_state_kind": "odd_sdlc.workspace_state",
        "schema_version": "v1",
        "workspace_root": str(root),
        "workspace_name": root.name,
        "workspace_mode": _workspace_mode(root),
        "stage": stage,
        "ready": ready,
        "analysis_fingerprint": analysis_fingerprint,
        "analysis_manifest_path": analysis_manifest_path,
        "project_profile": profile.to_dict(),
        "selected_output_dir": profile.output_dir,
        "declared_output_dir": profile.declared_output_dir,
        "resolution_reason": profile.resolution_reason,
    }
    actions = _write_json_if_changed(
        root / WORKSPACE_STATE_PATH,
        payload,
        create_kind="create_workspace_state",
        update_kind="update_workspace_state",
        detail="published odd_sdlc workspace state for explicit runtime readiness and root selection",
    )
    return payload, actions


def refresh_analysis(workspace_root: Path | str, *, stage: str = "refresh_analysis") -> dict[str, Any]:
    root = Path(workspace_root).resolve()
    actions: list[dict[str, str]] = []
    actions.extend(publish_runtime_contexts(root))
    ambiguity_payload = build_ambiguity_register(root, stage=stage)
    actions.extend(
        _write_json_if_changed(
            root / AMBIGUITY_REGISTER_PATH,
            ambiguity_payload,
            create_kind="create_ambiguity_register",
            update_kind="update_ambiguity_register",
            detail="published ambiguity register from deterministic normalization and topology inspection",
        )
    )
    requirement_payload = build_requirement_closure_register(root, stage=stage)
    actions.extend(
        _write_json_if_changed(
            root / REQUIREMENT_CLOSURE_REGISTER_PATH,
            requirement_payload,
            create_kind="create_requirement_closure_register",
            update_kind="update_requirement_closure_register",
            detail="published requirement closure register from deterministic traceability inspection",
        )
    )
    requirement_context = build_requirement_closure_prompt_context(root, register=requirement_payload)
    actions.extend(
        _write_text_if_changed(
            root / REQUIREMENT_CLOSURE_PROMPT_CONTEXT_PATH,
            requirement_context,
            create_kind="create_requirement_closure_prompt_context",
            update_kind="update_requirement_closure_prompt_context",
            detail="published compact requirement closure builder context for odd_sdlc execution",
        )
    )
    analysis_manifest, analysis_manifest_actions = write_analysis_manifest(root, stage=stage)
    actions.extend(analysis_manifest_actions)
    workspace_state, workspace_state_actions = write_workspace_state(
        root,
        stage=stage,
        ready=True,
        analysis_manifest_path=ANALYSIS_MANIFEST_PATH.as_posix(),
    )
    actions.extend(workspace_state_actions)
    return {
        "workspace_root": str(root),
        "stage": stage,
        "ready": True,
        "workspace_state_path": WORKSPACE_STATE_PATH.as_posix(),
        "analysis_manifest_path": ANALYSIS_MANIFEST_PATH.as_posix(),
        "analysis_manifest": analysis_manifest,
        "workspace_state": workspace_state,
        "actions": actions,
    }


def ensure_workspace_ready(workspace_root: Path | str) -> dict[str, Any]:
    root = Path(workspace_root).resolve()
    ready, payload = workspace_state_ready(root)
    if ready and payload is not None:
        return payload
    if payload is None:
        raise RuntimeError(
            "odd_sdlc workspace analysis has not been published; run `python -m odd_sdlc refresh-analysis --workspace .` "
            "or `python -m odd_sdlc normalize-workspace --workspace .` before `start`."
        )
    raise RuntimeError(
        "odd_sdlc workspace analysis is stale; rerun "
        "`python -m odd_sdlc refresh-analysis --workspace .` before `start`."
    )

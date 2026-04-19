# Implements: REQ-F-ODDSDLC-003
# Implements: REQ-F-ODDSDLC-007
# Implements: REQ-F-ODDSDLC-022
# Implements: REQ-F-ODDSDLC-027
# Implements: REQ-F-ODDSDLC-029
# Implements: REQ-F-ODDSDLC-032
"""Deterministic workspace normalization for odd_sdlc operation."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any

from .analysis import refresh_analysis
from .install_topology import INSTALLED_PRODUCT_ROOT_RELATIVE
from .project_profile import (
    _parse_constraints_lines,
    canonical_tenant_name,
    load_project_profile,
    parse_design_tenants,
    tenant_output_dir,
)

NORMALIZATION_REPORT_PATH = Path(".ai-workspace/runtime/odd_sdlc-workspace-normalization.json")
IMPORTED_REQUIREMENTS_PATH = Path("specification/requirements/00-imported-sources.md")
PROJECT_BOOTSTRAP_PATH = Path(".ai-workspace/context/project_bootstrap.md")
PROJECT_POLICY_FIELDS: tuple[tuple[str, str], ...] = (
    ("ambiguity_risk_appetite", '"medium"'),
)
TENANT_CAPABILITY_FIELDS: tuple[tuple[str, str], ...] = (
    ("build_execution_contract", '""'),
    ("test_execution_contract", '""'),
    ("deployment_contract", '""'),
    ("runtime_observation_contract", '""'),
)
TENANT_REGISTRY_PATH = Path("build_tenants/TENANT_REGISTRY.md")


def default_project_slug(workspace_root: Path) -> str:
    name = workspace_root.resolve().name.strip()
    if not name:
        return "project"
    return name.split(".", 1)[0].replace("-", "_")


def _normalization_action(*, kind: str, path: Path, detail: str) -> dict[str, str]:
    return {
        "kind": kind,
        "path": path.as_posix(),
        "detail": detail,
    }


def _default_with_provenance(
    *,
    kind: str,
    path: Path,
    detail: str,
    field: str | None = None,
    value: str | None = None,
) -> dict[str, str]:
    payload = {
        "kind": kind,
        "path": path.as_posix(),
        "detail": detail,
    }
    if field is not None:
        payload["field"] = field
    if value is not None:
        payload["value"] = value
    return payload


def _write_text(path: Path, content: str, *, kind: str, detail: str, actions: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    actions.append(_normalization_action(kind=kind, path=path, detail=detail))


def _imported_requirement_sources(workspace_root: Path) -> list[Path]:
    spec_root = workspace_root / "specification"
    candidates = (
        spec_root / "REQUIREMENTS.md",
        spec_root / "mapper_requirements.md",
    )
    return [path for path in candidates if path.exists()]


def _imported_sources_markdown(workspace_root: Path) -> str:
    imported = _imported_requirement_sources(workspace_root)
    bullets = (
        [f"- `{path.relative_to(workspace_root).as_posix()}`" for path in imported]
        or ["- no imported requirement-like source was detected"]
    )
    return "\n".join(
        (
            "# Imported Requirement Sources",
            "",
            "This surface was created by `odd_sdlc` deterministic workspace normalization.",
            "",
            "## Imported Sources",
            *bullets,
            "",
            "## Purpose",
            "- establish the canonical `specification/requirements/` root required by odd_sdlc bootstrap",
            "- preserve imported requirement-like authority without rewriting the original sources",
            "",
        )
    )


def _markdown_headings(path: Path) -> list[str]:
    headings: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            headings.append(stripped)
    return headings


def _first_heading(path: Path) -> str | None:
    for heading in _markdown_headings(path):
        return heading.lstrip("#").strip()
    return None


def _project_title_from_intent(path: Path) -> str | None:
    pattern = re.compile(r"^\*\*Project\*\*:\s*(.+?)\s*$")
    for line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line.strip())
        if match:
            title = match.group(1).strip()
            if title:
                return title
    return None


def _project_identity(workspace_root: Path) -> tuple[str | None, str | None]:
    intent_path = workspace_root / "specification" / "INTENT.md"
    if intent_path.exists():
        title = _project_title_from_intent(intent_path)
        if title:
            return title, intent_path.relative_to(workspace_root).as_posix()
    for source in _imported_requirement_sources(workspace_root):
        title = _first_heading(source)
        if title:
            return title, source.relative_to(workspace_root).as_posix()
    return None, None


def _intent_ids_from_surface(workspace_root: Path) -> tuple[str, ...]:
    intent_path = workspace_root / "specification" / "INTENT.md"
    if not intent_path.exists():
        return ()
    return tuple(sorted(set(re.findall(r"\bINT-\d{3}\b", intent_path.read_text(encoding="utf-8")))))


def _goals_surface_with_intent_carry_forward(existing_text: str, *, intent_ids: tuple[str, ...]) -> str:
    if not intent_ids:
        return existing_text
    if all(intent_id in existing_text for intent_id in intent_ids):
        return existing_text

    lines = existing_text.rstrip().splitlines()
    if lines and lines[-1] != "":
        lines.append("")
    lines.extend(
        (
            "## Intent Authority Carry-Forward",
            *[f"- {intent_id}: carried forward from imported intent authority" for intent_id in intent_ids],
            "",
        )
    )
    return "\n".join(lines)


def _ontology_anchor_headings(path: Path) -> list[str]:
    keywords = (
        "ontology",
        "axiom",
        "executive summary",
        "intent",
        "object",
        "morphism",
        "terminology",
        "architecture",
        "domain",
        "philosophy",
    )
    anchors: list[str] = []
    for heading in _markdown_headings(path):
        normalized = heading.lower()
        if any(keyword in normalized for keyword in keywords):
            anchors.append(heading.lstrip("#").strip())
    return anchors


def _project_bootstrap_markdown(workspace_root: Path, *, project_slug: str, platform: str) -> str:
    imported = _imported_requirement_sources(workspace_root)
    intent_path = workspace_root / "specification" / "INTENT.md"
    identity_title, identity_source = _project_identity(workspace_root)
    candidate_titles = []
    if intent_path.exists():
        title = _project_title_from_intent(intent_path) or _first_heading(intent_path)
        if title:
            candidate_titles.append((intent_path.relative_to(workspace_root).as_posix(), title))
    for source in imported:
        title = _first_heading(source)
        if title:
            candidate_titles.append((source.relative_to(workspace_root).as_posix(), title))

    title_lines = (
        [f"- `{source}`: {title}" for source, title in candidate_titles]
        or ["- no source title detected"]
    )

    ontology_lines: list[str] = []
    seen_anchors: set[tuple[str, str]] = set()
    candidate_sources = tuple(path for path in (intent_path, *imported) if path.exists())
    for source in candidate_sources:
        rel = source.relative_to(workspace_root).as_posix()
        for anchor in _ontology_anchor_headings(source):
            key = (rel, anchor)
            if key in seen_anchors:
                continue
            seen_anchors.add(key)
            ontology_lines.append(f"- `{rel}` → {anchor}")

    if not ontology_lines:
        ontology_lines.append("- no explicit ontology anchors detected in imported authority")

    return "\n".join(
        (
            "# Project Bootstrap",
            "",
            "This generated surface is a deterministic read model over imported project authority.",
            "It is not a replacement for project-owned specification truth.",
            "",
            "## Workspace Identity",
            f"- workspace: `{workspace_root.name}`",
            f"- project slug: `{project_slug}`",
            f"- platform: `{platform}`",
            "",
            "## Project Identity",
            (
                f"- authoritative project title: `{identity_title}`"
                if identity_title
                else "- authoritative project title: not confidently determined from imported authority"
            ),
            (
                f"- identity source: `{identity_source}`"
                if identity_source
                else "- identity source: no explicit imported identity surface detected"
            ),
            "- workspace/template/bootstrap provenance does not change project identity",
            "",
            "## Source Titles",
            *title_lines,
            "",
            "## Ontology Anchors",
            *ontology_lines,
            "",
            "## Read Order",
            "- `specification/INTENT.md` when present",
            "- `specification/requirements/00-imported-sources.md`",
            "- imported requirement-like sources listed there",
            "- `.ai-workspace/runtime/odd_sdlc-ambiguity-register.json` for current major ambiguity state",
            "- `.ai-workspace/runtime/odd_sdlc-requirement-closure.json` for live requirement carry-forward and code/test closure state",
            "- `specification/PRODUCT.md` and `specification/GOALS.md` only after the imported authority",
            "",
            "## Installed Runtime Start Surface",
            "- inspect current gaps with `PYTHONPATH=.genesis python -m genesis gaps --workspace .`",
            "- trigger bounded odd_sdlc traversal with `PYTHONPATH=.genesis python -m genesis start --auto --workspace .`",
            "- add `--human-proxy` only when you expect an explicit F_H approval lane; it does not proxy F_P transport failures",
            "- deployment, runtime-return, and similar side-effect stages only traverse when the active build tenant declares the required technology capability contracts in `project_constraints.yml`",
            "- major ambiguity is always recorded; `project_constraints.yml` declares `ambiguity_risk_appetite`, which governs whether unresolved major ambiguity is carried by `F_P` or escalated to `F_H` unless it is a hard-stop prerequisite",
            "- when release/deployment/runtime remain at `pending_evidence` with no returned execution data, treat the converged boundary as `construction_complete_pending_execution`",
            "- treat legacy bootstrap instructions or older scaffold references in imported project docs as provenance only, not active runtime guidance for this installed workspace",
            "",
            "## Interpretation Rule",
            "- use this surface to orient quickly",
            "- use imported project sources as authority",
            "- treat copied template/bootstrap history as provenance rather than live workspace guidance",
            "- if ontology remains incomplete, say so explicitly rather than inferring it from repository context",
            "",
        )
    )


def _remove_legacy_root_readme(workspace_root: Path, *, actions: list[dict[str, str]]) -> None:
    readme_path = workspace_root / "README.md"
    if not readme_path.exists() or not readme_path.is_file():
        return
    readme_path.unlink()
    actions.append(
        _normalization_action(
            kind="remove_legacy_root_readme",
            path=readme_path,
            detail="removed copied root README so installed workspace guidance comes from bootloader and runtime surfaces only",
        )
    )


def _validate_existing_project_constraints(path: Path) -> None:
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise ValueError("project_constraints.yml exists but is empty; normalization will not silently replace it")

    missing_sections = [
        section
        for section in ("project:", "structure:", "design_tenants:")
        if section not in text
    ]
    if missing_sections:
        raise ValueError(
            "project_constraints.yml is malformed; missing required sections: "
            + ", ".join(missing_sections)
        )

    tenants = parse_design_tenants(path)
    if not tenants:
        raise ValueError(
            "project_constraints.yml is malformed; at least one design tenant must be declared"
        )


def _default_product_surface(workspace_root: Path) -> str:
    imported = _imported_requirement_sources(workspace_root)
    bullets = (
        [f"- imported source present: `{path.relative_to(workspace_root).as_posix()}`" for path in imported]
        or ["- imported source present: none detected"]
    )
    return "\n".join(
        (
            "# Product",
            "",
            "This product surface was normalized by odd_sdlc to make an imported workspace operable.",
            "",
            "## Current Product Position",
            "- this workspace was imported without the canonical odd_sdlc bootstrap surfaces fully present",
            "- odd_sdlc requires explicit product and goal surfaces for lawful operation",
            "- this normalized surface preserves the imported project while giving odd_sdlc a canonical product anchor",
            "",
            "## Imported Sources",
            *bullets,
            "",
        )
    )


def _default_goals_surface(workspace_root: Path) -> str:
    imported = _imported_requirement_sources(workspace_root)
    bullets = (
        [f"- imported source present: `{path.relative_to(workspace_root).as_posix()}`" for path in imported]
        or ["- imported source present: none detected"]
    )
    intent_ids = _intent_ids_from_surface(workspace_root)
    intent_bullets = (
        [f"- {intent_id}: carried forward from imported intent authority" for intent_id in intent_ids]
        or ["- no imported INT-* authority markers detected"]
    )
    return "\n".join(
        (
            "# Goals",
            "",
            "These goals were normalized by odd_sdlc to standardize an imported workspace for operation.",
            "",
            "## Current Wave",
            "- establish the canonical odd_sdlc bootstrap surfaces without discarding imported project authority",
            "- make the workspace installable, iterable, and auditable through the odd_sdlc executive",
            "- preserve imported requirement-like sources as carried context for later refinement",
            "",
            "## Intent Authority Carry-Forward",
            *intent_bullets,
            "",
            "## Imported Sources",
            *bullets,
            "",
        )
    )


def _normalize_project_constraints(
    workspace_root: Path,
    *,
    project_slug: str,
    platform: str,
    actions: list[dict[str, str]],
    defaults_with_provenance: list[dict[str, str]],
) -> None:
    path = workspace_root / ".ai-workspace" / "context" / "project_constraints.yml"
    canonical_platform = canonical_tenant_name(platform)
    canonical_output = tenant_output_dir(canonical_platform)
    if not path.exists():
        content = "\n".join(
            (
                f"# Project Constraints — {workspace_root.name}",
                "# Generated by odd_sdlc deterministic workspace normalization",
                "",
                "project:",
                f'  name: "{workspace_root.name}"',
                '  kind: "software-project"',
                '  language: ""',
                '  test_runner: ""',
                '  ambiguity_risk_appetite: "medium"',
                "",
                "constraints: {}",
                "",
                "structure:",
                "  design_tenants:",
                f'    - name: "{canonical_platform}"',
                f'      output_dir: "{canonical_output}"',
                '      description: "Normalized project realization tenant for odd_sdlc operation"',
                '      build_execution_contract: ""',
                '      test_execution_contract: ""',
                '      deployment_contract: ""',
                '      runtime_observation_contract: ""',
                "  root_code_policy: reject",
                "",
            )
        )
        _write_text(
            path,
            content,
            kind="create_project_constraints",
            detail="created canonical project constraints surface for odd_sdlc operation",
            actions=actions,
        )
        defaults_with_provenance.append(
            _default_with_provenance(
                kind="create_project_constraints",
                path=path,
                detail="created default project_constraints.yml because the imported workspace did not provide one",
            )
        )
        return

    _validate_existing_project_constraints(path)
    original = path.read_text(encoding="utf-8")
    lines = original.splitlines()
    updated: list[str] = []
    in_project = False
    in_structure = False
    in_design_tenants = False
    design_tenant_seen = False
    project_policy_seen: set[str] = set()
    first_design_tenant_scope = False
    tenant_field_indent = "      "
    tenant_fields_seen: set[str] = set()
    tenant_capabilities_flushed = False
    tenant_output_written = False

    def _flush_missing_tenant_capabilities() -> None:
        nonlocal tenant_capabilities_flushed, tenant_output_written
        if design_tenant_seen and not tenant_output_written:
            updated.append(f'{tenant_field_indent}output_dir: "{canonical_output}"')
            tenant_output_written = True
            defaults_with_provenance.append(
                _default_with_provenance(
                    kind="default_project_constraint_field",
                    path=path,
                    field="tenant_output_dir",
                    value=canonical_output,
                    detail="defaulted the active tenant output_dir to the canonical tenant-rooted path",
                )
            )
        if tenant_capabilities_flushed or not design_tenant_seen:
            return
        for field_name, default_value in TENANT_CAPABILITY_FIELDS:
            if field_name in tenant_fields_seen:
                continue
            updated.append(f"{tenant_field_indent}{field_name}: {default_value}")
            defaults_with_provenance.append(
                _default_with_provenance(
                    kind="default_project_constraint_field",
                    path=path,
                    field=field_name,
                    value=default_value,
                    detail=f"defaulted missing tenant capability field `{field_name}` during normalization",
                )
            )
        tenant_capabilities_flushed = True

    for index, line in enumerate(lines):
        stripped = line.strip()
        next_line = lines[index + 1] if index + 1 < len(lines) else ""
        next_stripped = next_line.strip()
        next_indent = len(next_line) - len(next_line.lstrip()) if next_line else 0
        if line.startswith("# Project Constraints"):
            updated.append(f"# Project Constraints — {workspace_root.name}")
            continue
        if stripped == "project:":
            if first_design_tenant_scope:
                _flush_missing_tenant_capabilities()
                first_design_tenant_scope = False
            in_project = True
            in_structure = False
            in_design_tenants = False
            updated.append(line)
            continue
        if stripped == "structure:":
            if first_design_tenant_scope:
                _flush_missing_tenant_capabilities()
                first_design_tenant_scope = False
            if in_project:
                for field_name, default_value in PROJECT_POLICY_FIELDS:
                    if field_name in project_policy_seen:
                        continue
                    updated.append(f"  {field_name}: {default_value}")
                    defaults_with_provenance.append(
                        _default_with_provenance(
                            kind="default_project_constraint_field",
                            path=path,
                            field=field_name,
                            value=default_value,
                            detail=f"defaulted missing project policy field `{field_name}` during normalization",
                        )
                    )
            in_project = False
            in_structure = True
            in_design_tenants = False
            updated.append(line)
            continue
        if stripped == "design_tenants:" and in_structure:
            in_design_tenants = True
            updated.append(line)
            continue
        if in_project and stripped.startswith("name:"):
            indent = line[: len(line) - len(line.lstrip())]
            updated.append(f'{indent}name: "{workspace_root.name}"')
            continue
        if in_project and ":" in stripped:
            field_name = stripped.partition(":")[0].strip()
            project_policy_seen.add(field_name)
        if in_design_tenants and stripped.startswith("- name:"):
            if first_design_tenant_scope:
                _flush_missing_tenant_capabilities()
                first_design_tenant_scope = False
            if not design_tenant_seen:
                design_tenant_seen = True
                first_design_tenant_scope = True
                tenant_fields_seen = set()
                tenant_capabilities_flushed = False
                tenant_output_written = False
                indent = line[: len(line) - len(line.lstrip())]
                updated.append(f'{indent}- name: "{canonical_platform}"')
            else:
                updated.append(line)
            continue
        if first_design_tenant_scope and ":" in stripped and not stripped.startswith("- name:"):
            field_name = stripped.partition(":")[0].strip()
            tenant_fields_seen.add(field_name)
            tenant_field_indent = line[: len(line) - len(line.lstrip())]
        if first_design_tenant_scope and stripped.startswith("output_dir:") and design_tenant_seen:
            updated.append(f'{tenant_field_indent}output_dir: "{canonical_output}"')
            tenant_output_written = True
        else:
            updated.append(line)

        if first_design_tenant_scope and (
            not next_line
            or next_stripped.startswith("- name:")
            or (next_stripped and next_indent <= 4)
        ):
            _flush_missing_tenant_capabilities()
            first_design_tenant_scope = False

    normalized = "\n".join(updated) + ("\n" if original.endswith("\n") else "")
    if normalized != original:
        _write_text(
            path,
            normalized,
            kind="normalize_project_constraints",
            detail="updated workspace identity and canonicalized the active project tenant root for spec-method operation",
            actions=actions,
        )


def _migrate_legacy_realization_root(
    workspace_root: Path,
    *,
    legacy_output_dir: str,
    canonical_output_dir: str,
    actions: list[dict[str, str]],
) -> None:
    if not legacy_output_dir:
        return
    legacy_root = workspace_root / legacy_output_dir
    canonical_root = workspace_root / canonical_output_dir
    if legacy_root == canonical_root or not legacy_root.exists():
        return

    def _merge_tree(source: Path, destination: Path) -> None:
        destination.mkdir(parents=True, exist_ok=True)
        for child in source.iterdir():
            target = destination / child.name
            if child.is_dir():
                if target.exists() and not target.is_dir():
                    raise FileExistsError(f"cannot merge directory `{child}` into file `{target}`")
                _merge_tree(child, target)
                child.rmdir()
                continue
            if target.exists():
                raise FileExistsError(f"cannot overwrite existing canonical file `{target}` during legacy-root migration")
            shutil.move(str(child), str(target))

    if canonical_root.exists():
        _merge_tree(legacy_root, canonical_root)
        legacy_root.rmdir()
    else:
        canonical_root.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(legacy_root), str(canonical_root))
    actions.append(
        _normalization_action(
            kind="migrate_realization_root",
            path=canonical_root,
            detail=(
                "migrated the declared legacy realization root into the canonical "
                f"tenant-rooted path `{canonical_output_dir}`"
            ),
        )
    )


def _is_legacy_common_scaffold(path: Path) -> bool:
    expected = {
        "README.md",
        "design/README.md",
    }
    actual = {
        item.relative_to(path).as_posix()
        for item in path.rglob("*")
        if item.is_file()
    }
    return actual == expected


def _is_legacy_project_tenant_scaffold(path: Path) -> bool:
    expected = {
        "README.md",
        "code/README.md",
        "code/__init__.py",
        "code/app_bootstrap.py",
        "design/README.md",
        "design/fp/README.md",
        "design/fp/INTENT.md",
        "design/fp/edge-overrides/README.md",
        "design/fp/edge-overrides/EDGE_OVERRIDE_TEMPLATE.json",
    }
    actual = {
        item.relative_to(path).as_posix()
        for item in path.rglob("*")
        if item.is_file()
    }
    return actual == expected


def _remove_legacy_installer_scaffolds(
    workspace_root: Path,
    *,
    project_slug: str,
    platform: str,
    active_tenant_name: str,
    actions: list[dict[str, str]],
) -> None:
    common_root = workspace_root / "build_tenants" / "common"
    if common_root.exists() and _is_legacy_common_scaffold(common_root):
        shutil.rmtree(common_root)
        actions.append(
            _normalization_action(
                kind="remove_legacy_common_scaffold",
                path=common_root,
                detail="removed the legacy shared scaffold root because downstream project tenants must not default to build_tenants/common/",
            )
        )

    legacy_project_root = workspace_root / "build_tenants" / project_slug / platform
    canonical_root = workspace_root / tenant_output_dir(active_tenant_name)
    if legacy_project_root.exists() and legacy_project_root != canonical_root and _is_legacy_project_tenant_scaffold(legacy_project_root):
        shutil.rmtree(legacy_project_root)
        parent = legacy_project_root.parent
        if parent.exists() and not any(parent.iterdir()):
            parent.rmdir()
        actions.append(
            _normalization_action(
                kind="remove_legacy_project_tenant_scaffold",
                path=legacy_project_root,
                detail=(
                    "removed the legacy project-scoped tenant scaffold because "
                    "downstream realization is canonical under "
                    f"`{tenant_output_dir(active_tenant_name)}`"
                ),
            )
        )


def _tenant_registry_markdown(*, tenant_names: tuple[str, ...]) -> str:
    if not tenant_names:
        tenant_names = ("python",)
    rows = [
        f"| `{tenant_name}` | realization | `{tenant_output_dir(tenant_name)}` | Active | Canonical project realization tenant |"
        for tenant_name in tenant_names
    ]
    return "\n".join(
        (
            "# Tenant Registry",
            "",
            "This registry records the active project-owned realization tenants.",
            "",
            "| Tenant | Kind | Root | Status | Notes |",
            "| --- | --- | --- | --- | --- |",
            *rows,
            "",
        )
    )


def _normalize_tenant_registry(workspace_root: Path, *, tenant_name: str, actions: list[dict[str, str]]) -> None:
    registry_path = workspace_root / TENANT_REGISTRY_PATH
    declared_tenants = parse_design_tenants(workspace_root / ".ai-workspace" / "context" / "project_constraints.yml")
    tenant_names = tuple(
        dict.fromkeys(
            [tenant_name, *[str(entry.get("name") or "").strip() for entry in declared_tenants if str(entry.get("name") or "").strip()]]
        )
    )
    content = _tenant_registry_markdown(tenant_names=tenant_names)
    if not registry_path.exists():
        _write_text(
            registry_path,
            content,
            kind="create_tenant_registry",
            detail="created canonical tenant registry for the active project realization tenants",
            actions=actions,
        )
        return
    original = registry_path.read_text(encoding="utf-8")
    if original != content:
        _write_text(
            registry_path,
            content,
            kind="update_tenant_registry",
            detail="rewrote tenant registry to the canonical multi-tenant project realization topology",
            actions=actions,
        )


def _resolved_platform(workspace_root: Path, requested_platform: str | None) -> str:
    if requested_platform and requested_platform.strip():
        return canonical_tenant_name(requested_platform)
    constraints_path = workspace_root / ".ai-workspace" / "context" / "project_constraints.yml"
    if constraints_path.exists():
        tenants = parse_design_tenants(constraints_path)
        if tenants:
            return canonical_tenant_name(tenants[0].get("name", ""))
        constraints = _parse_constraints_lines(constraints_path)
        if constraints.get("tenant_name"):
            return canonical_tenant_name(constraints["tenant_name"])
    return "python"


def normalize_workspace(
    workspace_root: Path | str,
    *,
    project_slug: str | None = None,
    platform: str | None = None,
) -> dict[str, Any]:
    root = Path(workspace_root).resolve()
    slug = (project_slug or default_project_slug(root)).strip() or "project"
    resolved_platform = _resolved_platform(root, platform)
    actions: list[dict[str, str]] = []
    defaults_with_provenance: list[dict[str, str]] = []

    (root / ".ai-workspace" / "runtime").mkdir(parents=True, exist_ok=True)
    (root / ".ai-workspace" / "context").mkdir(parents=True, exist_ok=True)

    product_path = root / "specification" / "PRODUCT.md"
    if not product_path.exists():
        _write_text(
            product_path,
            _default_product_surface(root),
            kind="create_product_surface",
            detail="created PRODUCT.md from imported workspace context",
            actions=actions,
        )
        defaults_with_provenance.append(
            _default_with_provenance(
                kind="create_product_surface",
                path=product_path,
                detail="created default PRODUCT.md because the imported workspace did not provide one",
            )
        )

    goals_path = root / "specification" / "GOALS.md"
    if not goals_path.exists():
        _write_text(
            goals_path,
            _default_goals_surface(root),
            kind="create_goals_surface",
            detail="created GOALS.md from imported workspace context",
            actions=actions,
        )
        defaults_with_provenance.append(
            _default_with_provenance(
                kind="create_goals_surface",
                path=goals_path,
                detail="created default GOALS.md because the imported workspace did not provide one",
            )
        )
    else:
        updated_goals = _goals_surface_with_intent_carry_forward(
            goals_path.read_text(encoding="utf-8"),
            intent_ids=_intent_ids_from_surface(root),
        )
        if updated_goals != goals_path.read_text(encoding="utf-8"):
            _write_text(
                goals_path,
                updated_goals,
                kind="update_goals_surface",
                detail="carried imported INT-* authority into existing GOALS.md",
                actions=actions,
            )

    requirements_root = root / "specification" / "requirements"
    if not requirements_root.exists():
        requirements_root.mkdir(parents=True, exist_ok=True)
        actions.append(
            _normalization_action(
                kind="create_requirements_root",
                path=requirements_root,
                detail="created canonical specification/requirements/ root",
            )
        )

    imported_summary = root / IMPORTED_REQUIREMENTS_PATH
    if not imported_summary.exists():
        _write_text(
            imported_summary,
            _imported_sources_markdown(root),
            kind="create_imported_requirements_summary",
            detail="captured imported requirement-like sources under the canonical requirements root",
            actions=actions,
        )
        defaults_with_provenance.append(
            _default_with_provenance(
                kind="create_imported_requirements_summary",
                path=imported_summary,
                detail="created imported requirement source summary because the imported workspace had no canonical requirements root",
            )
        )

    if (root / INSTALLED_PRODUCT_ROOT_RELATIVE).exists() or (root / ".odd_sdlc").exists():
        _remove_legacy_root_readme(root, actions=actions)

    project_bootstrap = root / PROJECT_BOOTSTRAP_PATH
    bootstrap_content = _project_bootstrap_markdown(root, project_slug=slug, platform=resolved_platform)
    if not project_bootstrap.exists():
        _write_text(
            project_bootstrap,
            bootstrap_content,
            kind="create_project_bootstrap",
            detail="created deterministic project bootstrap read model from imported authority",
            actions=actions,
        )
        defaults_with_provenance.append(
            _default_with_provenance(
                kind="create_project_bootstrap",
                path=project_bootstrap,
                detail="created project bootstrap read model because the imported workspace did not provide one",
            )
        )
    else:
        original_bootstrap = project_bootstrap.read_text(encoding="utf-8")
        if original_bootstrap != bootstrap_content:
            _write_text(
                project_bootstrap,
                bootstrap_content,
                kind="update_project_bootstrap",
                detail="updated deterministic project bootstrap read model from imported authority",
                actions=actions,
            )

    constraints_path = root / ".ai-workspace" / "context" / "project_constraints.yml"
    raw_constraints = _parse_constraints_lines(constraints_path)
    legacy_output_dir = raw_constraints.get("tenant_output_dir", "")

    _normalize_project_constraints(
        root,
        project_slug=slug,
        platform=resolved_platform,
        actions=actions,
        defaults_with_provenance=defaults_with_provenance,
    )
    _migrate_legacy_realization_root(
        root,
        legacy_output_dir=legacy_output_dir,
        canonical_output_dir=tenant_output_dir(resolved_platform),
        actions=actions,
    )
    profile = load_project_profile(root)
    _remove_legacy_installer_scaffolds(
        root,
        project_slug=slug,
        platform=resolved_platform,
        active_tenant_name=profile.tenant_name,
        actions=actions,
    )
    _normalize_tenant_registry(
        root,
        tenant_name=profile.tenant_name,
        actions=actions,
    )

    analysis_report = refresh_analysis(root, stage="normalize_workspace")
    actions.extend(analysis_report["actions"])

    report = {
        "workspace_root": str(root),
        "workspace_name": root.name,
        "project_slug": slug,
        "platform": resolved_platform,
        "changed": bool(actions),
        "actions": actions,
        "defaults_with_provenance": defaults_with_provenance,
        "report_path": NORMALIZATION_REPORT_PATH.as_posix(),
        "workspace_state_path": analysis_report["workspace_state_path"],
        "analysis_manifest_path": analysis_report["analysis_manifest_path"],
    }

    report_path = root / NORMALIZATION_REPORT_PATH
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return report

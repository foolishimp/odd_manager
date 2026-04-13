#!/usr/bin/env python
"""Runtime helper for the odd_manager React/Vite tenant."""
from __future__ import annotations

import argparse
import json
import re
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _configure_imports(workspace_root: Path) -> None:
    odd_manager_root = Path(__file__).resolve().parents[3]
    odd_method_code = (
        odd_manager_root.parent
        / "odd_method"
        / "build_tenants"
        / "odd_sdlc"
        / "python"
        / "code"
    )
    abiogenesis_code = (
        odd_manager_root.parent
        / "abiogenesis"
        / "build_tenants"
        / "abiogenesis"
        / "python"
        / "code"
    )
    desired = [
        odd_method_code,
        abiogenesis_code,
        workspace_root / ".genesis",
        odd_manager_root / ".genesis",
    ]
    for path in reversed(desired):
        if path.exists():
            path_str = str(path)
            if path_str not in sys.path:
                sys.path.insert(0, path_str)


def _event_value(event: dict[str, Any], key: str) -> Any:
    value = event.get(key)
    if value is not None:
        return value
    return event.get("data", {}).get(key)


def _title_case(raw: str) -> str:
    parts = raw.replace("-", " ").replace("_", " ").split()
    return " ".join(part.capitalize() for part in parts) or raw


def _status_rank(status: str) -> int:
    order = {
        "blocked": 5,
        "gated": 4,
        "active": 3,
        "pending": 2,
        "converged": 1,
    }
    return order.get(status, 0)


def _dominant_status(statuses: list[str]) -> str:
    if not statuses:
        return "pending"
    return sorted(statuses, key=_status_rank, reverse=True)[0]


def _collect_ids(events: list[dict[str, Any]], key: str) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for event in events:
        value = _event_value(event, key)
        if isinstance(value, str) and value and value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


_REQUIREMENT_METADATA_RE = re.compile(r"^\*\*(.+?)\*\*:\s*(.*)$")
_BULLET_METADATA_RE = re.compile(r"^- ([A-Za-z0-9_-]+):\s*(.*)$")
_REQUIREMENT_ID_RE = re.compile(r"\bREQ-[A-Z0-9-]+\b")
_BACKTICK_REF_RE = re.compile(r"`([^`]+)`")
_PATH_REF_RE = re.compile(
    r"(?<![:\w])("
    r"(?:\.ai-workspace|specification|build_tenants)/[A-Za-z0-9_./-]+"
    r"|README\.md"
    r")"
)


def _clean_requirement_value(value: str) -> str:
    return value.strip().strip("`").strip()


def _split_requirement_refs(value: str | None) -> list[str]:
    if not isinstance(value, str):
        return []
    return [
        item.strip().strip("`")
        for item in value.split(",")
        if item.strip().strip("`")
    ]


def _normalize_requirement_heading(raw: str) -> tuple[str, str]:
    text = raw.strip()
    for divider in (" — ", " - ", ": "):
        if divider in text:
            requirement_id, title = text.split(divider, 1)
            return requirement_id.strip(), title.strip()
    return text, ""


def _normalize_requirement_family_title(raw: str) -> str:
    cleaned = raw.strip()
    if ":" in cleaned:
        prefix, suffix = cleaned.split(":", 1)
        if prefix.strip().lower() == "requirement family":
            return suffix.strip()
    return cleaned


def _requirement_tone(status: str | None) -> str:
    value = str(status or "").strip().lower()
    if value in {"realized", "converged", "ready", "completed"}:
        return "converged"
    if value in {"partially_realized", "in_progress", "active"}:
        return "active"
    if value in {"planned", "pending", "specified", "draft"}:
        return "pending"
    if value in {"pending_capability", "blocked", "failed", "hard_block"}:
        return "blocked"
    return "attention"


def _requirement_priority_rank(priority: str | None) -> int:
    value = str(priority or "").strip().lower()
    if value == "critical":
        return 4
    if value == "high":
        return 3
    if value == "medium":
        return 2
    if value == "low":
        return 1
    return 0


def _load_requirement_closure_index(workspace_root: Path) -> dict[str, dict[str, Any]]:
    closure_path = (
        workspace_root
        / ".ai-workspace"
        / "runtime"
        / "odd_sdlc-requirement-closure.json"
    )
    if not closure_path.exists():
        return {}
    try:
        payload = json.loads(closure_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    entries = payload.get("requirements")
    if not isinstance(entries, list):
        return {}
    indexed: dict[str, dict[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        requirement_id = entry.get("requirement_id")
        if isinstance(requirement_id, str) and requirement_id:
            indexed[requirement_id] = entry
    return indexed


def _dedupe_strings(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        value = str(item).strip()
        if value and value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def _is_workspace_relative_path(workspace_root: Path, candidate: str) -> bool:
    normalized = candidate.strip()
    if not normalized or "://" in normalized or normalized.startswith("/"):
        return False
    if "\n" in normalized or "\r" in normalized or len(normalized) > 240:
        return False
    if normalized.startswith("./"):
        normalized = normalized[2:]
    if normalized.startswith("../"):
        return False
    if re.search(r"\s", normalized):
        return False
    if not (
        normalized == "README.md"
        or normalized.startswith(".ai-workspace/")
        or normalized.startswith("specification/")
        or normalized.startswith("build_tenants/")
    ):
        return False
    return (workspace_root / normalized).exists()


def _extract_workspace_refs(text: str, workspace_root: Path) -> list[str]:
    candidates: list[str] = []
    for match in _BACKTICK_REF_RE.finditer(text):
        candidates.append(match.group(1).strip())
    for match in _PATH_REF_RE.finditer(text):
        candidates.append(match.group(1).strip())
    return _dedupe_strings(
        [
            candidate[2:] if candidate.startswith("./") else candidate
            for candidate in candidates
            if _is_workspace_relative_path(workspace_root, candidate)
        ]
    )


def _extract_requirement_ids(text: str) -> list[str]:
    return _dedupe_strings([match.group(0) for match in _REQUIREMENT_ID_RE.finditer(text)])


def _extract_markdown_section(lines: list[str], heading: str) -> str:
    target = heading.strip().lower()
    collecting = False
    collected: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## "):
            if collecting:
                break
            collecting = stripped[3:].strip().lower() == target
            continue
        if collecting:
            collected.append(line.rstrip())
    return "\n".join(collected).strip()


def _first_paragraph(text: str) -> str:
    if not text.strip():
        return ""
    lines: list[str] = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            if lines:
                break
            continue
        if stripped.startswith(("#", "- ", "* ")):
            if lines:
                break
            continue
        lines.append(stripped)
    return " ".join(lines).strip()


def _parse_front_matter_bullets(lines: list[str]) -> dict[str, str]:
    metadata: dict[str, str] = {}
    for line in lines:
        stripped = line.strip()
        bullet_match = _BULLET_METADATA_RE.match(stripped)
        if bullet_match:
            metadata[bullet_match.group(1).strip()] = _clean_requirement_value(
                bullet_match.group(2)
            )
            continue
        rich_match = _REQUIREMENT_METADATA_RE.match(stripped)
        if rich_match:
            metadata[rich_match.group(1).strip()] = _clean_requirement_value(
                rich_match.group(2)
            )
    return metadata


def _split_record_refs(value: str | None) -> list[str]:
    if not isinstance(value, str):
        return []
    cleaned = (
        value.replace(";", ",")
        .replace("|", ",")
        .replace(" and ", ",")
    )
    return _dedupe_strings(
        [_clean_requirement_value(item) for item in cleaned.split(",")]
    )


def _ticket_id_from_stem(stem: str) -> str:
    match = re.match(r"^([A-Z]-\d+)", stem)
    if match:
        return match.group(1)
    return stem


def _project_tickets(workspace_root: Path) -> list[dict[str, Any]]:
    tickets_root = workspace_root / ".ai-workspace" / "tickets"
    if not tickets_root.exists():
        return []

    projected: list[dict[str, Any]] = []
    for folder_name in ("active", "completed"):
        folder = tickets_root / folder_name
        if not folder.exists():
            continue
        for source_path in sorted(folder.glob("*.md")):
            try:
                lines = source_path.read_text(encoding="utf-8").splitlines()
            except OSError:
                continue
            metadata = _parse_front_matter_bullets(lines)
            title_line = next(
                (line.strip()[2:].strip() for line in lines if line.strip().startswith("# ")),
                source_path.stem,
            )
            ticket_id = metadata.get("id") or _ticket_id_from_stem(source_path.stem)
            context_text = _extract_markdown_section(lines, "Context")
            summary = _first_paragraph(context_text) or title_line
            full_text = "\n".join(lines)
            projected.append(
                {
                    "id": ticket_id,
                    "title": title_line.removeprefix(f"{ticket_id} ").strip()
                    if title_line.startswith(f"{ticket_id} ")
                    else title_line,
                    "summary": summary,
                    "type": metadata.get("type"),
                    "status": metadata.get("status") or folder_name,
                    "goal": metadata.get("goal"),
                    "priority": metadata.get("priority"),
                    "created_at": metadata.get("created_at"),
                    "updated_at": metadata.get("updated_at"),
                    "dependencies": _split_record_refs(metadata.get("dependencies")),
                    "links": _extract_workspace_refs(full_text, workspace_root),
                    "linked_requirement_ids": _extract_requirement_ids(full_text),
                    "linked_surfaces": _extract_workspace_refs(full_text, workspace_root),
                    "source_path": str(source_path.relative_to(workspace_root)),
                }
            )
    return projected


def _project_comments(workspace_root: Path) -> list[dict[str, Any]]:
    comments_root = workspace_root / ".ai-workspace" / "comments"
    if not comments_root.exists():
        return []

    projected: list[dict[str, Any]] = []
    for source_path in sorted(comments_root.rglob("*.md")):
        try:
            lines = source_path.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        metadata = _parse_front_matter_bullets(lines)
        title = next(
            (line.strip()[2:].strip() for line in lines if line.strip().startswith("# ")),
            source_path.stem,
        )
        summary_text = _extract_markdown_section(lines, "Summary")
        summary = _first_paragraph(summary_text)
        if not summary:
            summary = _first_paragraph("\n".join(lines))
        full_text = "\n".join(lines)
        projected.append(
            {
                "id": str(source_path.relative_to(workspace_root)),
                "title": title,
                "summary": summary or title,
                "author": metadata.get("Author") or source_path.parent.name,
                "date": metadata.get("Date"),
                "status": metadata.get("Status"),
                "source": metadata.get("source"),
                "addresses": _split_record_refs(metadata.get("Addresses")),
                "linked_requirement_ids": _extract_requirement_ids(full_text),
                "linked_surfaces": _extract_workspace_refs(full_text, workspace_root),
                "source_path": str(source_path.relative_to(workspace_root)),
            }
        )
    return projected


def _parse_requirement_block(
    *,
    workspace_root: Path,
    source_path: Path,
    family_title: str,
    family_metadata: dict[str, str],
    requirement_id: str,
    requirement_title: str,
    block_lines: list[str],
    closure_entry: dict[str, Any] | None,
) -> dict[str, Any]:
    metadata: dict[str, str] = {}
    acceptance_criteria: list[str] = []
    collecting_acceptance = False

    for line in block_lines:
        stripped = line.strip()
        if not stripped:
            continue
        metadata_match = _REQUIREMENT_METADATA_RE.match(stripped)
        if metadata_match:
            key = metadata_match.group(1).strip()
            value = _clean_requirement_value(metadata_match.group(2))
            metadata[key] = value
            collecting_acceptance = key.lower() == "acceptance criteria"
            continue
        if stripped.lower() == "acceptance criteria":
            collecting_acceptance = True
            continue
        if collecting_acceptance and stripped.startswith(("- ", "* ")):
            acceptance_criteria.append(_clean_requirement_value(stripped[2:]))
            continue
        if collecting_acceptance and acceptance_criteria:
            acceptance_criteria[-1] = (
                f"{acceptance_criteria[-1]} {_clean_requirement_value(stripped)}".strip()
            )
            continue
        description = metadata.get("Description")
        if description:
            metadata["Description"] = f"{description} {_clean_requirement_value(stripped)}".strip()

    coverage = closure_entry if isinstance(closure_entry, dict) else None
    coverage_status = (
        str(coverage.get("status")).strip()
        if coverage and isinstance(coverage.get("status"), str)
        else None
    )
    family_status = family_metadata.get("Status")
    effective_status = coverage_status or family_status or metadata.get("Status")
    description = metadata.get("Description") or requirement_title

    return {
        "requirement_id": requirement_id,
        "title": requirement_title or requirement_id,
        "summary": description,
        "family": family_metadata.get("Family") or "",
        "family_title": family_title,
        "family_status": family_status,
        "priority": metadata.get("Priority"),
        "type": metadata.get("Type") or family_metadata.get("Category"),
        "status": effective_status,
        "delivery_status": _requirement_tone(effective_status),
        "traces_to": _split_requirement_refs(
            metadata.get("Traces To") or family_metadata.get("Traces To")
        ),
        "derives_from": _split_requirement_refs(family_metadata.get("Derives From")),
        "authority_refs": list(coverage.get("authority_refs", [])) if coverage else [],
        "current_requirement_refs": list(coverage.get("current_requirement_refs", []))
        if coverage
        else [],
        "implementation_claim_refs": list(coverage.get("implementation_claim_refs", []))
        if coverage
        else [],
        "planned_test_claim_refs": list(coverage.get("planned_test_claim_refs", []))
        if coverage
        else [],
        "test_claim_refs": list(coverage.get("test_claim_refs", [])) if coverage else [],
        "code_refs": list(coverage.get("code_refs", [])) if coverage else [],
        "test_refs": list(coverage.get("test_refs", [])) if coverage else [],
        "testcase_authority_refs": list(coverage.get("testcase_authority_refs", []))
        if coverage
        else [],
        "acceptance_criteria": acceptance_criteria,
        "source_path": str(source_path.relative_to(workspace_root)),
    }


def _project_requirements(workspace_root: Path) -> list[dict[str, Any]]:
    requirements_root = workspace_root / "specification" / "requirements"
    if not requirements_root.exists():
        return []

    closure_index = _load_requirement_closure_index(workspace_root)
    projected: list[dict[str, Any]] = []

    for source_path in sorted(requirements_root.glob("*.md")):
        if source_path.name.lower() == "readme.md":
            continue
        try:
            lines = source_path.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue

        family_title = source_path.stem
        family_metadata: dict[str, str] = {}
        current_requirement_id: str | None = None
        current_requirement_title = ""
        current_block_lines: list[str] = []

        def flush_current_requirement() -> None:
            nonlocal current_requirement_id, current_requirement_title, current_block_lines
            if not current_requirement_id:
                return
            projected.append(
                _parse_requirement_block(
                    workspace_root=workspace_root,
                    source_path=source_path,
                    family_title=family_title,
                    family_metadata=family_metadata,
                    requirement_id=current_requirement_id,
                    requirement_title=current_requirement_title,
                    block_lines=current_block_lines,
                    closure_entry=closure_index.get(current_requirement_id),
                )
            )
            current_requirement_id = None
            current_requirement_title = ""
            current_block_lines = []

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("# ") and family_title == source_path.stem:
                family_title = _normalize_requirement_family_title(stripped[2:].strip())
                continue
            if current_requirement_id is None:
                metadata_match = _REQUIREMENT_METADATA_RE.match(stripped)
                if metadata_match:
                    family_metadata[metadata_match.group(1).strip()] = _clean_requirement_value(
                        metadata_match.group(2)
                    )
                    continue
            if stripped.startswith("### REQ"):
                flush_current_requirement()
                current_requirement_id, current_requirement_title = _normalize_requirement_heading(
                    stripped.removeprefix("###").strip()
                )
                continue
            if current_requirement_id is not None:
                current_block_lines.append(line)

        flush_current_requirement()

    deduplicated: dict[str, dict[str, Any]] = {}
    for requirement in projected:
        requirement_id = requirement.get("requirement_id")
        if not isinstance(requirement_id, str) or not requirement_id:
            continue
        current = deduplicated.get(requirement_id)
        if current is None or _prefer_requirement_entry(requirement, current):
            deduplicated[requirement_id] = requirement
    return [
        deduplicated[requirement_id]
        for requirement_id in sorted(deduplicated)
    ]


def _prefer_requirement_entry(candidate: dict[str, Any], current: dict[str, Any]) -> bool:
    def score(entry: dict[str, Any]) -> tuple[int, int, int]:
        source_path = str(entry.get("source_path") or "")
        evidence_count = sum(
            len(entry.get(key, []))
            for key in (
                "authority_refs",
                "implementation_claim_refs",
                "planned_test_claim_refs",
                "code_refs",
                "test_refs",
                "testcase_authority_refs",
            )
            if isinstance(entry.get(key), list)
        )
        acceptance_count = (
            len(entry.get("acceptance_criteria", []))
            if isinstance(entry.get("acceptance_criteria"), list)
            else 0
        )
        generated_penalty = 0 if "generated" not in source_path else -1
        return (generated_penalty, evidence_count, acceptance_count)

    return score(candidate) > score(current)


def _load_app(workspace_root: Path):
    _configure_imports(workspace_root)
    from odd_sdlc.app import bootstrap, initialize

    return initialize(bootstrap(workspace_root=workspace_root))


def _configure_read_only_domain_fallbacks() -> None:
    import odd_sdlc.ambiguity as odd_ambiguity
    import odd_sdlc.app as odd_app
    import odd_sdlc.query as odd_query
    import odd_sdlc.traceability as odd_traceability

    if getattr(odd_query, "_odd_manager_read_only_safe", False):
        return

    original_ambiguity_loader = odd_ambiguity.load_or_build_ambiguity_register
    original_traceability_loader = (
        odd_traceability.load_or_build_requirement_closure_register
    )

    def safe_ambiguity_loader(workspace_root: Path) -> dict[str, Any]:
        try:
            return original_ambiguity_loader(workspace_root)
        except PermissionError:
            return odd_ambiguity.build_ambiguity_register(
                Path(workspace_root),
                stage="workspace_scan",
            )

    def safe_traceability_loader(workspace_root: Path) -> dict[str, Any]:
        try:
            return original_traceability_loader(workspace_root)
        except PermissionError:
            return odd_traceability.build_requirement_closure_register(
                Path(workspace_root),
                stage="workspace_scan",
            )

    # odd_method currently refreshes these registers eagerly during query composition.
    # When odd_manager observes an external workspace it may be able to read that
    # workspace without being allowed to rewrite its runtime files, so fall back
    # to an in-memory rebuild instead of dropping to degraded mode.
    odd_ambiguity.load_or_build_ambiguity_register = safe_ambiguity_loader
    odd_app.load_or_build_ambiguity_register = safe_ambiguity_loader
    odd_query.load_or_build_ambiguity_register = safe_ambiguity_loader
    odd_traceability.load_or_build_requirement_closure_register = (
        safe_traceability_loader
    )
    odd_query.load_or_build_requirement_closure_register = (
        safe_traceability_loader
    )
    odd_query._odd_manager_read_only_safe = True


def _query_domain_payload(app) -> dict[str, Any]:
    _configure_read_only_domain_fallbacks()
    from odd_sdlc.query import query_domain

    return query_domain(app)


def _format_error_summary(error: Exception) -> str:
    error_text = str(error).strip()
    if not error_text:
        error_text = error.__class__.__name__
    return error_text.replace("\n", " ")


def _empty_query_contract() -> dict[str, Any]:
    return {
        "name": "odd_sdlc.query-domain",
        "version": "unavailable",
        "top_level_keys": [],
        "runtime_model": "abg-native",
        "query_model": "odd-domain-plugin",
    }


def _empty_ambiguity_register(workspace_root: Path) -> dict[str, Any]:
    return {
        "register_kind": "odd_sdlc.ambiguity_register",
        "schema_version": "v2",
        "workspace_root": str(workspace_root),
        "stage": "unavailable",
        "project_profile": {},
        "summary": {
            "total": 0,
            "blocking": 0,
            "hard_stop": 0,
            "fh_required": 0,
            "pending_capability": 0,
            "status_counts": {},
        },
        "ambiguities": [],
    }


def _empty_gap_payload() -> dict[str, Any]:
    return {
        "converged": False,
        "gaps": [],
        "jobs_considered": 0,
        "open_frames": 0,
        "total_delta": 0.0,
    }


def _ambiguity_operator_fields(entry: dict[str, Any]) -> dict[str, Any]:
    ambiguity_class = str(entry.get("class") or "")
    policy_action = str(entry.get("policy_action") or "")
    decision_status = str(entry.get("decision_status") or "")
    expected_edge = str(entry.get("expected_resolving_edge") or "")
    observed_state = entry.get("observed_state")
    field_name = (
        str(observed_state.get("field_name") or "")
        if isinstance(observed_state, dict)
        else ""
    )
    tenant_name = (
        str(observed_state.get("tenant_name") or "")
        if isinstance(observed_state, dict)
        else ""
    )

    capability_surface = field_name or None

    if entry.get("blocking") or entry.get("hard_stop") or policy_action == "hard_block":
        if "capability" in ambiguity_class:
            governance_posture = "Capability declaration required"
        else:
            governance_posture = "Hard stop"
    elif policy_action == "escalate_fh" or decision_status == "fh_required":
        governance_posture = "Human resolution required"
    elif decision_status == "pending_capability" or policy_action == "pending_capability":
        governance_posture = "Capability pending"
    elif policy_action == "carry":
        governance_posture = "Carry with explicit oversight"
    elif policy_action == "observe":
        governance_posture = "Observe without immediate intervention"
    else:
        governance_posture = "Active ambiguity"

    if "capability" in ambiguity_class and capability_surface and expected_edge:
        operator_headline = (
            f"Declare `{capability_surface}` before `{expected_edge}` becomes admissible."
        )
    elif policy_action == "escalate_fh" and expected_edge:
        operator_headline = f"Resolve this ambiguity through F_H before `{expected_edge}` proceeds."
    elif expected_edge:
        operator_headline = f"Resolve this ambiguity before `{expected_edge}` proceeds."
    else:
        operator_headline = (
            str(entry.get("current_resolution") or "")
            or str(entry.get("description") or "")
            or "Resolve the active ambiguity before continuing the governed lane."
        )

    if "capability" in ambiguity_class and capability_surface:
        edge_clause = f" and reopen `{expected_edge}`" if expected_edge else ""
        tenant_clause = f" for tenant `{tenant_name}`" if tenant_name else ""
        next_lawful_action = f"Declare `{capability_surface}`{tenant_clause}{edge_clause}."
    elif policy_action == "escalate_fh" and expected_edge:
        next_lawful_action = f"Take an F_H decision on `{expected_edge}` and record the governing outcome."
    elif policy_action in {"carry", "observe"} and expected_edge:
        next_lawful_action = f"Continue bounded work on `{expected_edge}` while keeping the ambiguity explicit."
    elif expected_edge:
        next_lawful_action = f"Resolve the governing decision for `{expected_edge}` before reopening the lane."
    else:
        next_lawful_action = (
            str(entry.get("current_resolution") or "")
            or "Resolve the active ambiguity and record the governing decision."
        )

    return {
        "governance_posture": governance_posture,
        "operator_headline": operator_headline,
        "next_lawful_action": next_lawful_action,
        "capability_surface": capability_surface,
        "tenant_name": tenant_name or None,
    }


def _ambiguity_summary_counts(ambiguity_register: dict[str, Any]) -> dict[str, int]:
    entries = [
        entry
        for entry in ambiguity_register.get("ambiguities", [])
        if isinstance(entry, dict)
    ]
    summary = ambiguity_register.get("summary")
    if not isinstance(summary, dict):
        summary = {}
    counts = {
            "total": 0,
            "blocking": 0,
            "hard_stop": 0,
            "fh_required": 0,
            "pending_capability": 0,
        }
    for key in ("total", "blocking", "hard_stop", "fh_required", "pending_capability"):
        value = summary.get(key)
        counts[key] = int(value) if isinstance(value, (int, float)) else 0
    if counts["total"] == 0:
        counts["total"] = len(entries)
    if counts["blocking"] == 0:
        counts["blocking"] = sum(1 for entry in entries if bool(entry.get("blocking")))
    if counts["hard_stop"] == 0:
        counts["hard_stop"] = sum(1 for entry in entries if bool(entry.get("hard_stop")))
    if counts["fh_required"] == 0:
        counts["fh_required"] = sum(
            1
            for entry in entries
            if str(entry.get("policy_action") or "") == "escalate_fh"
            or str(entry.get("decision_status") or "") == "fh_required"
        )
    if counts["pending_capability"] == 0:
        counts["pending_capability"] = sum(
            1
            for entry in entries
            if str(entry.get("decision_status") or "") == "pending_capability"
            or str(entry.get("policy_action") or "") == "pending_capability"
            or "capability" in str(entry.get("class") or "")
        )
    return counts


def _normalize_ambiguity_register(
    workspace_root: Path,
    ambiguity_register: dict[str, Any] | None,
) -> dict[str, Any]:
    register = ambiguity_register if isinstance(ambiguity_register, dict) else _empty_ambiguity_register(workspace_root)
    normalized_entries = [
        {**entry, **_ambiguity_operator_fields(entry)}
        for entry in register.get("ambiguities", [])
        if isinstance(entry, dict)
    ]
    register = {
        **register,
        "ambiguities": normalized_entries,
    }
    counts = _ambiguity_summary_counts(register)
    summary = register.get("summary")
    status_counts = summary.get("status_counts") if isinstance(summary, dict) else {}
    if not isinstance(status_counts, dict):
        status_counts = {}
    return {
        **register,
        "summary": {
            **(summary if isinstance(summary, dict) else {}),
            **counts,
            "status_counts": status_counts,
        },
    }


def _domain_projection(
    workspace_root: Path,
    domain_payload: dict[str, Any],
    *,
    functions: list[dict[str, Any]],
    graph_functions: list[dict[str, Any]],
    workorders: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "workspace_root": str(domain_payload.get("workspace_root") or workspace_root),
        "query_contract": domain_payload.get("query_contract") or _empty_query_contract(),
        "semantic_facets": list(domain_payload.get("semantic_facets") or []),
        "asset_types": list(domain_payload.get("asset_types") or []),
        "asset_families": list(domain_payload.get("asset_families") or []),
        "assets": list(domain_payload.get("assets") or []),
        "requirements": _project_requirements(workspace_root),
        "tickets": _project_tickets(workspace_root),
        "comments": _project_comments(workspace_root),
        "ambiguity_register": _normalize_ambiguity_register(
            workspace_root,
            domain_payload.get("ambiguity_register"),
        ),
        "collections": list(domain_payload.get("collections") or []),
        "bindings": list(domain_payload.get("bindings") or []),
        "functions": functions,
        "edge_contracts": list(domain_payload.get("edge_contracts") or []),
        "programs": list(domain_payload.get("programs") or []),
        "work_act_types": list(domain_payload.get("work_act_types") or []),
        "jobs": list(domain_payload.get("jobs") or []),
        "graph_functions": graph_functions,
        "workorders": workorders,
        "gaps": domain_payload.get("gaps") or _empty_gap_payload(),
    }


def _degraded_world(workspace_root: Path, error: Exception) -> dict[str, Any]:
    summary = _format_error_summary(error)
    return {
        "workspace_root": str(workspace_root),
        "generated_at": _now_iso(),
        "boundary": {
            "runtime_source": "abg_event_model (unavailable)",
            "runtime_aggregate_provider": "abg_projectors (unavailable)",
            "domain_source": "odd_method_query_library (failed to load)",
            "graph_derivation": "unavailable because odd_method bootstrap failed",
            "query_cadence": "on_demand",
        },
        "overview": {
            "status": "blocked",
            "headline": "odd_method domain overlay failed to load.",
            "summary": (
                "odd_manager is running in degraded mode because the odd_method "
                f"bootstrap failed: {summary}"
            ),
            "total_delta": 0.0,
            "total_assets": 0,
            "total_workorders": 0,
            "total_gaps": 0,
            "active_runs": 0,
            "open_continuations": 0,
            "latest_event_time": None,
        },
        "graph_set": {
            "id": "graphset.workspace",
            "label": "Workspace Graph Set",
            "status": "blocked",
            "graphs": [],
        },
        "domain": {
            "workspace_root": str(workspace_root),
            "query_contract": _empty_query_contract(),
            "semantic_facets": [],
            "asset_types": [],
            "asset_families": [],
            "assets": [],
            "requirements": [],
            "tickets": [],
            "comments": [],
            "ambiguity_register": _empty_ambiguity_register(workspace_root),
            "collections": [],
            "bindings": [],
            "functions": [],
            "edge_contracts": [],
            "programs": [],
            "work_act_types": [],
            "jobs": [],
            "graph_functions": [],
            "workorders": [],
            "gaps": _empty_gap_payload(),
        },
        "runtime": {
            "runs": [],
            "graph_calls": [],
            "continuations": [],
            "frames": [],
            "recent_events": [],
            "event_count": 0,
            "latest_event_time": None,
        },
    }


def _project_runtime(events: list[dict[str, Any]]) -> dict[str, Any]:
    from genesis.continuation import project_continuation
    from genesis.frames import project_frame_events
    from genesis.graph_call import project_graph_call
    from genesis.run import project_run

    run_ids = _collect_ids(events, "run_id")
    call_ids = _collect_ids(events, "call_id")
    continuation_ids = _collect_ids(events, "continuation_id")
    frame_ids = _collect_ids(events, "frame_id")

    return {
        "runs": [project_run(events, run_id) for run_id in run_ids],
        "graph_calls": [project_graph_call(events, call_id) for call_id in call_ids],
        "continuations": [
            project_continuation(events, continuation_id)
            for continuation_id in continuation_ids
        ],
        "frames": [project_frame_events(events, frame_id) for frame_id in frame_ids],
        "recent_events": [
            {
                "event_id": event.get("event_id"),
                "event_time": event.get("event_time"),
                "event_type": event.get("event_type"),
                "aggregate_type": event.get("aggregate_type"),
                "aggregate_id": event.get("aggregate_id"),
                "run_id": _event_value(event, "run_id"),
                "call_id": _event_value(event, "call_id"),
                "continuation_id": _event_value(event, "continuation_id"),
                "frame_id": _event_value(event, "frame_id"),
            }
            for event in events[-30:]
        ],
        "event_count": len(events),
        "latest_event_time": events[-1].get("event_time") if events else None,
    }


def _gap_by_edge(gaps_payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        gap["edge"]: gap
        for gap in gaps_payload.get("gaps", [])
        if isinstance(gap.get("edge"), str)
    }


def _aggregate_gap_overlay(
    owner_id: str,
    edge_names: list[str],
    gap_by_edge: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    related_gaps = [gap_by_edge[edge_name] for edge_name in edge_names if edge_name in gap_by_edge]
    if not related_gaps:
        return None
    if len(related_gaps) == 1:
        return related_gaps[0]
    delta = sum(float(gap.get("delta", 0.0)) for gap in related_gaps)
    failing = sorted(
        {
            item
            for gap in related_gaps
            for item in gap.get("failing", [])
            if isinstance(item, str)
        }
    )
    passing = sorted(
        {
            item
            for gap in related_gaps
            for item in gap.get("passing", [])
            if isinstance(item, str)
        }
    )
    return {
        "edge": owner_id,
        "delta": delta,
        "delta_summary": f"{len(related_gaps)} internal edges remain unconverged.",
        "failing": failing,
        "passing": passing,
    }


def _graph_function_contract_target(job: dict[str, Any]) -> str | None:
    for contract in job.get("contracts", []):
        if not isinstance(contract, dict):
            continue
        if contract.get("kind") != "graph_function":
            continue
        target_id = contract.get("target_id")
        if isinstance(target_id, str) and target_id:
            return target_id
    return None


def _project_functions(
    functions: list[dict[str, Any]],
    graph_functions: list[dict[str, Any]],
    gaps_payload: dict[str, Any],
    runtime_payload: dict[str, Any],
) -> list[dict[str, Any]]:
    graph_function_by_name = {
        entry["name"]: entry
        for entry in graph_functions
        if isinstance(entry.get("name"), str)
    }
    gap_by_edge = _gap_by_edge(gaps_payload)
    projected: list[dict[str, Any]] = []
    for entry in functions:
        function_id = entry["name"]
        graph_function = graph_function_by_name.get(entry["backing_graph_function"], {})
        graph_function_id = graph_function.get("id")
        related_runs = [
            run for run in runtime_payload["runs"] if run.get("edge") == function_id
        ]
        related_calls = [
            call
            for call in runtime_payload["graph_calls"]
            if call.get("graph_function_id") in {graph_function_id, entry["backing_graph_function"]}
        ]
        related_run_ids = {
            run["instance_id"]
            for run in related_runs
            if isinstance(run.get("instance_id"), str)
        }
        related_call_ids = {
            call["instance_id"]
            for call in related_calls
            if isinstance(call.get("instance_id"), str)
        }
        open_continuations = [
            continuation
            for continuation in runtime_payload["continuations"]
            if continuation.get("status") == "open"
            and (
                continuation.get("run_id") in related_run_ids
                or continuation.get("call_id") in related_call_ids
            )
        ]
        blocked = any(
            item.get("status") in {"failed", "timed_out"}
            for item in related_runs + related_calls
        )
        active = any(
            item.get("status")
            in {"queued", "pending", "started", "dispatched", "open"}
            for item in related_runs + related_calls
        )
        if blocked:
            status = "blocked"
        elif open_continuations:
            status = "gated"
        elif active:
            status = "active"
        elif function_id in gap_by_edge:
            status = "pending"
        else:
            status = "converged"
        projected.append(
            {
                "id": function_id,
                "label": _title_case(function_id),
                "status": status,
                "intent": entry["intent"],
                "inputs": list(entry["inputs"]),
                "outputs": list(entry["outputs"]),
                "backing_graph_function": entry["backing_graph_function"],
                "published_graph_function_id": graph_function_id,
                "gap": gap_by_edge.get(function_id),
                "run_ids": sorted(related_run_ids),
                "call_ids": sorted(related_call_ids),
                "open_continuation_ids": [
                    continuation["instance_id"]
                    for continuation in open_continuations
                    if isinstance(continuation.get("instance_id"), str)
                ],
            }
        )
    return projected


def _project_workorders(
    jobs: list[dict[str, Any]],
    graph_functions: list[dict[str, Any]],
    gaps_payload: dict[str, Any],
    runtime_payload: dict[str, Any],
) -> list[dict[str, Any]]:
    graph_function_by_id = {
        entry["id"]: entry
        for entry in graph_functions
        if isinstance(entry.get("id"), str)
    }
    gap_by_edge = _gap_by_edge(gaps_payload)
    workorders: list[dict[str, Any]] = []
    for job in jobs:
        job_name = job.get("name")
        if not isinstance(job_name, str) or not job_name:
            continue
        graph_function_id = _graph_function_contract_target(job)
        graph_function = graph_function_by_id.get(graph_function_id or "", {})
        graph_function_name = graph_function.get("name", graph_function_id or job_name)
        vector_names = [
            vector.get("name")
            for vector in graph_function.get("vectors", [])
            if isinstance(vector, dict) and isinstance(vector.get("name"), str)
        ]
        related_runs = [
            run for run in runtime_payload["runs"] if run.get("job_id") == job_name
        ]
        related_run_ids = {
            run["instance_id"]
            for run in related_runs
            if isinstance(run.get("instance_id"), str)
        }
        related_calls = [
            call
            for call in runtime_payload["graph_calls"]
            if call.get("run_id") in related_run_ids
        ]
        if not related_calls and graph_function_id:
            related_calls = [
                call
                for call in runtime_payload["graph_calls"]
                if call.get("graph_function_id") == graph_function_id
            ]
        related_call_ids = {
            call["instance_id"]
            for call in related_calls
            if isinstance(call.get("instance_id"), str)
        }
        open_continuations = [
            continuation
            for continuation in runtime_payload["continuations"]
            if continuation.get("status") == "open"
            and (
                continuation.get("run_id") in related_run_ids
                or continuation.get("call_id") in related_call_ids
            )
        ]
        blocked = any(
            item.get("status") in {"failed", "timed_out"}
            for item in related_runs + related_calls
        )
        active = any(
            item.get("status")
            in {"queued", "pending", "started", "dispatched", "open"}
            for item in related_runs + related_calls
        )
        gap_overlay = _aggregate_gap_overlay(job_name, vector_names, gap_by_edge)
        if blocked:
            status = "blocked"
        elif open_continuations:
            status = "gated"
        elif active:
            status = "active"
        elif gap_overlay:
            status = "pending"
        else:
            status = "converged"
        workorders.append(
            {
                "id": job_name,
                "label": _title_case(job_name.removesuffix("_job")),
                "status": status,
                "intent": graph_function.get("intent")
                or f"Published job bound to {graph_function_name}.",
                "inputs": list(graph_function.get("inputs", [])),
                "outputs": list(graph_function.get("outputs", [])),
                "graph_function_id": graph_function_id or graph_function_name,
                "graph_function_name": graph_function_name,
                "gap": gap_overlay,
                "run_ids": sorted(related_run_ids),
                "call_ids": sorted(related_call_ids),
                "open_continuation_ids": [
                    continuation["instance_id"]
                    for continuation in open_continuations
                    if isinstance(continuation.get("instance_id"), str)
                ],
                "source": "published_job",
            }
        )
    return workorders


def _project_graph_functions(
    graph_functions: list[dict[str, Any]],
    workorders: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    workorder_ids_by_graph_function: dict[str, list[str]] = {}
    status_by_graph_function: dict[str, list[str]] = {}
    for workorder in workorders:
        graph_function_id = workorder.get("graph_function_id")
        if not isinstance(graph_function_id, str) or not graph_function_id:
            continue
        workorder_ids_by_graph_function.setdefault(graph_function_id, []).append(workorder["id"])
        status_by_graph_function.setdefault(graph_function_id, []).append(workorder["status"])

    projected: list[dict[str, Any]] = []
    for entry in graph_functions:
        graph_function_id = entry.get("id")
        graph_function_name = entry.get("name")
        if not isinstance(graph_function_id, str) or not isinstance(graph_function_name, str):
            continue
        projected.append(
            {
                "id": graph_function_id,
                "name": graph_function_name,
                "label": _title_case(graph_function_name),
                "status": _dominant_status(status_by_graph_function.get(graph_function_id, ["attention"])),
                "intent": entry.get("intent") or "Published graph-function carrier.",
                "function_kind": entry.get("function_kind"),
                "inputs": list(entry.get("inputs", [])),
                "outputs": list(entry.get("outputs", [])),
                "environment": {
                    "requires": list(entry.get("environment", {}).get("requires", [])),
                    "provides": list(entry.get("environment", {}).get("provides", [])),
                    "carries": list(entry.get("environment", {}).get("carries", [])),
                },
                "vectors": [
                    {
                        "name": vector.get("name", "vector"),
                        "source": list(vector.get("source", [])),
                        "target": vector.get("target", "target"),
                    }
                    for vector in entry.get("vectors", [])
                    if isinstance(vector, dict)
                ],
                "job_names": list(entry.get("job_names", [])),
                "workorder_ids": list(workorder_ids_by_graph_function.get(graph_function_id, [])),
            }
        )
    return projected


def _catalog_status(realization_status: str | None) -> str:
    value = str(realization_status or "")
    if "active" in value:
        return "active"
    return "attention"


def _ambiguity_status(entry: dict[str, Any]) -> str:
    if entry.get("blocking") or entry.get("hard_stop"):
        return "blocked"
    if str(entry.get("policy_action") or "") == "hard_block":
        return "blocked"
    if str(entry.get("policy_action") or "") == "escalate_fh":
        return "gated"
    if str(entry.get("decision_status") or "") == "pending_capability":
        return "attention"
    if "capability" in str(entry.get("class") or ""):
        return "attention"
    if str(entry.get("policy_action") or "") in {"carry", "observe"}:
        return "active"
    return "attention"


def _project_requirement_traceability_graph(
    domain_payload: dict[str, Any],
    workorders: list[dict[str, Any]],
) -> dict[str, Any] | None:
    requirements = [
        requirement
        for requirement in domain_payload.get("requirements", [])
        if isinstance(requirement, dict)
        and isinstance(requirement.get("requirement_id"), str)
    ]
    if not requirements:
        return None

    nodes: list[dict[str, Any]] = []
    segments: list[dict[str, Any]] = []
    node_ids: set[str] = set()
    segment_ids: set[str] = set()

    def append_node(node: dict[str, Any]) -> None:
        node_id = node["id"]
        if node_id in node_ids:
            return
        node_ids.add(node_id)
        nodes.append(node)

    def append_segment(
        segment_id: str,
        source_id: str,
        target_id: str,
        *,
        label: str,
        status: str,
        ref_id: str | None,
    ) -> None:
        if (
            segment_id in segment_ids
            or source_id not in node_ids
            or target_id not in node_ids
        ):
            return
        segment_ids.add(segment_id)
        segments.append(
            {
                "id": segment_id,
                "from": source_id,
                "to": target_id,
                "label": label,
                "status": status,
                "ref_id": ref_id,
            }
        )

    def normalize_reference(reference: Any) -> str | None:
        if not isinstance(reference, str):
            return None
        normalized = reference.strip().lstrip("./")
        if not normalized or "://" in normalized:
            return None
        return normalized

    def module_surface_for_path(relative_path: str) -> str | None:
        normalized = normalize_reference(relative_path)
        if normalized is None or normalized.startswith("specification/"):
            return None
        for marker in ("/src/main/", "/src/test/", "/src/"):
            if marker in normalized:
                prefix = normalized.split(marker, 1)[0]
                return prefix or str(Path(normalized).parent)
        parent = str(Path(normalized).parent)
        return None if parent in {"", "."} else parent

    def describe_surface(relative_path: str) -> tuple[str, str, str]:
        normalized = relative_path.lower()
        if relative_path.startswith("specification/requirements/"):
            return ("Requirement Surface", "converged", "requirement authority")
        if relative_path.startswith("specification/"):
            if "testcase" in normalized or "acceptance" in normalized:
                return ("Acceptance Surface", "pending", "acceptance definition")
            return ("Design Surface", "converged", "design input")
        if (
            "/tests/" in normalized
            or "/test/" in normalized
            or "/src/test/" in normalized
            or normalized.endswith("spec.scala")
            or normalized.endswith("test.scala")
            or normalized.endswith("_test.py")
            or normalized.endswith(".spec.ts")
            or normalized.endswith(".spec.tsx")
            or normalized.endswith(".test.ts")
            or normalized.endswith(".test.tsx")
        ):
            return ("Test Surface", "pending", "test evidence")
        return ("Code Surface", "active", "implementation file")

    def ensure_requirement_node(requirement: dict[str, Any]) -> str:
        requirement_id = str(requirement["requirement_id"])
        node_id = f"requirement:{requirement_id}"
        subtitle_parts = [
            part
            for part in (
                str(requirement.get("priority") or "").strip() or None,
                str(requirement.get("family_title") or "").strip() or None,
            )
            if part
        ]
        append_node(
            {
                "id": node_id,
                "node_name": requirement_id,
                "label": requirement_id,
                "kind": "catalog",
                "status": requirement.get("delivery_status", "attention"),
                "description": requirement.get("title") or requirement.get("summary") or requirement_id,
                "subtitle": " · ".join(subtitle_parts) or "backlog requirement",
                "asset_ids": [],
                "ref_kind": "requirement",
                "ref_id": requirement_id,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        return node_id

    def ensure_surface_node(relative_path: str) -> str:
        title, tone, subtitle = describe_surface(relative_path)
        node_id = f"surface:{relative_path}"
        label = Path(relative_path).name or relative_path
        append_node(
            {
                "id": node_id,
                "node_name": relative_path,
                "label": label,
                "kind": "asset_node",
                "status": tone,
                "description": title,
                "subtitle": subtitle,
                "asset_ids": [],
                "ref_kind": "surface",
                "ref_id": relative_path,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        return node_id

    def ensure_module_node(module_path: str) -> str:
        node_id = f"module:{module_path}"
        label = Path(module_path).name or module_path
        append_node(
            {
                "id": node_id,
                "node_name": module_path,
                "label": label,
                "kind": "catalog",
                "status": "active",
                "description": "Module or implementation area carrying requirement realization.",
                "subtitle": "module",
                "asset_ids": [],
                "ref_kind": "surface",
                "ref_id": module_path,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        return node_id

    ordered_requirements = sorted(
        requirements,
        key=lambda requirement: (
            -_requirement_priority_rank(requirement.get("priority")),
            str(requirement.get("requirement_id")),
        ),
    )

    for requirement in ordered_requirements:
        requirement_id = str(requirement["requirement_id"])
        requirement_node_id = ensure_requirement_node(requirement)
        added_paths: set[str] = set()

        def add_requirement_surface(path: Any, label: str) -> None:
            normalized = normalize_reference(path)
            if normalized is None or normalized in added_paths:
                return
            added_paths.add(normalized)
            surface_node_id = ensure_surface_node(normalized)
            append_segment(
                f"{requirement_id}->{label}:{normalized}",
                requirement_node_id,
                surface_node_id,
                label=label,
                status=requirement.get("delivery_status", "attention"),
                ref_id=requirement_id,
            )

        add_requirement_surface(requirement.get("source_path"), "requirement")
        for reference in requirement.get("derives_from", []):
            add_requirement_surface(reference, "design")
        for reference in requirement.get("authority_refs", []):
            add_requirement_surface(reference, "authority")
        for reference in requirement.get("current_requirement_refs", []):
            add_requirement_surface(reference, "current")
        for reference in requirement.get("testcase_authority_refs", []):
            add_requirement_surface(reference, "acceptance")

        implementation_paths = [
            normalize_reference(reference)
            for reference in (
                list(requirement.get("code_refs", []))
                + list(requirement.get("implementation_claim_refs", []))
            )
        ]
        test_paths = [
            normalize_reference(reference)
            for reference in (
                list(requirement.get("test_refs", []))
                + list(requirement.get("planned_test_claim_refs", []))
                + list(requirement.get("test_claim_refs", []))
            )
        ]
        linked_module_paths = {
            module_surface_for_path(path)
            for path in implementation_paths + test_paths
            if path is not None
        }
        linked_module_paths.discard(None)

        for module_path in sorted(linked_module_paths):
            if not isinstance(module_path, str):
                continue
            module_node_id = ensure_module_node(module_path)
            append_segment(
                f"{requirement_id}->module:{module_path}",
                requirement_node_id,
                module_node_id,
                label="module",
                status=requirement.get("delivery_status", "attention"),
                ref_id=requirement_id,
            )

        for path in sorted({path for path in implementation_paths if path}):
            module_path = module_surface_for_path(path)
            source_node_id = (
                ensure_module_node(module_path)
                if isinstance(module_path, str)
                else requirement_node_id
            )
            surface_node_id = ensure_surface_node(path)
            append_segment(
                f"{source_node_id}->code:{path}",
                source_node_id,
                surface_node_id,
                label="code",
                status="active",
                ref_id=requirement_id,
            )

        for path in sorted({path for path in test_paths if path}):
            module_path = module_surface_for_path(path)
            source_node_id = (
                ensure_module_node(module_path)
                if isinstance(module_path, str)
                else requirement_node_id
            )
            surface_node_id = ensure_surface_node(path)
            append_segment(
                f"{source_node_id}->test:{path}",
                source_node_id,
                surface_node_id,
                label="test",
                status="pending",
                ref_id=requirement_id,
            )

    if not nodes:
        return None

    graph_status = _dominant_status([node["status"] for node in nodes])
    return {
        "id": "graph.requirement_traceability",
        "label": "Requirement Dependency Map",
        "status": graph_status,
        "derivation": "workspace requirements linked to design sources, module areas, and implementation/test surfaces",
        "nodes": nodes,
        "segments": segments,
    }


def _project_builder_governance_graph(
    domain_payload: dict[str, Any],
    functions: list[dict[str, Any]],
    workorders: list[dict[str, Any]],
) -> dict[str, Any] | None:
    assets_by_id = {
        asset["asset_id"]: asset
        for asset in domain_payload.get("assets", [])
        if isinstance(asset.get("asset_id"), str)
    }
    function_by_id = {
        function["id"]: function
        for function in functions
        if isinstance(function.get("id"), str)
    }
    workorder_by_id = {
        workorder["id"]: workorder
        for workorder in workorders
        if isinstance(workorder.get("id"), str)
    }

    nodes: list[dict[str, Any]] = []
    segments: list[dict[str, Any]] = []
    node_ids: set[str] = set()

    def append_node(node: dict[str, Any]) -> None:
        node_id = node["id"]
        if node_id in node_ids:
            return
        node_ids.add(node_id)
        nodes.append(node)

    def append_segment(
        segment_id: str,
        source_id: str,
        target_id: str,
        *,
        label: str,
        status: str,
        ref_id: str | None,
    ) -> None:
        if source_id not in node_ids or target_id not in node_ids:
            return
        segments.append(
            {
                "id": segment_id,
                "from": source_id,
                "to": target_id,
                "label": label,
                "status": status,
                "ref_id": ref_id,
            }
        )

    def ensure_function_node(function_id: str) -> str | None:
        function = function_by_id.get(function_id)
        if not function:
            return None
        node_id = f"builder:function:{function_id}"
        append_node(
            {
                "id": node_id,
                "node_name": function_id,
                "label": function["label"],
                "kind": "function",
                "status": function["status"],
                "description": function["intent"],
                "subtitle": function["backing_graph_function"],
                "asset_ids": [],
                "ref_kind": "function",
                "ref_id": function_id,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        return node_id

    def ensure_workorder_node(workorder_id: str) -> str | None:
        workorder = workorder_by_id.get(workorder_id)
        if not workorder:
            return None
        node_id = f"builder:workorder:{workorder_id}"
        append_node(
            {
                "id": node_id,
                "node_name": workorder_id,
                "label": workorder["label"],
                "kind": "catalog",
                "status": workorder["status"],
                "description": workorder["intent"],
                "subtitle": workorder["graph_function_name"],
                "asset_ids": [],
                "ref_kind": "workorder",
                "ref_id": workorder_id,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        return node_id

    def ensure_asset_node(asset_id: str) -> str | None:
        asset = assets_by_id.get(asset_id)
        if not asset:
            return None
        status = "blocked" if asset.get("metadata", {}).get("exists") == "false" else "converged"
        node_id = f"builder:asset:{asset_id}"
        append_node(
            {
                "id": node_id,
                "node_name": asset_id,
                "label": _title_case(asset_id),
                "kind": "asset_node",
                "status": status,
                "description": asset.get("uri", "Affected asset."),
                "subtitle": asset.get("declared_type", "asset"),
                "asset_ids": [asset_id],
                "ref_kind": "asset",
                "ref_id": asset_id,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        return node_id

    collection_node_ids: list[str] = []
    for collection in domain_payload.get("collections", []):
        if not isinstance(collection.get("name"), str):
            continue
        collection_name = collection["name"]
        collection_node_id = f"collection:{collection_name}"
        collection_node_ids.append(collection_node_id)
        append_node(
            {
                "id": collection_node_id,
                "node_name": collection_name,
                "label": _title_case(collection_name),
                "kind": "catalog",
                "status": "converged",
                "description": "Published query-library asset collection.",
                "subtitle": f"{len(collection.get('assets', []))} assets",
                "asset_ids": [
                    asset.get("asset_id")
                    for asset in collection.get("assets", [])
                    if isinstance(asset, dict) and isinstance(asset.get("asset_id"), str)
                ],
                "ref_kind": "collection",
                "ref_id": collection_name,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )

    for asset_family in domain_payload.get("asset_families", []):
        if not isinstance(asset_family.get("name"), str):
            continue
        family_name = asset_family["name"]
        append_node(
            {
                "id": f"family:{family_name}",
                "node_name": family_name,
                "label": _title_case(family_name),
                "kind": "catalog",
                "status": _catalog_status(asset_family.get("realization_status")),
                "description": asset_family.get("description", "Published asset family."),
                "subtitle": asset_family.get("lifecycle_role", "asset family"),
                "asset_ids": [],
                "ref_kind": "asset_family",
                "ref_id": family_name,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        if family_name == "worksite_inputs":
            for collection_node_id in collection_node_ids:
                append_segment(
                    f"{collection_node_id}->{family_name}",
                    collection_node_id,
                    f"family:{family_name}",
                    label=_title_case(family_name),
                    status=_catalog_status(asset_family.get("realization_status")),
                    ref_id=family_name,
                )

    for edge_contract in domain_payload.get("edge_contracts", []):
        if not isinstance(edge_contract.get("name"), str):
            continue
        contract_name = edge_contract["name"]
        contract_status = _catalog_status(edge_contract.get("realization_status"))
        contract_node_id = f"edge_contract:{contract_name}"
        append_node(
            {
                "id": contract_node_id,
                "node_name": contract_name,
                "label": _title_case(contract_name),
                "kind": "catalog",
                "status": contract_status,
                "description": edge_contract.get("description", "Published edge contract."),
                "subtitle": edge_contract.get("work_report_contract", "edge contract"),
                "asset_ids": [],
                "ref_kind": "edge_contract",
                "ref_id": contract_name,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        for family_name in edge_contract.get("source_asset_families", []):
            append_segment(
                f"{family_name}->{contract_name}",
                f"family:{family_name}",
                contract_node_id,
                label=_title_case(contract_name),
                status=contract_status,
                ref_id=contract_name,
            )
        target_family = edge_contract.get("target_asset_family")
        if isinstance(target_family, str) and target_family:
            append_segment(
                f"{contract_name}->{target_family}",
                contract_node_id,
                f"family:{target_family}",
                label=_title_case(target_family),
                status=contract_status,
                ref_id=contract_name,
            )
        for function_id in edge_contract.get("representative_functions", []):
            if not isinstance(function_id, str):
                continue
            target_node_id = ensure_function_node(function_id) or ensure_workorder_node(function_id)
            if not target_node_id:
                continue
            append_segment(
                f"{contract_name}->{function_id}",
                contract_node_id,
                target_node_id,
                label=_title_case(function_id),
                status=contract_status,
                ref_id=contract_name,
            )

    for program in domain_payload.get("programs", []):
        if not isinstance(program.get("name"), str):
            continue
        program_name = program["name"]
        program_node_id = f"program:{program_name}"
        append_node(
            {
                "id": program_node_id,
                "node_name": program_name,
                "label": _title_case(program_name),
                "kind": "catalog",
                "status": "active",
                "description": program.get("intent", "Published executive program."),
                "subtitle": program.get("kind", "program"),
                "asset_ids": [],
                "ref_kind": "program",
                "ref_id": program_name,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        for step in program.get("steps", []):
            if not isinstance(step, str):
                continue
            target_node_id = ensure_function_node(step) or ensure_workorder_node(step)
            if not target_node_id:
                continue
            append_segment(
                f"{program_name}->{step}",
                program_node_id,
                target_node_id,
                label=_title_case(step),
                status="active",
                ref_id=program_name,
            )

    for work_act_type in domain_payload.get("work_act_types", []):
        if not isinstance(work_act_type.get("name"), str):
            continue
        work_act_name = work_act_type["name"]
        work_act_status = _catalog_status(work_act_type.get("realization_status"))
        work_act_node_id = f"work_act:{work_act_name}"
        append_node(
            {
                "id": work_act_node_id,
                "node_name": work_act_name,
                "label": _title_case(work_act_name),
                "kind": "catalog",
                "status": work_act_status,
                "description": work_act_type.get("description", "Published work-act type."),
                "subtitle": (
                    "mutates workspace"
                    if work_act_type.get("mutates_workspace")
                    else "non-mutating work"
                ),
                "asset_ids": [],
                "ref_kind": "work_act_type",
                "ref_id": work_act_name,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        for family_name in work_act_type.get("typical_asset_families", []):
            append_segment(
                f"{work_act_name}->{family_name}",
                work_act_node_id,
                f"family:{family_name}",
                label=_title_case(family_name),
                status=work_act_status,
                ref_id=work_act_name,
            )

    ambiguity_register = domain_payload.get("ambiguity_register", {})
    for entry in ambiguity_register.get("ambiguities", []):
        if not isinstance(entry, dict):
            continue
        ambiguity_id = entry.get("ambiguity_id")
        if not isinstance(ambiguity_id, str) or not ambiguity_id:
            continue
        ambiguity_status = _ambiguity_status(entry)
        ambiguity_node_id = f"ambiguity:{ambiguity_id}"
        append_node(
            {
                "id": ambiguity_node_id,
                "node_name": ambiguity_id,
                "label": _title_case(ambiguity_id),
                "kind": "governance",
                "status": ambiguity_status,
                "description": entry.get("operator_headline", entry.get("description", "Published ambiguity entry.")),
                "subtitle": str(entry.get("governance_posture") or "ambiguity"),
                "asset_ids": [
                    asset_id
                    for asset_id in entry.get("affected_assets", [])
                    if isinstance(asset_id, str) and asset_id in assets_by_id
                ],
                "ref_kind": "ambiguity",
                "ref_id": ambiguity_id,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )
        for asset_id in entry.get("affected_assets", []):
            if not isinstance(asset_id, str):
                continue
            asset_node_id = ensure_asset_node(asset_id)
            if not asset_node_id:
                continue
            append_segment(
                f"{asset_id}->{ambiguity_id}",
                asset_node_id,
                ambiguity_node_id,
                label=_title_case(ambiguity_id),
                status=ambiguity_status,
                ref_id=ambiguity_id,
            )
        resolving_edge = entry.get("expected_resolving_edge")
        if isinstance(resolving_edge, str) and resolving_edge:
            target_node_id = ensure_function_node(resolving_edge) or ensure_workorder_node(resolving_edge)
            if target_node_id:
                append_segment(
                    f"{ambiguity_id}->{resolving_edge}",
                    ambiguity_node_id,
                    target_node_id,
                    label=_title_case(resolving_edge),
                    status=ambiguity_status,
                    ref_id=ambiguity_id,
                )

    if not nodes:
        return None

    graph_status = _dominant_status([node["status"] for node in nodes])
    return {
        "id": "graph.builder_governance",
        "label": "Builder Governance Graph",
        "status": graph_status,
        "derivation": "query-domain builder catalog, executive program, and ambiguity-register overlays",
        "nodes": nodes,
        "segments": segments,
    }


def _project_graph_set(
    domain_payload: dict[str, Any],
    functions: list[dict[str, Any]],
    workorders: list[dict[str, Any]],
) -> dict[str, Any]:
    assets = domain_payload.get("assets", [])
    asset_types = domain_payload.get("asset_types", [])
    bindings = domain_payload.get("bindings", [])
    assets_by_id = {asset["asset_id"]: asset for asset in assets}
    asset_types_by_name = {asset_type["name"]: asset_type for asset_type in asset_types}
    bindings_by_node = {binding["node"]: binding for binding in bindings}

    node_names: set[str] = set(bindings_by_node)
    for function in functions:
        node_names.update(function["inputs"])
        node_names.update(function["outputs"])

    node_status_map: dict[str, str] = {}
    for node_name in sorted(node_names):
        binding = bindings_by_node.get(node_name)
        asset_ids = list(binding["asset_ids"]) if binding else []
        bound_assets = [assets_by_id[asset_id] for asset_id in asset_ids if asset_id in assets_by_id]
        related_workorder_statuses = [
            function["status"]
            for function in functions
            if node_name in function["inputs"] or node_name in function["outputs"]
        ]
        if any(asset.get("metadata", {}).get("exists") == "false" for asset in bound_assets):
            status = "blocked"
        elif node_name == "input_set":
            status = "converged"
        elif related_workorder_statuses:
            status = _dominant_status(related_workorder_statuses)
        else:
            status = "pending"
        node_status_map[node_name] = status

    graph_nodes: list[dict[str, Any]] = []
    for node_name in sorted(node_names):
        binding = bindings_by_node.get(node_name)
        asset_ids = list(binding["asset_ids"]) if binding else []
        primary_asset = assets_by_id.get(asset_ids[0]) if len(asset_ids) == 1 else None
        primary_type = (
            asset_types_by_name.get(primary_asset["declared_type"])
            if primary_asset is not None
            else None
        )
        if node_name == "input_set":
            description = "Bound bootstrap asset scope for the current workspace."
            subtitle = "asset collection"
            ref_kind = "binding"
            ref_id = node_name
        elif primary_type is not None:
            description = primary_type.get(
                "fp_descriptive_framing",
                primary_type.get("description", "Typed asset node."),
            )
            subtitle = primary_asset["declared_type"]
            ref_kind = "asset"
            ref_id = primary_asset["asset_id"]
        else:
            description = "Typed asset node with explicit bindings."
            subtitle = "typed asset node"
            ref_kind = "binding"
            ref_id = node_name
        graph_nodes.append(
            {
                "id": f"node:{node_name}",
                "node_name": node_name,
                "label": _title_case(node_name),
                "kind": "asset_node",
                "status": node_status_map[node_name],
                "description": description,
                "subtitle": subtitle,
                "asset_ids": asset_ids,
                "ref_kind": ref_kind,
                "ref_id": ref_id,
                "input_node_ids": [],
                "output_node_ids": [],
            }
        )

    for function in functions:
        graph_nodes.append(
            {
                "id": f"function:{function['id']}",
                "node_name": function["id"],
                "label": function["label"],
                "kind": "function",
                "status": function["status"],
                "description": function["intent"],
                "subtitle": function["backing_graph_function"],
                "asset_ids": [],
                "ref_kind": "function",
                "ref_id": function["id"],
                "input_node_ids": [f"node:{item}" for item in function["inputs"]],
                "output_node_ids": [f"node:{item}" for item in function["outputs"]],
            }
        )

    graph_segments: list[dict[str, Any]] = []
    for function in functions:
        function_node_id = f"function:{function['id']}"
        for input_node in function["inputs"]:
            graph_segments.append(
                {
                    "id": f"{input_node}->{function['id']}",
                    "from": f"node:{input_node}",
                    "to": function_node_id,
                    "label": function["label"],
                    "status": function["status"],
                    "ref_id": function["id"],
                }
            )
        for output_node in function["outputs"]:
            graph_segments.append(
                {
                    "id": f"{function['id']}->{output_node}",
                    "from": function_node_id,
                    "to": f"node:{output_node}",
                    "label": _title_case(output_node),
                    "status": function["status"],
                    "ref_id": function["id"],
                }
            )

    bootstrap_status = _dominant_status([node["status"] for node in graph_nodes])
    graphs: list[dict[str, Any]] = [
        {
            "id": "graph.bootstrap",
            "label": "Process Flow Map",
            "status": bootstrap_status,
            "derivation": "descriptive function catalog inputs and outputs plus explicit bindings",
            "nodes": graph_nodes,
            "segments": graph_segments,
        }
    ]
    requirement_graph = _project_requirement_traceability_graph(
        domain_payload,
        workorders,
    )
    if requirement_graph is not None:
        graphs.append(requirement_graph)
    builder_graph = _project_builder_governance_graph(domain_payload, functions, workorders)
    if builder_graph is not None:
        graphs.append(builder_graph)
    graph_status = _dominant_status([graph["status"] for graph in graphs])
    return {
        "id": "graphset.workspace",
        "label": "Workspace Graph Set",
        "status": graph_status,
        "graphs": graphs,
    }


def _compose_world(workspace_root: Path) -> dict[str, Any]:
    app = _load_app(workspace_root)
    raw_domain_payload = _query_domain_payload(app)
    events = app.stream.all_events()
    runtime_payload = _project_runtime(events)
    graph_functions = raw_domain_payload.get("graph_functions", [])
    functions = _project_functions(
        raw_domain_payload.get("functions", []),
        graph_functions,
        raw_domain_payload.get("gaps", {}),
        runtime_payload,
    )
    workorders = _project_workorders(
        raw_domain_payload.get("jobs", []),
        graph_functions,
        raw_domain_payload.get("gaps", {}),
        runtime_payload,
    )
    graph_function_registry = _project_graph_functions(graph_functions, workorders)
    domain_payload = _domain_projection(
        workspace_root,
        raw_domain_payload,
        functions=functions,
        graph_functions=graph_function_registry,
        workorders=workorders,
    )
    graph_set = _project_graph_set(
        domain_payload,
        functions,
        workorders,
    )

    active_runs = sum(
        1
        for run in runtime_payload["runs"]
        if run.get("status") in {"queued", "pending", "started", "dispatched"}
    )
    open_continuations = sum(
        1
        for continuation in runtime_payload["continuations"]
        if continuation.get("status") == "open"
    )
    total_gaps = len(domain_payload["gaps"].get("gaps", []))
    total_delta = float(domain_payload["gaps"].get("total_delta", 0))
    ambiguity_counts = _ambiguity_summary_counts(domain_payload["ambiguity_register"])
    workorder_status = _dominant_status([workorder["status"] for workorder in workorders])
    overview_status = _dominant_status([graph_set["status"], workorder_status])

    if ambiguity_counts["blocking"] > 0 or ambiguity_counts["hard_stop"] > 0:
        headline = "Published builder ambiguity currently hard-blocks one or more edges."
    elif ambiguity_counts["fh_required"] > 0:
        headline = "Published builder ambiguity currently requires F_H resolution."
    elif ambiguity_counts["pending_capability"] > 0:
        headline = "Capability-gated builder stages remain pending declaration or ratification."
    elif workorder_status == "blocked":
        headline = "One or more published workorders are fail-closed."
    elif workorder_status == "gated":
        headline = "Open continuations require review or correction."
    elif workorder_status == "active":
        headline = "ABG is currently carrying active runtime work."
    elif total_delta == 0 and open_continuations == 0:
        headline = "Published workorders are currently converged."
    else:
        headline = "Descriptive domain gaps remain open across the current graph set."

    return {
        "workspace_root": str(workspace_root),
        "generated_at": _now_iso(),
        "boundary": {
            "runtime_source": "abg_event_model",
            "runtime_aggregate_provider": "abg_projectors",
            "domain_source": "odd_method_query_library",
            "graph_derivation": "descriptive function catalog inputs and outputs plus explicit bindings",
            "query_cadence": "on_demand",
        },
        "overview": {
            "status": overview_status,
            "headline": headline,
            "summary": "odd_manager composes ABG-native runtime projections with odd_method query overlays without introducing a shadow runtime.",
            "total_delta": total_delta,
            "total_assets": len(domain_payload["assets"]),
            "total_workorders": len(workorders),
            "total_gaps": total_gaps,
            "active_runs": active_runs,
            "open_continuations": open_continuations,
            "latest_event_time": runtime_payload["latest_event_time"],
        },
        "graph_set": graph_set,
        "domain": domain_payload,
        "runtime": runtime_payload,
    }


def _read_surface(workspace_root: Path, relative_path: str) -> dict[str, Any]:
    root = workspace_root.resolve()
    target = (root / relative_path).resolve()
    target.relative_to(root)
    if not target.exists():
        return {
            "kind": "missing",
            "relative_path": relative_path,
            "path": str(target),
        }
    if target.is_dir():
        entries = []
        for child in sorted(target.iterdir(), key=lambda item: item.name):
            try:
                child_relative = child.relative_to(root).as_posix()
            except ValueError:
                continue
            entries.append(
                {
                    "name": child.name,
                    "kind": "directory" if child.is_dir() else "file",
                    "relative_path": child_relative,
                }
            )
        return {
            "kind": "directory",
            "relative_path": relative_path,
            "path": str(target),
            "entries": entries[:200],
            "truncated": len(entries) > 200,
        }
    return {
        "kind": "file",
        "relative_path": relative_path,
        "path": str(target),
        "content": target.read_text(encoding="utf-8", errors="replace"),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="odd_manager_world")
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--workspace", default=".")

    subparsers.add_parser("world", parents=[common])

    surface_parser = subparsers.add_parser("surface", parents=[common])
    surface_parser.add_argument("--relative-path", required=True)

    command_parser = subparsers.add_parser("command", parents=[common])
    command_parser.add_argument("name", choices=("gaps", "iterate", "start"))
    command_parser.add_argument("--auto", action="store_true")

    args = parser.parse_args(argv)
    workspace_root = Path(args.workspace).resolve()

    if args.command == "world":
        try:
            result = _compose_world(workspace_root)
        except Exception as error:  # pragma: no cover - degraded fallback
            print(traceback.format_exc(), file=sys.stderr, end="")
            result = _degraded_world(workspace_root, error)
    elif args.command == "surface":
        result = _read_surface(workspace_root, args.relative_path)
    else:
        app = _load_app(workspace_root)
        from odd_sdlc.app import gaps, iterate, start

        if args.name == "gaps":
            result = gaps(app)
        elif args.name == "iterate":
            result = iterate(app)
        else:
            result = start(app, auto=args.auto)

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

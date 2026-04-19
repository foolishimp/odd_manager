# Implements: REQ-F-ODDSDLC-029
# Implements: REQ-F-ODDSDLC-030
# Implements: REQ-F-ODDSDLC-031
"""Requirement closure and generated traceability register for odd_sdlc."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Callable

from .project_profile import (
    IGNORE_ROOTS,
    SOURCE_EXTENSIONS,
    is_source_domain_repo_workspace,
    load_project_profile,
    load_published_workspace_state,
    published_analysis_is_current,
    profile_design_relative_path,
    profile_test_env_relative_path,
    profile_test_env_tests_relative_path,
)


REQUIREMENT_CLOSURE_REGISTER_KIND = "odd_sdlc.requirement_closure_register"
REQUIREMENT_CLOSURE_REGISTER_PATH = Path(".ai-workspace/runtime/odd_sdlc-requirement-closure.json")
REQUIREMENT_CLOSURE_PROMPT_CONTEXT_PATH = Path(
    ".ai-workspace/runtime/odd_sdlc-requirement-closure-context.md"
)
_REQUIREMENT_ID_RE = re.compile(r"\b(?:REQ|RF)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b")
_INTENT_ID_RE = re.compile(r"\bINT-\d{3}\b")
_GENERATED_REQUIREMENT_SURFACE_PATH = Path("specification/requirements/10-generated-bootstrap.md")
_GENERATED_TESTCASE_AUTHORITY_PATH = Path("specification/scenarios/30-generated-testcase-authority.md")
_GENERATED_TEST_RUN_ARCHIVE_PATH_NAME = "50-generated-run-archive.md"
_TESTCASE_AUTHORITY_MATRIX_PATH = Path("specification/scenarios/TESTCASE_AUTHORITY.md")
_TESTCASE_AUTHORITY_FAMILY_RE = re.compile(r"`((?:REQ|RF)-[A-Z0-9]+(?:-[A-Z0-9]+)*-\*)`")
_MARKDOWN_FILE_TOKEN_RE = re.compile(r"`([^`]+\.md)`")
_SOURCE_DOMAIN_CODE_ROOT = Path("build_tenants/python")
_COMMENT_PREFIXES = ("#", "//", "*")
_STRUCTURAL_LINE_PATTERNS = (
    re.compile(r"^(?:package|import|from|using|namespace|module|export)\b"),
    re.compile(r"^(?:public|private|protected|internal|abstract|final|sealed|open|data|case\s+class|class|trait|interface|enum|object|record)\b"),
    re.compile(r"^type\s+[A-Z0-9_]+\b", re.IGNORECASE),
)
_BEHAVIORAL_KEYWORDS = (
    "return",
    "assert",
    "raise",
    "throw",
    "if ",
    "for ",
    "while ",
    "match ",
    "yield",
    "await",
    "try",
    "catch",
    "except",
)
_REQUIREMENT_EXECUTION_ADAPTER_REF = (
    "odd_sdlc.traceability:current_requirement_executability_gap"
)
_DECLARED_REQUIREMENT_EDGE_ADAPTER_REF = (
    "odd_sdlc.traceability:declared_requirement_edge_gap"
)


def _read_text(path: Path) -> str:
    if not path.exists() or not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def _relative(path: Path, *, workspace_root: Path) -> str:
    return path.relative_to(workspace_root).as_posix()


def _collect_ids(path: Path, pattern: re.Pattern[str]) -> set[str]:
    return set(pattern.findall(_read_text(path)))


def _normalize_requirement_id(requirement_id: str) -> str:
    parts = requirement_id.upper().split("-")
    normalized = [parts[0]]
    for part in parts[1:]:
        if part.isdigit() and len(part) < 3:
            normalized.append(part.zfill(3))
        else:
            normalized.append(part)
    return "-".join(normalized)


def _is_concrete_requirement_id(requirement_id: str) -> bool:
    parts = requirement_id.upper().split("-")
    return any(any(char.isdigit() for char in part) for part in parts[1:])


def _collect_requirement_ids(path: Path) -> set[str]:
    return {
        _normalize_requirement_id(requirement_id)
        for requirement_id in _collect_ids(path, _REQUIREMENT_ID_RE)
        if _is_concrete_requirement_id(requirement_id)
    }


def _collect_requirement_statement_map(paths: tuple[Path, ...]) -> dict[str, list[str]]:
    statements: dict[str, list[str]] = {}
    for path in paths:
        for raw_line in _read_text(path).splitlines():
            stripped = raw_line.strip()
            if not stripped:
                continue
            requirement_ids = [
                _normalize_requirement_id(requirement_id)
                for requirement_id in _REQUIREMENT_ID_RE.findall(stripped)
                if _is_concrete_requirement_id(requirement_id)
            ]
            if not requirement_ids:
                continue
            for requirement_id in requirement_ids:
                current = statements.setdefault(requirement_id, [])
                if stripped not in current:
                    current.append(stripped)
    return statements


def _meaningful_source_lines(path: Path) -> list[str]:
    meaningful: list[str] = []
    in_block_comment = False
    for raw_line in _read_text(path).splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue
        if in_block_comment:
            if "*/" in stripped:
                in_block_comment = False
            continue
        if stripped.startswith("/*"):
            if "*/" not in stripped:
                in_block_comment = True
            continue
        if stripped.startswith(("'''", '"""')):
            continue
        if stripped.startswith(_COMMENT_PREFIXES):
            continue
        if stripped in {"{", "}", "(", ")", "[", "]"}:
            continue
        meaningful.append(stripped)
    return meaningful


def _is_structural_only_line(line: str) -> bool:
    normalized = line.strip()
    if not normalized:
        return True
    if normalized.endswith("{") and "=" not in normalized and "=>" not in normalized:
        normalized = normalized[:-1].strip()
    if normalized.startswith("def "):
        return "=" not in normalized
    return any(pattern.match(normalized) for pattern in _STRUCTURAL_LINE_PATTERNS)


def _has_behavioral_signal(path: Path) -> bool:
    for line in _meaningful_source_lines(path):
        if _is_structural_only_line(line):
            continue
        lowered = line.lower()
        if any(keyword in lowered for keyword in _BEHAVIORAL_KEYWORDS):
            return True
        if line.startswith("def ") and "=" in line:
            return True
        if "=" in line and not line.startswith(("val ", "var ", "let ", "const ", "type ")):
            return True
        if line.startswith(("return ", "assert ", "raise ", "throw ")):
            return True
        if line.startswith(("case ", "else", "elif ", "except ", "catch ")):
            return True
        if not line.startswith(("def ", "class ", "trait ", "interface ", "enum ", "object ", "sealed ", "final ")):
            return True
    return False


def _merge_requirement_refs(
    target: dict[str, list[str]],
    source: dict[str, list[str]],
) -> dict[str, list[str]]:
    for requirement_id, refs in source.items():
        for ref in refs:
            current = target.setdefault(requirement_id, [])
            if ref not in current:
                current.append(ref)
    return target


def _increment_count(counts: dict[str, int], key: str) -> None:
    counts[key] = counts.get(key, 0) + 1


def _unique_sequence(*groups: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for group in groups:
        for item in group:
            if item in seen:
                continue
            seen.add(item)
            merged.append(item)
    return merged


def _carry_status_for_requirement(
    *,
    in_authority: bool,
    in_current: bool,
) -> str:
    if in_authority and in_current:
        return "carried"
    if in_authority and not in_current:
        return "missing"
    if in_current and not in_authority:
        return "extra"
    return "out_of_scope"


def _fulfillment_status_for_requirement(
    *,
    fulfillment_detail: str,
    carry_status: str,
) -> str:
    if carry_status != "carried":
        return "unassessed"
    return "fulfilled" if fulfillment_detail == "fulfilled" else "not_fulfilled"


def _requirement_statements(entry: dict[str, Any]) -> list[str]:
    return list(entry.get("current_requirement_statements", ())) or list(
        entry.get("authority_statements", ())
    )


def _requirement_statement(entry: dict[str, Any]) -> str:
    return "\n".join(_requirement_statements(entry)).strip()


def _requirement_source_refs(entry: dict[str, Any]) -> list[str]:
    return _unique_sequence(
        list(entry.get("current_requirement_refs", ())),
        list(entry.get("authority_refs", ())),
    )


def _requirement_evidence_refs(entry: dict[str, Any]) -> list[str]:
    edge_refs = list(entry.get("edge_evidence_refs", ()))
    if edge_refs:
        return edge_refs
    return _unique_sequence(
        list(entry.get("implementation_design_claim_refs", ())),
        list(entry.get("implementation_module_claim_refs", ())),
        list(entry.get("implementation_claim_refs", ())),
        list(entry.get("planned_test_design_claim_refs", ())),
        list(entry.get("planned_test_module_claim_refs", ())),
        list(entry.get("planned_test_claim_refs", ())),
        list(entry.get("testcase_authority_refs", ())),
        list(entry.get("test_run_archive_refs", ())),
        list(entry.get("code_refs", ())),
        list(entry.get("behavioral_code_refs", ())),
        list(entry.get("test_refs", ())),
    )


def _build_requirement_register_entry(
    *,
    requirement_id: str,
    authority_refs: dict[str, list[str]],
    current_refs: dict[str, list[str]],
    authority_statements: dict[str, list[str]],
    current_statements: dict[str, list[str]],
    implementation_design_refs: dict[str, list[str]],
    implementation_module_refs: dict[str, list[str]],
    implementation_refs: dict[str, list[str]],
    planned_test_design_refs: dict[str, list[str]],
    planned_test_module_refs: dict[str, list[str]],
    planned_validation_refs: dict[str, list[str]],
    uat_validation_refs: dict[str, list[str]],
    test_run_archive_refs: dict[str, list[str]],
    code_refs: dict[str, list[str]],
    test_refs: dict[str, list[str]],
    workspace_root: Path,
) -> dict[str, Any]:
    in_authority = requirement_id in authority_refs
    in_current = requirement_id in current_refs
    implementation_design_files = implementation_design_refs.get(requirement_id, [])
    implementation_module_files = implementation_module_refs.get(requirement_id, [])
    implementation_files = implementation_refs.get(requirement_id, [])
    planned_test_design_files = planned_test_design_refs.get(requirement_id, [])
    planned_test_module_files = planned_test_module_refs.get(requirement_id, [])
    planned_validation_files = planned_validation_refs.get(requirement_id, [])
    uat_validation_files = uat_validation_refs.get(requirement_id, [])
    test_run_archive_files = test_run_archive_refs.get(requirement_id, [])
    code_files = code_refs.get(requirement_id, [])
    test_files = test_refs.get(requirement_id, [])
    behavioral_code_files = [
        ref for ref in code_files if _has_behavioral_signal(workspace_root / ref)
    ]
    behavioral_test_files = [
        ref for ref in test_files if _has_behavioral_signal(workspace_root / ref)
    ]
    if in_authority and not in_current:
        status = "missing_from_current_requirement_surface"
    elif code_files and test_run_archive_files:
        status = "realized"
    elif code_files or test_run_archive_files:
        status = "partially_realized"
    elif implementation_files or planned_validation_files or uat_validation_files:
        status = "planned"
    elif in_current:
        status = "specified"
    else:
        status = "unclassified"
    carry_status = _carry_status_for_requirement(
        in_authority=in_authority,
        in_current=in_current,
    )
    if behavioral_code_files and test_run_archive_files:
        fulfillment_detail = "fulfilled"
    elif behavioral_code_files:
        fulfillment_detail = "implemented_without_realized_tests"
    elif code_files:
        fulfillment_detail = "traceable_stub"
    elif implementation_files or planned_validation_files or uat_validation_files:
        fulfillment_detail = "planned"
    elif in_current:
        fulfillment_detail = "specified"
    else:
        fulfillment_detail = "unclassified"
    fulfillment_status = _fulfillment_status_for_requirement(
        fulfillment_detail=fulfillment_detail,
        carry_status=carry_status,
    )

    blocking_reasons: list[str] = []
    if in_authority and not in_current:
        blocking_reasons.append("missing_from_current_requirement_surface")
    if not code_files and implementation_files:
        blocking_reasons.append("missing_code_realization")
    if code_files and not behavioral_code_files:
        blocking_reasons.append("behavioral_realization_missing")
    if behavioral_code_files and not test_run_archive_files:
        blocking_reasons.append("missing_realized_test_evidence")

    return {
        "requirement_id": requirement_id,
        "present_in_authority": in_authority,
        "present_in_current_requirement_surface": in_current,
        "authority_refs": authority_refs.get(requirement_id, []),
        "current_requirement_refs": current_refs.get(requirement_id, []),
        "authority_statements": authority_statements.get(requirement_id, []),
        "current_requirement_statements": current_statements.get(requirement_id, []),
        "implementation_design_claim_refs": implementation_design_files,
        "implementation_module_claim_refs": implementation_module_files,
        "implementation_claim_refs": implementation_files,
        "planned_test_design_claim_refs": planned_test_design_files,
        "planned_test_module_claim_refs": planned_test_module_files,
        "planned_test_claim_refs": planned_validation_files,
        "testcase_authority_refs": uat_validation_files,
        "test_run_archive_refs": test_run_archive_files,
        "code_refs": code_files,
        "test_refs": test_files,
        "status": status,
        "carry_status": carry_status,
        "behavioral_code_refs": behavioral_code_files,
        "behavioral_test_refs": behavioral_test_files,
        "fulfillment_detail": fulfillment_detail,
        "fulfillment_status": fulfillment_status,
        "blocking_reasons": blocking_reasons,
    }


def _build_requirement_obligation_view(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(entry["requirement_id"]),
        "kind": "requirement",
        "statement": _requirement_statement(entry),
        "source_refs": _requirement_source_refs(entry),
        "evidence_refs": _requirement_evidence_refs(entry),
        "traceability_status": str(entry["status"]),
        "carry_status": str(entry.get("carry_status") or "out_of_scope"),
        "fulfillment_status": str(entry.get("fulfillment_status") or "unassessed"),
        "fulfillment_detail": str(entry.get("fulfillment_detail") or "unassessed"),
        "blocking_reasons": list(entry.get("blocking_reasons", ())),
        "code_refs": list(entry.get("code_refs", ())),
        "behavioral_code_refs": list(entry.get("behavioral_code_refs", ())),
        "test_run_archive_refs": list(entry.get("test_run_archive_refs", ())),
        "test_refs": list(entry.get("test_refs", ())),
    }


def _build_requirement_blocking_view(
    entry: dict[str, Any],
    *,
    status: str | None = None,
    carry_status: str | None = None,
    fulfillment_status: str | None = None,
    blocking_reasons: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": str(entry["requirement_id"]),
        "kind": "requirement",
        "statement": _requirement_statement(entry),
        "source_refs": _requirement_source_refs(entry),
        "evidence_refs": _requirement_evidence_refs(entry),
        "diagnostic_status": status or str(entry["status"]),
        "carry_status": carry_status or str(entry.get("carry_status") or "out_of_scope"),
        "fulfillment_status": fulfillment_status or str(entry.get("fulfillment_status") or "unassessed"),
        "fulfillment_detail": str(entry.get("fulfillment_detail") or "unassessed"),
        "code_refs": list(entry.get("code_refs", ())),
        "behavioral_code_refs": list(entry.get("behavioral_code_refs", ())),
        "test_refs": list(entry.get("test_refs", ())),
        "implementation_claim_refs": list(entry.get("implementation_claim_refs", ())),
        "planned_test_claim_refs": list(entry.get("planned_test_claim_refs", ())),
        "blocking_reasons": list(blocking_reasons or entry.get("blocking_reasons", ())),
    }


def _build_edge_obligation_ledger(
    *,
    obligation_kind: str,
    obligation_source_ref: str,
    obligation_source_kind: str,
    obligation_source_admission_basis: str,
    derivation_rule: str,
    expected_entries: list[dict[str, Any]],
    extra_entries: list[dict[str, Any]],
    obligation_id_getter: Callable[[dict[str, Any]], str],
    obligation_builder: Callable[[dict[str, Any]], dict[str, Any]],
    blocking_builder: Callable[[dict[str, Any]], dict[str, Any]],
    extra_blocking_builder: Callable[[dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    def _published_obligation_id(item: dict[str, Any]) -> str:
        published_id = item.get("id")
        if isinstance(published_id, str) and published_id:
            return published_id
        return obligation_id_getter(item)

    blocking_obligations: list[dict[str, Any]] = []
    blocking_status_counts: dict[str, int] = {}
    carry_counts: dict[str, int] = {}
    fulfillment_detail_counts: dict[str, int] = {}
    fulfillment_counts: dict[str, int] = {}
    obligations: list[dict[str, Any]] = []

    for entry in expected_entries:
        status = str(entry["status"])
        carry_status = str(entry.get("carry_status") or "out_of_scope")
        fulfillment_status = str(entry.get("fulfillment_status") or "unassessed")
        fulfillment_detail = str(entry.get("fulfillment_detail") or fulfillment_status)
        _increment_count(carry_counts, carry_status)
        _increment_count(fulfillment_detail_counts, fulfillment_detail)
        _increment_count(fulfillment_counts, fulfillment_status)
        obligations.append(obligation_builder(entry))
        if carry_status == "carried" and fulfillment_status == "fulfilled":
            continue
        _increment_count(blocking_status_counts, status)
        blocking_obligations.append(blocking_builder(entry))

    extra_obligation_ids: list[str] = []
    for entry in extra_entries:
        requirement_id = obligation_id_getter(entry)
        extra_obligation_ids.append(requirement_id)
        _increment_count(carry_counts, "extra")
        fulfillment_status = str(entry.get("fulfillment_status") or "unassessed")
        fulfillment_detail = str(entry.get("fulfillment_detail") or fulfillment_status)
        _increment_count(fulfillment_detail_counts, fulfillment_detail)
        _increment_count(fulfillment_counts, fulfillment_status)
        _increment_count(blocking_status_counts, "extra")
        blocking_obligations.append(extra_blocking_builder(entry))

    expected_count = len(expected_entries)
    carried_count = sum(
        1 for entry in expected_entries if str(entry.get("carry_status") or "") == "carried"
    )
    fulfilled_count = sum(
        1
        for entry in expected_entries
        if str(entry.get("carry_status") or "") == "carried"
        and str(entry.get("fulfillment_status") or "") == "fulfilled"
    )
    missing_count = sum(
        1 for entry in expected_entries if str(entry.get("carry_status") or "") == "missing"
    )
    extra_count = len(extra_entries)
    unfulfilled_count = sum(
        1
        for entry in expected_entries
        if str(entry.get("carry_status") or "") == "carried"
        and str(entry.get("fulfillment_status") or "") != "fulfilled"
    )
    partial_count = unfulfilled_count
    blocking_count = len(blocking_obligations)
    carry_converged = missing_count == 0 and extra_count == 0
    fulfillment_converged = unfulfilled_count == 0
    edge_converged = carry_converged and fulfillment_converged
    carry_delta = 0.0 if expected_count == 0 else (missing_count + extra_count) / expected_count
    fulfillment_delta = 0.0 if carried_count == 0 else unfulfilled_count / carried_count
    combined_delta = max(carry_delta, fulfillment_delta)
    blocking_reasons = sorted(
        {
            reason
            for item in blocking_obligations
            for reason in item.get("blocking_reasons", ())
        }
    )

    return {
        "obligation_kind": obligation_kind,
        "obligation_source_ref": obligation_source_ref,
        "obligation_source_kind": obligation_source_kind,
        "obligation_source_admission_basis": obligation_source_admission_basis,
        "derivation_rule": derivation_rule,
        "edge_converged": edge_converged,
        "carry_converged": carry_converged,
        "fulfillment_converged": fulfillment_converged,
        "combined_delta": combined_delta,
        "carry_delta": carry_delta,
        "fulfillment_delta": fulfillment_delta,
        "expected_count": expected_count,
        "carried_count": carried_count,
        "fulfilled_count": fulfilled_count,
        "partial_count": partial_count,
        "missing_count": missing_count,
        "extra_count": extra_count,
        "unfulfilled_count": unfulfilled_count,
        "blocking_count": blocking_count,
        "blocking_reasons": blocking_reasons,
        "blocking_obligation_ids": [
            _published_obligation_id(item) for item in blocking_obligations
        ],
        "extra_obligation_ids": extra_obligation_ids,
        "blocking_status_counts": blocking_status_counts,
        "carry_counts": carry_counts,
        "fulfillment_detail_counts": fulfillment_detail_counts,
        "fulfillment_counts": fulfillment_counts,
        "obligations": obligations,
        "blocking_obligations": blocking_obligations,
    }


def _authority_requirement_paths(workspace_root: Path) -> tuple[Path, ...]:
    spec_root = workspace_root / "specification"
    req_root = spec_root / "requirements"
    candidates: list[Path] = []
    if req_root.exists():
        for path in sorted(req_root.rglob("*.md")):
            if path.name == "10-generated-bootstrap.md":
                continue
            if path.name.startswith("00-"):
                continue
            candidates.append(path)
    for path in sorted(spec_root.glob("*.md")):
        if path.name in {"INTENT.md", "PRODUCT.md", "GOALS.md"}:
            continue
        if "requirement" not in path.name.lower():
            continue
        if path not in candidates:
            candidates.append(path)
    return tuple(candidates)


def _current_requirement_paths(workspace_root: Path) -> tuple[Path, ...]:
    generated = workspace_root / _GENERATED_REQUIREMENT_SURFACE_PATH
    if generated.exists():
        return (generated,)
    return _authority_requirement_paths(workspace_root)


def authority_requirement_refs(workspace_root: Path) -> dict[str, list[str]]:
    refs: dict[str, list[str]] = {}
    for path in _authority_requirement_paths(workspace_root):
        for requirement_id in sorted(_collect_requirement_ids(path)):
            refs.setdefault(requirement_id, []).append(_relative(path, workspace_root=workspace_root))
    return refs


def current_requirement_refs(workspace_root: Path) -> dict[str, list[str]]:
    refs: dict[str, list[str]] = {}
    for path in _current_requirement_paths(workspace_root):
        for requirement_id in sorted(_collect_requirement_ids(path)):
            refs.setdefault(requirement_id, []).append(_relative(path, workspace_root=workspace_root))
    return refs


def missing_requirement_ids_from_current_surface(workspace_root: Path) -> tuple[str, ...]:
    authority_ids = set(authority_requirement_refs(workspace_root))
    current_ids = set(current_requirement_refs(workspace_root))
    return tuple(sorted(authority_ids - current_ids))


def missing_intent_ids_from_goals(workspace_root: Path) -> tuple[str, ...]:
    intent_ids = _collect_ids(workspace_root / "specification/INTENT.md", _INTENT_ID_RE)
    goal_ids = _collect_ids(workspace_root / "specification/GOALS.md", _INTENT_ID_RE)
    return tuple(sorted(intent_ids - goal_ids))


def _surface_requirement_refs(workspace_root: Path, relative_paths: tuple[Path, ...]) -> dict[str, list[str]]:
    refs: dict[str, list[str]] = {}
    for relative_path in relative_paths:
        path = workspace_root / relative_path
        if not path.exists():
            continue
        rel = relative_path.as_posix()
        for requirement_id in sorted(_collect_requirement_ids(path)):
            refs.setdefault(requirement_id, []).append(rel)
    return refs


def _written_testcase_authority_paths(workspace_root: Path) -> tuple[Path, ...]:
    scenarios_root = workspace_root / "specification" / "scenarios"
    if not scenarios_root.exists():
        return ()
    paths: list[Path] = []
    for path in sorted(scenarios_root.glob("*.md")):
        if path.name == "20-generated-uat-testcases.md":
            continue
        relative = path.relative_to(workspace_root)
        if relative == _TESTCASE_AUTHORITY_MATRIX_PATH:
            continue
        paths.append(relative)
    return tuple(paths)


def _matrix_testcase_authority_refs(workspace_root: Path) -> dict[str, list[str]]:
    path = workspace_root / _TESTCASE_AUTHORITY_MATRIX_PATH
    if not path.exists():
        return {}
    live_requirement_ids = set(authority_requirement_refs(workspace_root)) | set(current_requirement_refs(workspace_root))
    refs: dict[str, list[str]] = {}
    for line in _read_text(path).splitlines():
        family_match = _TESTCASE_AUTHORITY_FAMILY_RE.search(line)
        if family_match is None:
            continue
        family_pattern = family_match.group(1)
        family_prefix = family_pattern[:-1]
        supporting_paths = [
            Path("specification/scenarios") / token
            for token in _MARKDOWN_FILE_TOKEN_RE.findall(line)
        ]
        authority_refs = [_TESTCASE_AUTHORITY_MATRIX_PATH.as_posix(), *[item.as_posix() for item in supporting_paths]]
        for requirement_id in sorted(req_id for req_id in live_requirement_ids if req_id.startswith(family_prefix)):
            current = refs.setdefault(requirement_id, [])
            for ref in authority_refs:
                if ref not in current:
                    current.append(ref)
    return refs


def _implementation_trace_paths(workspace_root: Path) -> tuple[Path, ...]:
    return (
        *_implementation_design_trace_paths(workspace_root),
        *_implementation_module_trace_paths(workspace_root),
    )


def _implementation_design_trace_paths(workspace_root: Path) -> tuple[Path, ...]:
    profile = load_project_profile(workspace_root)
    return (
        Path(profile_design_relative_path(profile, "40-generated-implementation-design.md")),
    )


def _implementation_module_trace_paths(workspace_root: Path) -> tuple[Path, ...]:
    profile = load_project_profile(workspace_root)
    return (
        Path(profile_design_relative_path(profile, "40-generated-implementation-modules.md")),
    )


def _planned_test_trace_paths(workspace_root: Path) -> tuple[Path, ...]:
    return (
        *_planned_test_design_trace_paths(workspace_root),
        *_planned_test_module_trace_paths(workspace_root),
    )


def _planned_test_design_trace_paths(workspace_root: Path) -> tuple[Path, ...]:
    profile = load_project_profile(workspace_root)
    return (
        Path(profile_design_relative_path(profile, "40-generated-test-design.md")),
    )


def _planned_test_module_trace_paths(workspace_root: Path) -> tuple[Path, ...]:
    profile = load_project_profile(workspace_root)
    return (
        Path(profile_test_env_tests_relative_path(profile, "40-generated-test-modules.md")),
    )


def _test_run_archive_trace_paths(workspace_root: Path) -> tuple[Path, ...]:
    profile = load_project_profile(workspace_root)
    return (
        Path(profile_test_env_relative_path(profile, _GENERATED_TEST_RUN_ARCHIVE_PATH_NAME)),
    )


def implementation_design_claim_refs(workspace_root: Path) -> dict[str, list[str]]:
    return _surface_requirement_refs(workspace_root, _implementation_design_trace_paths(workspace_root))


def implementation_module_claim_refs(workspace_root: Path) -> dict[str, list[str]]:
    return _surface_requirement_refs(workspace_root, _implementation_module_trace_paths(workspace_root))


def implementation_claim_refs(workspace_root: Path) -> dict[str, list[str]]:
    return _surface_requirement_refs(workspace_root, _implementation_trace_paths(workspace_root))


def planned_test_design_claim_refs(workspace_root: Path) -> dict[str, list[str]]:
    return _surface_requirement_refs(workspace_root, _planned_test_design_trace_paths(workspace_root))


def planned_test_module_claim_refs(workspace_root: Path) -> dict[str, list[str]]:
    return _surface_requirement_refs(workspace_root, _planned_test_module_trace_paths(workspace_root))


def planned_test_claim_refs(workspace_root: Path) -> dict[str, list[str]]:
    return _surface_requirement_refs(workspace_root, _planned_test_trace_paths(workspace_root))


def testcase_authority_refs(workspace_root: Path) -> dict[str, list[str]]:
    refs: dict[str, list[str]] = {}
    _merge_requirement_refs(
        refs,
        _surface_requirement_refs(
            workspace_root,
            (
                _GENERATED_TESTCASE_AUTHORITY_PATH,
                *_written_testcase_authority_paths(workspace_root),
            ),
        ),
    )
    _merge_requirement_refs(refs, _matrix_testcase_authority_refs(workspace_root))
    return refs


def test_run_archive_refs(workspace_root: Path) -> dict[str, list[str]]:
    return _surface_requirement_refs(workspace_root, _test_run_archive_trace_paths(workspace_root))


def _is_source_file(path: Path, *, code_root: Path) -> bool:
    relative_parts = path.relative_to(code_root).parts
    return (
        path.suffix in SOURCE_EXTENSIONS
        and not any(part in IGNORE_ROOTS for part in relative_parts)
        and "target" not in {part.lower() for part in relative_parts}
    )


def _is_test_file(path: Path, *, code_root: Path) -> bool:
    relative_parts = [part.lower() for part in path.relative_to(code_root).parts]
    name = path.name.lower()
    under_main_source = len(relative_parts) >= 2 and relative_parts[0] == "src" and relative_parts[1] == "main"
    return (
        "test" in relative_parts
        or "tests" in relative_parts
        or name.startswith("test_")
        or (
            (name.endswith("spec.scala") or name.endswith("test.scala"))
            and not under_main_source
        )
    )


def _tagged_requirement_ids(path: Path, *, tag: str) -> set[str]:
    ids: set[str] = set()
    for line in _read_text(path).splitlines():
        if tag not in line:
            continue
        ids.update(
            _normalize_requirement_id(requirement_id)
            for requirement_id in _REQUIREMENT_ID_RE.findall(line)
            if _is_concrete_requirement_id(requirement_id)
        )
    return ids


def _workspace_mode(workspace_root: Path) -> str | None:
    published = load_published_workspace_state(workspace_root)
    if isinstance(published, dict):
        workspace_mode = published.get("workspace_mode")
        if isinstance(workspace_mode, str) and workspace_mode:
            return workspace_mode
    if is_source_domain_repo_workspace(workspace_root):
        return "source_domain_repo"
    return None


def _traceability_code_root_relative_path(workspace_root: Path) -> str:
    if _workspace_mode(workspace_root) == "source_domain_repo":
        source_domain_root = workspace_root / _SOURCE_DOMAIN_CODE_ROOT / "code" / "odd_sdlc"
        if source_domain_root.exists():
            return _SOURCE_DOMAIN_CODE_ROOT.as_posix()
    profile = load_project_profile(workspace_root)
    return profile.code_relative_path()


def traceability_scan(workspace_root: Path) -> dict[str, Any]:
    code_root_relative_path = _traceability_code_root_relative_path(workspace_root)
    code_root = workspace_root / code_root_relative_path
    code_refs: dict[str, list[str]] = {}
    test_refs: dict[str, list[str]] = {}
    orphan_code_files: list[str] = []
    orphan_test_files: list[str] = []
    code_file_count = 0
    test_file_count = 0

    if not code_root.exists() or not code_root.is_dir():
        return {
            "code_root": _relative(code_root, workspace_root=workspace_root)
            if code_root.is_relative_to(workspace_root)
            else code_root_relative_path,
            "code_refs": {},
            "test_refs": {},
            "orphan_code_files": [],
            "orphan_test_files": [],
            "code_file_count": 0,
            "test_file_count": 0,
        }

    for path in sorted(item for item in code_root.rglob("*") if item.is_file() and _is_source_file(item, code_root=code_root)):
        rel = _relative(path, workspace_root=workspace_root)
        if _is_test_file(path, code_root=code_root):
            test_file_count += 1
            ids = _tagged_requirement_ids(path, tag="Validates:")
            if not ids:
                orphan_test_files.append(rel)
            for requirement_id in sorted(ids):
                test_refs.setdefault(requirement_id, []).append(rel)
            continue
        code_file_count += 1
        ids = _tagged_requirement_ids(path, tag="Implements:")
        if not ids:
            orphan_code_files.append(rel)
        for requirement_id in sorted(ids):
            code_refs.setdefault(requirement_id, []).append(rel)

    return {
        "code_root": _relative(code_root, workspace_root=workspace_root),
        "code_refs": code_refs,
        "test_refs": test_refs,
        "orphan_code_files": orphan_code_files,
        "orphan_test_files": orphan_test_files,
        "code_file_count": code_file_count,
        "test_file_count": test_file_count,
    }


def missing_code_traceability_ids(workspace_root: Path) -> tuple[str, ...]:
    expected_ids = _expected_implementation_code_requirement_ids(workspace_root)
    if not expected_ids:
        return ()
    code_refs = traceability_scan(workspace_root)["code_refs"]
    return tuple(sorted(requirement_id for requirement_id in expected_ids if requirement_id not in code_refs))


def missing_planned_test_traceability_ids(workspace_root: Path) -> tuple[str, ...]:
    expected_ids = _expected_validation_design_requirement_ids(workspace_root)
    if not expected_ids:
        return ()
    claimed_ids = set(planned_test_claim_refs(workspace_root))
    return tuple(sorted(expected_ids - claimed_ids))


def missing_realized_test_traceability_ids(workspace_root: Path) -> tuple[str, ...]:
    expected_ids = _expected_realized_validation_requirement_ids(workspace_root)
    if not expected_ids:
        return ()
    realized_ids = set(test_run_archive_refs(workspace_root))
    return tuple(sorted(expected_ids - realized_ids))


def missing_test_traceability_ids(workspace_root: Path) -> tuple[str, ...]:
    return missing_realized_test_traceability_ids(workspace_root)


def unexpected_planned_test_traceability_ids(workspace_root: Path) -> tuple[str, ...]:
    expected_ids = _expected_validation_design_requirement_ids(workspace_root)
    claimed_ids = set(planned_test_claim_refs(workspace_root))
    return tuple(sorted(claimed_ids - expected_ids))


def unexpected_realized_test_traceability_ids(workspace_root: Path) -> tuple[str, ...]:
    expected_ids = _expected_realized_validation_requirement_ids(workspace_root)
    realized_ids = set(test_run_archive_refs(workspace_root))
    return tuple(sorted(realized_ids - expected_ids))


def _expected_validation_design_requirement_ids(workspace_root: Path) -> set[str]:
    return set(current_requirement_refs(workspace_root))


def _expected_validation_module_requirement_ids(workspace_root: Path) -> set[str]:
    planned_test_design_ids = set(planned_test_design_claim_refs(workspace_root))
    if planned_test_design_ids:
        return planned_test_design_ids
    return _expected_validation_design_requirement_ids(workspace_root)


def _expected_validation_authority_requirement_ids(workspace_root: Path) -> set[str]:
    planned_test_module_ids = set(planned_test_module_claim_refs(workspace_root))
    if planned_test_module_ids:
        return planned_test_module_ids
    return _expected_validation_module_requirement_ids(workspace_root)


def _expected_realized_validation_requirement_ids(workspace_root: Path) -> set[str]:
    testcase_authority_ids = set(testcase_authority_refs(workspace_root))
    if testcase_authority_ids:
        return testcase_authority_ids
    return _expected_validation_authority_requirement_ids(workspace_root)


def _expected_implementation_design_requirement_ids(workspace_root: Path) -> set[str]:
    return set(current_requirement_refs(workspace_root))


def _expected_implementation_module_requirement_ids(workspace_root: Path) -> set[str]:
    implementation_design_ids = set(implementation_design_claim_refs(workspace_root))
    if implementation_design_ids:
        return implementation_design_ids
    return _expected_implementation_design_requirement_ids(workspace_root)


def _expected_implementation_code_requirement_ids(workspace_root: Path) -> set[str]:
    implementation_module_ids = set(implementation_module_claim_refs(workspace_root))
    if implementation_module_ids:
        return implementation_module_ids
    return _expected_implementation_module_requirement_ids(workspace_root)


def build_requirement_closure_register(workspace_root: Path, *, stage: str = "workspace_scan") -> dict[str, Any]:
    authority_refs = authority_requirement_refs(workspace_root)
    current_refs = current_requirement_refs(workspace_root)
    authority_statements = _collect_requirement_statement_map(_authority_requirement_paths(workspace_root))
    current_statements = _collect_requirement_statement_map(_current_requirement_paths(workspace_root))
    implementation_design_refs = implementation_design_claim_refs(workspace_root)
    implementation_module_refs = implementation_module_claim_refs(workspace_root)
    implementation_refs = _merge_requirement_refs({}, implementation_design_refs)
    _merge_requirement_refs(implementation_refs, implementation_module_refs)
    planned_test_design_refs = planned_test_design_claim_refs(workspace_root)
    planned_test_module_refs = planned_test_module_claim_refs(workspace_root)
    planned_validation_refs = _merge_requirement_refs({}, planned_test_design_refs)
    _merge_requirement_refs(planned_validation_refs, planned_test_module_refs)
    uat_validation_refs = testcase_authority_refs(workspace_root)
    run_archive_refs = test_run_archive_refs(workspace_root)
    scan = traceability_scan(workspace_root)
    code_refs = scan["code_refs"]
    test_refs = scan["test_refs"]

    all_ids = sorted(
        set(authority_refs)
        | set(current_refs)
        | set(implementation_refs)
        | set(planned_validation_refs)
        | set(uat_validation_refs)
        | set(run_archive_refs)
        | set(code_refs)
        | set(test_refs)
    )
    requirements: list[dict[str, Any]] = []
    status_counts: dict[str, int] = {}
    fulfillment_detail_counts: dict[str, int] = {}
    carry_counts: dict[str, int] = {}
    fulfillment_counts: dict[str, int] = {}

    for requirement_id in all_ids:
        entry = _build_requirement_register_entry(
            requirement_id=requirement_id,
            authority_refs=authority_refs,
            current_refs=current_refs,
            authority_statements=authority_statements,
            current_statements=current_statements,
            implementation_design_refs=implementation_design_refs,
            implementation_module_refs=implementation_module_refs,
            implementation_refs=implementation_refs,
            planned_test_design_refs=planned_test_design_refs,
            planned_test_module_refs=planned_test_module_refs,
            planned_validation_refs=planned_validation_refs,
            uat_validation_refs=uat_validation_refs,
            test_run_archive_refs=run_archive_refs,
            code_refs=code_refs,
            test_refs=test_refs,
            workspace_root=workspace_root,
        )
        requirements.append(entry)
        _increment_count(status_counts, str(entry["status"]))
        _increment_count(carry_counts, str(entry["carry_status"]))
        _increment_count(fulfillment_detail_counts, str(entry["fulfillment_detail"]))
        _increment_count(fulfillment_counts, str(entry["fulfillment_status"]))

    return {
        "register_kind": REQUIREMENT_CLOSURE_REGISTER_KIND,
        "schema_version": "v1",
        "workspace_root": str(workspace_root),
        "stage": stage,
        "project_profile": load_project_profile(workspace_root).to_dict(),
        "summary": {
            "total_live_requirements": len(requirements),
            "missing_from_current_requirement_surface": len(missing_requirement_ids_from_current_surface(workspace_root)),
            "missing_intent_ids_from_goals": len(missing_intent_ids_from_goals(workspace_root)),
            "requirements_missing_code_traceability": len(missing_code_traceability_ids(workspace_root)),
            "requirements_missing_planned_test_traceability": len(missing_planned_test_traceability_ids(workspace_root)),
            "requirements_with_unexpected_planned_test_traceability": len(unexpected_planned_test_traceability_ids(workspace_root)),
            "requirements_missing_test_traceability": len(missing_realized_test_traceability_ids(workspace_root)),
            "requirements_with_unexpected_realized_test_traceability": len(unexpected_realized_test_traceability_ids(workspace_root)),
            "orphan_code_files": len(scan["orphan_code_files"]),
            "orphan_test_files": len(scan["orphan_test_files"]),
            "status_counts": status_counts,
            "carry_counts": carry_counts,
            "fulfillment_detail_counts": fulfillment_detail_counts,
            "fulfillment_counts": fulfillment_counts,
        },
        "traceability": scan,
        "requirements": requirements,
    }


def current_requirement_executability_gap(workspace_root: Path) -> dict[str, Any]:
    register = build_requirement_closure_register(workspace_root, stage="workspace_scan")
    authority_requirements = [
        entry for entry in register["requirements"] if entry["present_in_authority"]
    ]
    use_authority_basis = bool(authority_requirements)
    expected_requirements = authority_requirements or [
        entry for entry in register["requirements"] if entry["present_in_current_requirement_surface"]
    ]
    extra_requirements = (
        [
            entry
            for entry in register["requirements"]
            if entry["present_in_current_requirement_surface"] and not entry["present_in_authority"]
        ]
        if use_authority_basis
        else []
    )
    ledger = _build_edge_obligation_ledger(
        obligation_kind="requirement",
        obligation_source_ref=(
            "authority_requirement_surface" if use_authority_basis else "current_requirement_surface"
        ),
        obligation_source_kind="requirement_surface",
        obligation_source_admission_basis="authority" if use_authority_basis else "current_surface",
        derivation_rule="identity",
        expected_entries=expected_requirements,
        extra_entries=extra_requirements,
        obligation_id_getter=lambda entry: str(entry["requirement_id"]),
        obligation_builder=_build_requirement_obligation_view,
        blocking_builder=_build_requirement_blocking_view,
        extra_blocking_builder=lambda entry: _build_requirement_blocking_view(
            entry,
            status="extra_in_current_requirement_surface",
            carry_status="extra",
            fulfillment_status=str(entry.get("fulfillment_status") or "unassessed"),
            blocking_reasons=[
                "extra_in_current_requirement_surface",
                *list(entry.get("blocking_reasons", ())),
            ],
        ),
    )
    gap = {
        "scope": "current_requirement_surface",
        "requires_build_out": bool(ledger["blocking_obligations"]),
        **ledger,
    }
    return gap


def _declared_requirement_extra_ids(
    workspace_root: Path,
    *,
    fulfillment_rule: str,
) -> set[str]:
    if fulfillment_rule == "implementation_design_surface_coverage":
        return set(implementation_design_claim_refs(workspace_root))
    if fulfillment_rule == "implementation_module_surface_coverage":
        return set(implementation_module_claim_refs(workspace_root))
    if fulfillment_rule == "behavioral_code_realization":
        scan = traceability_scan(workspace_root)
        return (
            set(implementation_module_claim_refs(workspace_root))
            | set(scan["code_refs"])
        )
    if fulfillment_rule == "test_design_surface_coverage":
        return set(planned_test_design_claim_refs(workspace_root))
    if fulfillment_rule == "test_module_surface_coverage":
        return set(planned_test_module_claim_refs(workspace_root))
    if fulfillment_rule == "realized_test_evidence":
        return set(test_run_archive_refs(workspace_root))
    if fulfillment_rule == "testcase_authority_coverage":
        return set(testcase_authority_refs(workspace_root))
    if fulfillment_rule == "release_readiness":
        scan = traceability_scan(workspace_root)
        return (
            set(implementation_claim_refs(workspace_root))
            | set(planned_test_claim_refs(workspace_root))
            | set(testcase_authority_refs(workspace_root))
            | set(scan["code_refs"])
            | set(test_run_archive_refs(workspace_root))
        )
    raise ValueError(f"unsupported declared requirement fulfillment rule {fulfillment_rule!r}")


def _declared_requirement_expected_ids(
    workspace_root: Path,
    *,
    derivation_rule: str,
    fulfillment_rule: str,
) -> set[str]:
    if derivation_rule == "identity":
        return set(current_requirement_refs(workspace_root))
    if derivation_rule == "implementation_design_projection":
        return _expected_implementation_design_requirement_ids(workspace_root)
    if derivation_rule == "implementation_module_projection":
        return _expected_implementation_module_requirement_ids(workspace_root)
    if derivation_rule == "implementation_code_projection":
        return _expected_implementation_code_requirement_ids(workspace_root)
    if derivation_rule == "validation_design_projection":
        return _expected_validation_design_requirement_ids(workspace_root)
    if derivation_rule == "validation_module_projection":
        return _expected_validation_module_requirement_ids(workspace_root)
    if derivation_rule == "validation_authority_projection":
        return _expected_validation_authority_requirement_ids(workspace_root)
    if derivation_rule == "realized_validation_projection":
        return _expected_realized_validation_requirement_ids(workspace_root)
    raise ValueError(
        f"unsupported declared requirement derivation rule {derivation_rule!r} for {fulfillment_rule!r}"
    )


def _declared_requirement_carried_ids(
    workspace_root: Path,
    *,
    fulfillment_rule: str,
) -> set[str]:
    if fulfillment_rule == "implementation_design_surface_coverage":
        return set(implementation_design_claim_refs(workspace_root))
    if fulfillment_rule == "implementation_module_surface_coverage":
        return set(implementation_module_claim_refs(workspace_root))
    if fulfillment_rule == "behavioral_code_realization":
        return set(traceability_scan(workspace_root)["code_refs"])
    if fulfillment_rule == "test_design_surface_coverage":
        return set(planned_test_design_claim_refs(workspace_root))
    if fulfillment_rule == "test_module_surface_coverage":
        return set(planned_test_module_claim_refs(workspace_root))
    if fulfillment_rule == "realized_test_evidence":
        return set(test_run_archive_refs(workspace_root))
    if fulfillment_rule == "testcase_authority_coverage":
        return set(testcase_authority_refs(workspace_root))
    if fulfillment_rule == "release_readiness":
        scan = traceability_scan(workspace_root)
        return (
            set(implementation_module_claim_refs(workspace_root))
            | set(planned_test_module_claim_refs(workspace_root))
            | set(testcase_authority_refs(workspace_root))
            | set(scan["code_refs"])
            | set(test_run_archive_refs(workspace_root))
        )
    raise ValueError(f"unsupported declared requirement fulfillment rule {fulfillment_rule!r}")


def _edge_requirement_evidence_refs(
    entry: dict[str, Any],
    *,
    fulfillment_rule: str,
) -> list[str]:
    if fulfillment_rule == "implementation_design_surface_coverage":
        return list(entry.get("implementation_design_claim_refs", ()))
    if fulfillment_rule == "implementation_module_surface_coverage":
        return list(entry.get("implementation_module_claim_refs", ()))
    if fulfillment_rule == "behavioral_code_realization":
        return _unique_sequence(
            list(entry.get("behavioral_code_refs", ())),
            list(entry.get("code_refs", ())),
            list(entry.get("implementation_module_claim_refs", ())),
        )
    if fulfillment_rule == "test_design_surface_coverage":
        return list(entry.get("planned_test_design_claim_refs", ()))
    if fulfillment_rule == "test_module_surface_coverage":
        return _unique_sequence(
            list(entry.get("planned_test_module_claim_refs", ())),
            list(entry.get("planned_test_design_claim_refs", ())),
        )
    if fulfillment_rule == "realized_test_evidence":
        return list(entry.get("test_run_archive_refs", ()))
    if fulfillment_rule == "testcase_authority_coverage":
        return _unique_sequence(
            list(entry.get("testcase_authority_refs", ())),
            list(entry.get("planned_test_design_claim_refs", ())),
            list(entry.get("planned_test_module_claim_refs", ())),
        )
    if fulfillment_rule == "release_readiness":
        return _unique_sequence(
            list(entry.get("behavioral_code_refs", ())),
            list(entry.get("test_run_archive_refs", ())),
            list(entry.get("testcase_authority_refs", ())),
            list(entry.get("implementation_module_claim_refs", ())),
            list(entry.get("planned_test_module_claim_refs", ())),
        )
    raise ValueError(f"unsupported declared requirement fulfillment rule {fulfillment_rule!r}")


def _declared_requirement_fulfillment(
    entry: dict[str, Any],
    *,
    fulfillment_rule: str,
    carry_status: str,
) -> tuple[str, list[str]]:
    if carry_status != "carried":
        return "unassessed", list(entry.get("blocking_reasons", ()))

    implementation_design_claim_refs = list(entry.get("implementation_design_claim_refs", ()))
    implementation_module_claim_refs = list(entry.get("implementation_module_claim_refs", ()))
    implementation_claim_refs = list(entry.get("implementation_claim_refs", ()))
    planned_test_design_claim_refs = list(entry.get("planned_test_design_claim_refs", ()))
    planned_test_module_claim_refs = list(entry.get("planned_test_module_claim_refs", ()))
    planned_test_claim_refs = list(entry.get("planned_test_claim_refs", ()))
    testcase_authority_refs = list(entry.get("testcase_authority_refs", ()))
    test_run_archive_refs = list(entry.get("test_run_archive_refs", ()))
    code_refs = list(entry.get("code_refs", ()))
    behavioral_code_refs = list(entry.get("behavioral_code_refs", ()))
    test_refs = list(entry.get("test_refs", ()))

    if fulfillment_rule == "implementation_design_surface_coverage":
        if implementation_design_claim_refs:
            return "fulfilled", []
        return "specified", ["missing_implementation_design_coverage"]

    if fulfillment_rule == "implementation_module_surface_coverage":
        if implementation_module_claim_refs:
            return "fulfilled", []
        if implementation_design_claim_refs:
            return "planned", ["missing_implementation_module_coverage"]
        return "specified", ["missing_implementation_module_coverage"]

    if fulfillment_rule == "behavioral_code_realization":
        if behavioral_code_refs:
            return "fulfilled", []
        if code_refs:
            return "traceable_stub", ["behavioral_realization_missing"]
        if implementation_module_claim_refs or implementation_design_claim_refs:
            return "planned", ["missing_code_realization"]
        return "specified", ["missing_code_realization"]

    if fulfillment_rule == "test_design_surface_coverage":
        if planned_test_design_claim_refs:
            return "fulfilled", []
        if planned_test_module_claim_refs or test_refs or testcase_authority_refs:
            return "planned", ["missing_planned_test_coverage"]
        return "specified", ["missing_planned_test_coverage"]

    if fulfillment_rule == "test_module_surface_coverage":
        if planned_test_module_claim_refs:
            return "fulfilled", []
        if planned_test_design_claim_refs:
            return "planned", ["missing_test_module_coverage"]
        return "specified", ["missing_test_module_coverage"]

    if fulfillment_rule == "realized_test_evidence":
        if test_run_archive_refs:
            return "fulfilled", []
        if planned_test_module_claim_refs or planned_test_design_claim_refs or testcase_authority_refs:
            return "planned", ["missing_realized_test_evidence"]
        return "specified", ["missing_realized_test_evidence"]

    if fulfillment_rule == "testcase_authority_coverage":
        if testcase_authority_refs:
            return "fulfilled", []
        if planned_test_module_claim_refs or planned_test_design_claim_refs or implementation_claim_refs or code_refs:
            return "planned", ["missing_testcase_authority_coverage"]
        return "specified", ["missing_testcase_authority_coverage"]

    if fulfillment_rule == "release_readiness":
        blocking_reasons: list[str] = []
        if not behavioral_code_refs:
            blocking_reasons.append(
                "behavioral_realization_missing" if code_refs else "missing_code_realization"
            )
        if not test_run_archive_refs:
            blocking_reasons.append("missing_realized_test_evidence")
        if not testcase_authority_refs:
            blocking_reasons.append("missing_testcase_authority_coverage")
        if not blocking_reasons:
            return "fulfilled", []
        if behavioral_code_refs and test_run_archive_refs:
            return "implemented_without_testcase_authority", blocking_reasons
        if behavioral_code_refs:
            return "implemented_without_realized_tests", blocking_reasons
        if code_refs:
            return "traceable_stub", blocking_reasons
        if implementation_claim_refs or planned_test_claim_refs or testcase_authority_refs:
            return "planned", blocking_reasons
        return "specified", blocking_reasons

    raise ValueError(f"unsupported declared requirement fulfillment rule {fulfillment_rule!r}")


def _project_declared_requirement_entry(
    entry: dict[str, Any],
    *,
    fulfillment_rule: str,
    carried_ids: set[str],
) -> dict[str, Any]:
    projected = dict(entry)
    requirement_id = str(entry["requirement_id"])
    carry_status = "carried" if requirement_id in carried_ids else "missing"
    if carry_status == "carried":
        fulfillment_detail, blocking_reasons = _declared_requirement_fulfillment(
            entry,
            fulfillment_rule=fulfillment_rule,
            carry_status=carry_status,
        )
        fulfillment_status = _fulfillment_status_for_requirement(
            fulfillment_detail=fulfillment_detail,
            carry_status=carry_status,
        )
        status = "fulfilled" if fulfillment_status == "fulfilled" else fulfillment_detail
    else:
        fulfillment_detail = "unassessed"
        fulfillment_status = "unassessed"
        blocking_reasons = ["missing_from_edge_obligation_set"]
        status = "missing_from_edge_obligation_set"
    projected["carry_status"] = carry_status
    projected["status"] = status
    projected["fulfillment_detail"] = fulfillment_detail
    projected["fulfillment_status"] = fulfillment_status
    projected["blocking_reasons"] = blocking_reasons
    projected["edge_evidence_refs"] = _edge_requirement_evidence_refs(
        projected,
        fulfillment_rule=fulfillment_rule,
    )
    return projected


def declared_requirement_edge_gap(
    workspace_root: Path,
    declaration: dict[str, Any] | Any,
    *,
    edge_name: str,
) -> dict[str, Any]:
    payload = _coerce_obligation_declaration(declaration)
    fulfillment_rule = str(payload.get("fulfillment_rule") or "")
    derivation_rule = str(payload.get("derivation_rule") or "identity")
    register = build_requirement_closure_register(workspace_root, stage="workspace_scan")
    expected_ids = _declared_requirement_expected_ids(
        workspace_root,
        derivation_rule=derivation_rule,
        fulfillment_rule=fulfillment_rule,
    )
    carried_ids = _declared_requirement_carried_ids(
        workspace_root,
        fulfillment_rule=fulfillment_rule,
    )
    expected_entries = [
        _project_declared_requirement_entry(
            entry,
            fulfillment_rule=fulfillment_rule,
            carried_ids=carried_ids,
        )
        for entry in register["requirements"]
        if str(entry["requirement_id"]) in expected_ids
    ]
    extra_ids = _declared_requirement_extra_ids(
        workspace_root,
        fulfillment_rule=fulfillment_rule,
    ) - expected_ids
    extra_entries = [
        _project_declared_requirement_entry(
            entry,
            fulfillment_rule=fulfillment_rule,
            carried_ids=carried_ids,
        )
        for entry in register["requirements"]
        if str(entry["requirement_id"]) in extra_ids
    ]
    ledger = _build_edge_obligation_ledger(
        obligation_kind=str(payload.get("obligation_kind") or "requirement"),
        obligation_source_ref=str(payload.get("obligation_source_ref") or "requirement_surface"),
        obligation_source_kind=str(payload.get("obligation_source_kind") or "requirement_surface"),
        obligation_source_admission_basis=str(
            payload.get("obligation_source_admission_basis") or "authority_or_current_surface"
        ),
        derivation_rule=str(payload.get("derivation_rule") or "identity"),
        expected_entries=expected_entries,
        extra_entries=extra_entries,
        obligation_id_getter=lambda entry: str(entry["requirement_id"]),
        obligation_builder=_build_requirement_obligation_view,
        blocking_builder=_build_requirement_blocking_view,
        extra_blocking_builder=lambda entry: _build_requirement_blocking_view(
            entry,
            status="extra_in_edge_obligation_set",
            carry_status="extra",
            fulfillment_status=str(entry.get("fulfillment_status") or "unassessed"),
            blocking_reasons=["extra_in_edge_obligation_set"],
        ),
    )
    return {
        "scope": edge_name,
        "edge": edge_name,
        "requires_build_out": bool(ledger["blocking_obligations"]),
        **ledger,
    }


def _coerce_obligation_declaration(declaration: Any) -> dict[str, Any]:
    if declaration is None:
        return {}
    if hasattr(declaration, "to_dict"):
        payload = declaration.to_dict()
        return payload if isinstance(payload, dict) else {}
    if isinstance(declaration, dict):
        return dict(declaration)
    return {}


def obligation_gap_from_declaration(
    workspace_root: Path,
    declaration: dict[str, Any] | Any,
    *,
    edge_name: str,
) -> dict[str, Any]:
    payload = _coerce_obligation_declaration(declaration)
    adapter_ref = str(payload.get("adapter_ref") or "")
    if adapter_ref == _REQUIREMENT_EXECUTION_ADAPTER_REF:
        gap = current_requirement_executability_gap(workspace_root)
    elif adapter_ref == _DECLARED_REQUIREMENT_EDGE_ADAPTER_REF:
        gap = declared_requirement_edge_gap(
            workspace_root,
            payload,
            edge_name=edge_name,
        )
    else:
        raise ValueError(f"unsupported obligation adapter {adapter_ref!r}")

    merged = dict(gap)
    for key in (
        "obligation_source_ref",
        "obligation_source_kind",
        "obligation_source_admission_basis",
        "obligation_kind",
        "derivation_rule",
        "carry_rule",
        "fulfillment_rule",
        "evidence_policy",
    ):
        value = payload.get(key)
        if value not in (None, ""):
            merged[key] = value
    merged["adapter_ref"] = adapter_ref
    merged["signal_key"] = str(payload.get("signal_key") or adapter_ref or merged.get("scope"))
    return merged


def collect_declared_obligation_gaps(
    workspace_root: Path,
    declarations_by_edge: list[tuple[str, dict[str, Any] | Any]],
) -> list[dict[str, Any]]:
    gaps: list[dict[str, Any]] = []
    supported_adapters = {
        _REQUIREMENT_EXECUTION_ADAPTER_REF,
        _DECLARED_REQUIREMENT_EDGE_ADAPTER_REF,
    }
    for edge_name, declaration in declarations_by_edge:
        payload = _coerce_obligation_declaration(declaration)
        if not payload:
            continue
        adapter_ref = str(payload.get("adapter_ref") or "")
        if adapter_ref not in supported_adapters:
            continue
        gap = obligation_gap_from_declaration(
            workspace_root,
            payload,
            edge_name=edge_name,
        )
        gap["signal_key"] = str(payload.get("signal_key") or edge_name)
        gap["declared_edges"] = [edge_name]
        gaps.append(gap)
    return gaps


def _format_id_lines(
    label: str,
    ids: tuple[str, ...],
    *,
    max_items: int = 12,
) -> list[str]:
    if not ids:
        return [f"- {label}: none"]
    shown = ids[:max_items]
    suffix = ""
    if len(ids) > max_items:
        suffix = f" (+{len(ids) - max_items} more)"
    return [f"- {label}: {', '.join(shown)}{suffix}"]


def build_requirement_closure_prompt_context(
    workspace_root: Path,
    *,
    register: dict[str, Any] | None = None,
) -> str:
    payload = register or build_requirement_closure_register(workspace_root, stage="workspace_scan")
    summary = payload["summary"]
    missing_requirement_ids = missing_requirement_ids_from_current_surface(workspace_root)
    missing_goal_intent_ids = missing_intent_ids_from_goals(workspace_root)
    missing_code_ids = missing_code_traceability_ids(workspace_root)
    missing_planned_test_ids = missing_planned_test_traceability_ids(workspace_root)
    unexpected_planned_test_ids = unexpected_planned_test_traceability_ids(workspace_root)
    missing_realized_test_ids = missing_realized_test_traceability_ids(workspace_root)
    unexpected_realized_test_ids = unexpected_realized_test_traceability_ids(workspace_root)
    full_register_path = REQUIREMENT_CLOSURE_REGISTER_PATH.as_posix()
    generated_surface_path = _GENERATED_REQUIREMENT_SURFACE_PATH.as_posix()

    lines = [
        "# odd_sdlc Requirement Closure Builder Context",
        "",
        "Use this as a compact builder-facing summary of the live requirement closure state.",
        "Treat the generated requirement surface as the target asset under construction.",
        "Use the full closure register only when you need per-id detail.",
        "",
        "## Working Boundary",
        f"- target generated requirement surface: `{generated_surface_path}`",
        f"- full closure register for on-demand inspection: `{full_register_path}`",
        "- preserve authority ids and imported source boundaries; do not rewrite authority files to hide closure defects",
        "- reduce requirement-scope gaps in the generated requirement surface before asking for assessment",
        "",
        "## Summary",
        f"- total live requirements: {summary['total_live_requirements']}",
        f"- missing from current requirement surface: {summary['missing_from_current_requirement_surface']}",
        f"- missing intent ids from goals: {summary['missing_intent_ids_from_goals']}",
        f"- requirements missing code traceability: {summary['requirements_missing_code_traceability']}",
        f"- requirements missing planned test traceability: {summary['requirements_missing_planned_test_traceability']}",
        f"- requirements with unexpected planned test traceability: {summary['requirements_with_unexpected_planned_test_traceability']}",
        f"- requirements missing realized test traceability: {summary['requirements_missing_test_traceability']}",
        f"- requirements with unexpected realized test traceability: {summary['requirements_with_unexpected_realized_test_traceability']}",
        f"- orphan code files: {summary['orphan_code_files']}",
        f"- orphan test files: {summary['orphan_test_files']}",
        "",
        "## Immediate Repair Signal",
        *_format_id_lines("missing from current requirement surface", missing_requirement_ids),
        *_format_id_lines("intent ids still missing from goals", missing_goal_intent_ids),
        *_format_id_lines("requirement ids still missing code traceability", missing_code_ids),
        *_format_id_lines("requirement ids still missing planned test traceability", missing_planned_test_ids),
        *_format_id_lines("unexpected requirement ids claimed by planned tests", unexpected_planned_test_ids),
        *_format_id_lines("requirement ids still missing realized test traceability", missing_realized_test_ids),
        *_format_id_lines("unexpected requirement ids claimed by realized tests", unexpected_realized_test_ids),
        "",
        "## Builder Law",
        "- inspect the current generated requirement surface first",
        "- continue from the current workspace state rather than restating the whole imported authority",
        "- use the full closure register only when the compact summary is insufficient for the next repair step",
    ]
    return "\n".join(lines) + "\n"


def refresh_requirement_closure_register(workspace_root: Path, *, stage: str = "workspace_scan") -> dict[str, Any]:
    payload = build_requirement_closure_register(workspace_root, stage=stage)
    path = workspace_root / REQUIREMENT_CLOSURE_REGISTER_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, indent=2, sort_keys=True)
    existing = path.read_text(encoding="utf-8") if path.exists() else None
    if existing != content:
        path.write_text(content, encoding="utf-8")
    prompt_context_path = workspace_root / REQUIREMENT_CLOSURE_PROMPT_CONTEXT_PATH
    prompt_context_content = build_requirement_closure_prompt_context(
        workspace_root,
        register=payload,
    )
    existing_prompt_context = (
        prompt_context_path.read_text(encoding="utf-8")
        if prompt_context_path.exists()
        else None
    )
    if existing_prompt_context != prompt_context_content:
        prompt_context_path.write_text(prompt_context_content, encoding="utf-8")
    return payload


def load_published_requirement_closure_register(workspace_root: Path) -> dict[str, Any] | None:
    workspace_state = load_published_workspace_state(workspace_root)
    if not isinstance(workspace_state, dict):
        return None
    if not published_analysis_is_current(workspace_root):
        return None
    path = workspace_root / REQUIREMENT_CLOSURE_REGISTER_PATH
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_or_build_requirement_closure_register(workspace_root: Path) -> dict[str, Any]:
    published = load_published_requirement_closure_register(workspace_root)
    if published is not None:
        return published
    return build_requirement_closure_register(workspace_root, stage="workspace_scan")

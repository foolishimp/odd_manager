# Implements: REQ-R-ABG3-SELFHOSTING
"""
selfhosting — Derived artifact governance.

Bootloader consistency checks, drift detection.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


_PUBLIC_GTL_TYPES = frozenset(
    {
        "Graph",
        "Node",
        "GraphVector",
        "Context",
        "Operator",
        "Evaluator",
        "Rule",
        "GraphFunction",
        "RefinementBoundary",
        "CandidateFamily",
        "ContractRef",
        "Role",
        "Job",
        "Module",
        "F_D",
        "F_P",
        "F_H",
    }
)
_AXIOMATIC_GTL_TYPES = frozenset(
    {
        "Graph",
        "Node",
        "GraphVector",
        "Context",
        "Operator",
        "Evaluator",
        "GraphFunction",
        "RefinementBoundary",
        "CandidateFamily",
        "Module",
        "Job",
        "Role",
    }
)


def _extract_markdown_section(markdown: str, heading: str) -> str:
    pattern = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.MULTILINE)
    match = pattern.search(markdown)
    if match is None:
        return ""
    start = match.end()
    next_heading = re.compile(r"^##\s+", re.MULTILINE).search(markdown, start)
    end = next_heading.start() if next_heading else len(markdown)
    return markdown[start:end]


def _parse_structural_axioms(section: str) -> set[str]:
    return {token for token in re.findall(r"`([^`]+)`", section)}


def _parse_type_surface_table(section: str) -> dict[str, str]:
    rows: dict[str, str] = {}
    for line in section.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.split("|")[1:-1]]
        if len(cells) < 3:
            continue
        type_cell, module_cell = cells[0], cells[1]
        if not type_cell.startswith("`") or not module_cell.startswith("`"):
            continue
        rows[type_cell.strip("`")] = module_cell.strip("`")
    return rows


def _parse_regime_table(section: str) -> set[str]:
    names: set[str] = set()
    for line in section.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.split("|")[1:-1]]
        if not cells:
            continue
        cell = cells[0]
        if cell.startswith("`") and cell.endswith("`"):
            names.add(cell.strip("`"))
    return names


def _bootloader_consistency_report(spec_module: str, bootloader_path: str) -> dict:
    """Build a structural self-hosting consistency report."""
    import importlib
    import inspect

    try:
        mod = importlib.import_module(spec_module)
    except ImportError as exc:
        return {"error": f"cannot import {spec_module}: {exc}"}

    if hasattr(mod, "__all__"):
        all_defined = {
            name: getattr(mod, name)
            for name in mod.__all__
            if hasattr(mod, name) and inspect.isclass(getattr(mod, name))
        }
    else:
        all_defined = {
            name: obj
            for name, obj in inspect.getmembers(mod)
            if inspect.isclass(obj)
            and obj.__module__ == spec_module
            and not name.startswith("_")
        }

    exported = {
        name: obj
        for name, obj in all_defined.items()
        if name in _PUBLIC_GTL_TYPES
    }

    boot_path = Path(bootloader_path)
    if not boot_path.exists():
        return {"error": f"bootloader not found: {bootloader_path}"}

    boot_text = boot_path.read_text(encoding="utf-8")
    axiom_names = _parse_structural_axioms(_extract_markdown_section(boot_text, "2. Structural Axioms"))
    type_surface = _parse_type_surface_table(_extract_markdown_section(boot_text, "3. GTL Type Surface"))
    regime_names = _parse_regime_table(_extract_markdown_section(boot_text, "5. Evaluator Regimes"))

    missing_axioms = sorted(
        name
        for name in exported
        if name in _AXIOMATIC_GTL_TYPES and name not in axiom_names
    )
    missing_type_surface = sorted(
        name
        for name in exported
        if name not in {"F_D", "F_P", "F_H"} and name not in type_surface
    )
    missing_regimes = sorted(
        name for name in ("F_D", "F_P", "F_H") if name in exported and name not in regime_names
    )

    module_mismatches = sorted(
        {
            name: {
                "bootloader_module": type_surface[name],
                "spec_module": exported[name].__module__,
            }
            for name in exported
            if name in type_surface and name not in {"F_D", "F_P", "F_H"}
            and type_surface[name] != exported[name].__module__
        }.items()
    )
    mismatch_entries = [
        {
            "name": name,
            "bootloader_module": payload["bootloader_module"],
            "spec_module": payload["spec_module"],
        }
        for name, payload in module_mismatches
    ]

    return {
        "spec_module": spec_module,
        "bootloader": bootloader_path,
        "exported_types": sorted(exported),
        "exported_count": len(exported),
        "missing_axioms": missing_axioms,
        "missing_type_surface": missing_type_surface,
        "missing_regimes": missing_regimes,
        "module_mismatches": mismatch_entries,
        "passes": not (missing_axioms or missing_type_surface or missing_regimes or mismatch_entries),
    }


def _check_bootloader_consistency(spec_module: str, bootloader_path: str) -> int:
    """
    Verify that the bootloader structurally describes the live exported GTL surface.
    """
    result = _bootloader_consistency_report(spec_module, bootloader_path)
    if "error" in result:
        print(json.dumps(result), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0 if result["passes"] else 1

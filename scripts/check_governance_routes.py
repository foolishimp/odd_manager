#!/usr/bin/env python3
"""Reject duplicate or legacy live governance routes in odd_manager.

The STDO toolchain owns release/schema/manifest verification. This checker is
deliberately narrower: it protects project-owned routing and ensures current
work does not regain a repository-local standards mirror as authority.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFINITION = ROOT / "stdo_odd_manager.json"
CURRENT_BASIS = "stdo_odd_manager.json#/constitution/stdo/basis"
TICKETS_ROOT = ROOT / ".ai-workspace" / "tickets"
CURRENT_TICKET_DIRS = (
    TICKETS_ROOT / "active",
    TICKETS_ROOT / "backlog",
)


class DuplicateKeyError(ValueError):
    """Raised when JSON repeats a key and would otherwise silently overwrite it."""


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def read_definition() -> dict[str, Any]:
    try:
        return json.loads(DEFINITION.read_text(), object_pairs_hook=unique_object)
    except (OSError, json.JSONDecodeError, DuplicateKeyError) as error:
        raise ValueError(f"cannot load {DEFINITION.relative_to(ROOT)}: {error}") from error


def iter_strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from iter_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_strings(child)


def current_text_files() -> list[Path]:
    files = [ROOT / "AGENTS.md", ROOT / "CLAUDE.md", ROOT / "README.md"]
    roots = [
        ROOT / "specification",
        ROOT / "docs",
        *CURRENT_TICKET_DIRS,
        ROOT / "build_tenants" / "common" / "design",
        ROOT / "build_tenants" / "react_vite" / "design",
        ROOT / "build_tenants" / "project_package" / "python" / "design",
    ]
    for root in roots:
        if root.exists():
            files.extend(path for path in root.rglob("*.md") if path.is_file())
    return sorted(set(files))


def main() -> int:
    failures: list[str] = []
    definition = read_definition()

    definitions = sorted(
        path
        for path in ROOT.glob("stdo_*.json")
        if path.is_file() and not path.is_symlink()
    )
    if definitions != [DEFINITION]:
        rendered = ", ".join(path.name for path in definitions) or "none"
        failures.append(f"expected one root Product Definition, found: {rendered}")

    definition_strings = list(iter_strings(definition))
    legacy_definition_routes = [
        value for value in definition_strings if value.startswith("./.genesis/")
    ]
    if legacy_definition_routes:
        failures.append(
            "Product Definition routes into excluded .genesis provenance: "
            + ", ".join(legacy_definition_routes)
        )

    try:
        stdo = definition["constitution"]["stdo"]
        basis_uri = stdo["basis"]["uri"]
        manifest_sha256 = stdo["basis"]["manifest_sha256"]
    except (KeyError, TypeError) as error:
        failures.append(f"Product Definition lacks the exact STDO basis: {error}")
        basis_uri = ""
        manifest_sha256 = ""

    current_tickets = sorted(
        ticket
        for lane in CURRENT_TICKET_DIRS
        for ticket in lane.glob("*.md")
    )
    legacy_metadata = re.compile(
        r"^(selected_method_release|selected_method_commit|"
        r"selected_method_member_set_digest):",
        re.MULTILINE,
    )
    seen_ticket_ids: dict[str, Path] = {}
    for ticket in current_tickets:
        text = ticket.read_text()
        frontmatter = re.match(r"^---\r?\n(?P<body>[\s\S]*?)\r?\n---(?:\r?\n|$)", text)
        if frontmatter is None:
            failures.append(
                f"{ticket.relative_to(ROOT)} lacks canonical YAML frontmatter"
            )
            metadata = ""
        else:
            metadata = frontmatter.group("body")
        ticket_id_match = re.search(r"^id:\s*(\S+)\s*$", metadata, re.MULTILINE)
        status_match = re.search(r"^status:\s*(\S+)\s*$", metadata, re.MULTILINE)
        if ticket_id_match is None:
            failures.append(f"{ticket.relative_to(ROOT)} lacks a ticket id")
        else:
            ticket_id = ticket_id_match.group(1)
            previous = seen_ticket_ids.get(ticket_id)
            if previous is not None:
                failures.append(
                    f"duplicate current ticket id {ticket_id}: "
                    f"{previous.relative_to(ROOT)}, {ticket.relative_to(ROOT)}"
                )
            seen_ticket_ids[ticket_id] = ticket
        expected_status = ticket.parent.name
        if status_match is None or status_match.group(1) != expected_status:
            observed_status = status_match.group(1) if status_match else "missing"
            failures.append(
                f"{ticket.relative_to(ROOT)} status {observed_status} does not match "
                f"lane {expected_status}"
            )
        if legacy_metadata.search(text):
            failures.append(
                f"{ticket.relative_to(ROOT)} retains duplicated release metadata"
            )
        if f"selected_method_basis: {CURRENT_BASIS}" not in text:
            failures.append(
                f"{ticket.relative_to(ROOT)} does not select {CURRENT_BASIS}"
            )

    forbidden_live_patterns = (
        re.compile(r"Use\s+`?\.genesis/docs/standards", re.IGNORECASE),
        re.compile(
            r"operative installed distribution[^\n]*\.genesis/docs/standards",
            re.IGNORECASE,
        ),
        re.compile(r"Governing method[^\n]*STDO\s+`?v2\.[0-3]", re.IGNORECASE),
    )
    for path in current_text_files():
        text = path.read_text(errors="replace")
        for pattern in forbidden_live_patterns:
            match = pattern.search(text)
            if match:
                line = text.count("\n", 0, match.start()) + 1
                failures.append(
                    f"{path.relative_to(ROOT)}:{line} contains a legacy live route"
                )

        if path != DEFINITION:
            for exact_value, label in (
                (basis_uri, "exact basis URI"),
                (manifest_sha256, "manifest digest"),
            ):
                if exact_value and exact_value in text:
                    failures.append(
                        f"{path.relative_to(ROOT)} duplicates the selected {label}"
                    )

    for bootstrap_name in ("AGENTS.md", "CLAUDE.md"):
        bootstrap = (ROOT / bootstrap_name).read_text()
        if "workspace://stdo_odd_manager.json" not in bootstrap:
            failures.append(f"{bootstrap_name} does not route through the Product Definition")
        if "project-local standards mirror do not govern" not in bootstrap:
            failures.append(f"{bootstrap_name} lacks the local-mirror refusal")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1

    print(
        "governance route checks passed: "
        f"one Product Definition, {len(current_tickets)} current tickets, "
        "no duplicated release metadata or legacy live method routes"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

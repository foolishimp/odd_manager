# Implements: REQ-F-ODDSDLC-006
"""Executive program read-model catalog derived from the GTL carrier."""
from __future__ import annotations

from .domain_model import ExecutiveProgramEntry
from .gtl_module import (
    BOOTSTRAP_RELEASE_SELF_TEST_INTENT,
    BOOTSTRAP_RELEASE_SELF_TEST_STEPS,
    RELEASE_OPERATIONAL_CYCLE_INTENT,
    RELEASE_OPERATIONAL_CYCLE_STEPS,
)


BOOTSTRAP_RELEASE_SELF_TEST = ExecutiveProgramEntry(
    name="bootstrap_release_self_test",
    intent=BOOTSTRAP_RELEASE_SELF_TEST_INTENT,
    steps=BOOTSTRAP_RELEASE_SELF_TEST_STEPS,
    outputs=("release_surface",),
)

RELEASE_OPERATIONAL_CYCLE = ExecutiveProgramEntry(
    name="release_operational_cycle",
    intent=RELEASE_OPERATIONAL_CYCLE_INTENT,
    steps=RELEASE_OPERATIONAL_CYCLE_STEPS,
    outputs=("retrofit_plan_surface",),
)


PROGRAM_CATALOG: tuple[ExecutiveProgramEntry, ...] = (
    BOOTSTRAP_RELEASE_SELF_TEST,
    RELEASE_OPERATIONAL_CYCLE,
)


def program_by_name(name: str) -> ExecutiveProgramEntry:
    for entry in PROGRAM_CATALOG:
        if entry.name == name:
            return entry
    raise ValueError(f"Unknown executive program {name!r}")


def program_for_edge(edge: str) -> ExecutiveProgramEntry | None:
    for entry in PROGRAM_CATALOG:
        if edge in entry.steps:
            return entry
    return None

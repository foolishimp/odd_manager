# Implements: REQ-R-ABG3-WORKER
# Implements: REQ-R-ABG3-PROVENANCE
"""
identity — runtime identity and provenance projection.

ABG accepts worker identity as externally resolved input, but the surrounding
app/runtime stack may also declare engine/build/backend identity. This module
keeps those surfaces explicit so reporting metadata never overwrites canonical
worker/runtime truth.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RuntimeIdentity:
    """Structured runtime identity for one ABG scope or traversal attempt."""

    engine_id: str = "genesis"
    build_id: str | None = None
    worker_id: str | None = None
    backend_id: str | None = None
    authority_ref: str | None = None
    assignment_source: str | None = None
    resolved_runtime_ref: str | None = None

    def bind_worker(self, worker: Any) -> "RuntimeIdentity":
        """Return a worker-bound identity without discarding explicit fields."""
        if worker is None:
            return self
        worker_id = self.worker_id or getattr(worker, "id", None)
        authority_ref = self.authority_ref or getattr(worker, "authority_ref", None)
        return RuntimeIdentity(
            engine_id=self.engine_id,
            build_id=self.build_id,
            worker_id=worker_id,
            backend_id=self.backend_id,
            authority_ref=authority_ref,
            assignment_source=self.assignment_source,
            resolved_runtime_ref=self.resolved_runtime_ref,
        )

    def with_report_build_id(self, build_id: str | None) -> "RuntimeIdentity":
        """Merge explicit reporting metadata without allowing conflicting truth."""
        if not build_id:
            return self
        if self.build_id is None:
            return RuntimeIdentity(
                engine_id=self.engine_id,
                build_id=build_id,
                worker_id=self.worker_id,
                backend_id=self.backend_id,
                authority_ref=self.authority_ref,
                assignment_source=self.assignment_source,
                resolved_runtime_ref=self.resolved_runtime_ref,
            )
        if self.build_id != build_id:
            raise ValueError(
                "RuntimeIdentity.build_id disagrees with the explicit build reporting projection."
            )
        return self

    def report_build_id(self) -> str | None:
        """Return the explicit reporting build identifier when one is declared."""
        return self.build_id

    def as_dict(self) -> dict[str, str]:
        result = {
            "engine_id": self.engine_id,
        }
        if self.build_id:
            result["build_id"] = self.build_id
        if self.worker_id:
            result["worker_id"] = self.worker_id
        if self.backend_id:
            result["backend_id"] = self.backend_id
        if self.authority_ref:
            result["authority_ref"] = self.authority_ref
        if self.assignment_source:
            result["assignment_source"] = self.assignment_source
        if self.resolved_runtime_ref:
            result["resolved_runtime_ref"] = self.resolved_runtime_ref
        return result

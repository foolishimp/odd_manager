# Implements: REQ-R-ABG3-INTERPRET
"""
genesis — GTL-native AI SDLC engine.

Consumes Module, Graph, GraphVector, Node natively.

    binding      — ExecutableJob, Worker, WorkSurface, bind_fd, bind_fp, render_delta
    convergence  — EvaluatorOutcome, ConvergenceResult, delta, parent_converged
    interpret    — Traversal, traverse, schedule, apply_selection
    services     — Scope, module_to_executable_jobs, start, iterate_edge, gaps
    selection    — enumerate_candidates, validate_selection, SelectionDecision
    materialization — explicit graph-function materialization and derived companion bundles
    provenance   — provenance_snapshot
    events       — EventStream, emit
    projection   — project
    transport    — Subprocess transport for F_P actor invocations (ADR-022)
    identity     — RuntimeIdentity surface for engine/build/worker/backend provenance
    cli_adapter  — CLI entry point wiring
    selfhosting  — Bootloader consistency checks
    __main__     — CLI entry point
"""
__version__ = "3.1.0"

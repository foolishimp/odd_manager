# Implements: REQ-F-ODDSDLC-004
"""Bounded span-level gap analysis for odd_sdlc operator zoom."""
from __future__ import annotations

from typing import Any

from genesis.services import gen_gaps

from .traceability import collect_declared_obligation_gaps
from .triage import enrich_gap_snapshot


def _active_edge_order(app) -> list[str]:
    catalog_entries = app.scope().module.metadata.get("function_catalog", ())
    order: list[str] = []
    for entry in catalog_entries:
        if not isinstance(entry, dict):
            continue
        backing = entry.get("backing_graph_function")
        if not isinstance(backing, str) or not backing:
            continue
        order.append(backing)
    return order


def _vector_by_name(app) -> dict[str, Any]:
    vectors: dict[str, Any] = {}
    for function in app.scope().module.graph_functions:
        graph = function.template.graph
        if graph is None:
            continue
        for vector in graph.vectors:
            vectors.setdefault(vector.name, vector)
    return vectors


def _declared_obligation_specs(app, *, edge_names: list[str]) -> list[tuple[str, dict[str, Any] | Any]]:
    by_name = _vector_by_name(app)
    declarations: list[tuple[str, dict[str, Any] | Any]] = []
    for edge_name in edge_names:
        vector = by_name.get(edge_name)
        if vector is None:
            continue
        declaration = vector.declarations.get("obligation_ledger")
        if declaration is None:
            continue
        declarations.append((edge_name, declaration))
    return declarations


def _slice_span_edges(order: list[str], start_edge: str, end_edge: str) -> list[str]:
    if start_edge not in order:
        raise ValueError(f"unknown span start edge {start_edge!r}")
    if end_edge not in order:
        raise ValueError(f"unknown span end edge {end_edge!r}")
    start_index = order.index(start_edge)
    end_index = order.index(end_edge)
    if start_index > end_index:
        raise ValueError(
            f"invalid span ordering: start edge {start_edge!r} occurs after end edge {end_edge!r}"
        )
    return order[start_index : end_index + 1]


def _edge_order(edge_names: list[str], raw_graph_gaps: list[dict[str, Any]], ledger_gaps: list[dict[str, Any]]) -> list[str]:
    ordered: list[str] = []
    for edge_name in edge_names:
        if edge_name not in ordered:
            ordered.append(edge_name)
    for gap in raw_graph_gaps:
        edge_name = str(gap.get("edge") or "")
        if edge_name and edge_name not in ordered:
            ordered.append(edge_name)
    for gap in ledger_gaps:
        edge_name = str(gap.get("edge") or "")
        if edge_name and edge_name not in ordered:
            ordered.append(edge_name)
    return ordered


def _graph_projection(edge_name: str, graph_gap: dict[str, Any] | None) -> tuple[float, bool, list[str], list[str]]:
    if graph_gap is None:
        return 0.0, True, [], []
    failing = [str(item) for item in graph_gap.get("failing", ()) if str(item)]
    passing = [str(item) for item in graph_gap.get("passing", ()) if str(item)]
    obligation_evaluator_names = {
        f"{edge_name}_obligation_ledger_carry_converged",
    }
    residual_failing = [item for item in failing if item not in obligation_evaluator_names]
    if not failing:
        return 0.0, True, [], passing
    if residual_failing:
        return float(graph_gap.get("delta") or 0.0), False, residual_failing, passing
    return 0.0, True, [], passing


def _canonical_graph_gap(graph_gap: dict[str, Any]) -> dict[str, Any]:
    graph_delta = float(graph_gap.get("delta") or 0.0)
    failing = [str(item) for item in graph_gap.get("failing", ()) if str(item)]
    passing = [str(item) for item in graph_gap.get("passing", ()) if str(item)]
    graph_converged = not failing and graph_delta == 0.0
    merged = dict(graph_gap)
    merged.update(
        {
            "gap_kind": "graph_edge_gap",
            "graph_delta": graph_delta,
            "graph_converged": graph_converged,
            "carry_delta": 0.0,
            "fulfillment_delta": 0.0,
            "combined_delta": 0.0,
            "total_delta": graph_delta,
            "carry_converged": True,
            "fulfillment_converged": True,
            "edge_converged": graph_converged,
            "failing": failing,
            "passing": passing,
            "blocking_reasons": list(graph_gap.get("blocking_reasons", ())),
        }
    )
    return merged


def _canonical_declared_gap(
    edge_name: str,
    *,
    graph_gap: dict[str, Any] | None,
    ledger_gap: dict[str, Any],
) -> dict[str, Any]:
    graph_delta, graph_converged, residual_failing, graph_passing = _graph_projection(
        edge_name, graph_gap
    )
    deterministic_combined_delta = float(ledger_gap.get("combined_delta") or 0.0)
    total_delta = graph_delta + deterministic_combined_delta
    merged = dict(ledger_gap)
    if graph_gap is not None:
        for key in (
            "delta_summary",
            "environment_ready",
            "observation",
            "triage",
            "route_binding",
            "analysis_current",
        ):
            if key in graph_gap:
                merged[key] = graph_gap[key]
    merged.update(
        {
            "gap_kind": "declared_obligation_edge_gap",
            "graph_delta": graph_delta,
            "graph_converged": graph_converged,
            "graph_failing": residual_failing,
            "graph_passing": graph_passing,
            "combined_delta": deterministic_combined_delta,
            "total_delta": total_delta,
            "ledger_converged": bool(ledger_gap.get("edge_converged")),
            "edge_converged": (
                graph_converged
                and bool(ledger_gap.get("carry_converged"))
                and bool(ledger_gap.get("fulfillment_converged"))
            ),
        }
    )
    return merged


def canonical_edge_gaps(
    *,
    edge_names: list[str],
    raw_graph_gaps: list[dict[str, Any]],
    ledger_gaps: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    raw_by_edge = {
        str(gap.get("edge") or ""): dict(gap)
        for gap in raw_graph_gaps
        if isinstance(gap, dict) and str(gap.get("edge") or "")
    }
    ledger_by_edge = {
        str(gap.get("edge") or ""): dict(gap)
        for gap in ledger_gaps
        if isinstance(gap, dict) and str(gap.get("edge") or "")
    }
    canonical: list[dict[str, Any]] = []
    for edge_name in _edge_order(edge_names, raw_graph_gaps, ledger_gaps):
        graph_gap = raw_by_edge.get(edge_name)
        ledger_gap = ledger_by_edge.get(edge_name)
        if ledger_gap is None:
            if graph_gap is None:
                continue
            edge_gap = _canonical_graph_gap(graph_gap)
            if not bool(edge_gap.get("edge_converged")):
                canonical.append(edge_gap)
            continue
        edge_gap = _canonical_declared_gap(edge_name, graph_gap=graph_gap, ledger_gap=ledger_gap)
        if not bool(edge_gap.get("edge_converged")):
            canonical.append(edge_gap)
    return canonical


def aggregate_edge_gap_truth(gaps: list[dict[str, Any]]) -> dict[str, Any]:
    graph_total_delta = sum(float(gap.get("graph_delta") or 0.0) for gap in gaps)
    carry_delta = sum(float(gap.get("carry_delta") or 0.0) for gap in gaps)
    fulfillment_delta = sum(float(gap.get("fulfillment_delta") or 0.0) for gap in gaps)
    combined_delta = sum(float(gap.get("combined_delta") or 0.0) for gap in gaps)
    total_delta = sum(float(gap.get("total_delta") or 0.0) for gap in gaps)
    blocking_reasons = sorted(
        {
            reason
            for gap in gaps
            for reason in gap.get("blocking_reasons", ())
        }
    )
    return {
        "graph_total_delta": graph_total_delta,
        "direct_graph_delta": graph_total_delta,
        "carry_delta": carry_delta,
        "fulfillment_delta": fulfillment_delta,
        "combined_delta": combined_delta,
        "total_delta": total_delta,
        "expected_count": sum(int(gap.get("expected_count") or 0) for gap in gaps),
        "carried_count": sum(int(gap.get("carried_count") or 0) for gap in gaps),
        "fulfilled_count": sum(int(gap.get("fulfilled_count") or 0) for gap in gaps),
        "partial_count": sum(int(gap.get("partial_count") or 0) for gap in gaps),
        "missing_count": sum(int(gap.get("missing_count") or 0) for gap in gaps),
        "extra_count": sum(int(gap.get("extra_count") or 0) for gap in gaps),
        "unfulfilled_count": sum(int(gap.get("unfulfilled_count") or 0) for gap in gaps),
        "blocking_count": sum(int(gap.get("blocking_count") or 0) for gap in gaps),
        "blocking_reasons": blocking_reasons,
        "graph_converged": all(bool(gap.get("graph_converged")) for gap in gaps),
        "carry_converged": all(bool(gap.get("carry_converged")) for gap in gaps),
        "fulfillment_converged": all(bool(gap.get("fulfillment_converged")) for gap in gaps),
        "converged": not gaps,
    }


def span_gap_analysis(
    app,
    *,
    from_edge: str,
    to_edge: str,
    zoom: str = "combined",
    include_dependent: bool = True,
) -> dict[str, Any]:
    if zoom not in {"coarse", "refined", "combined"}:
        raise ValueError(f"invalid zoom {zoom!r}; expected coarse, refined, or combined")

    scope = app.scope()
    raw_payload = gen_gaps(scope, app.stream)
    order = _active_edge_order(app)
    span_edges = _slice_span_edges(order, from_edge, to_edge)
    all_direct_span_gaps = [
        dict(gap)
        for gap in raw_payload.get("gaps", ())
        if isinstance(gap, dict) and str(gap.get("edge") or "") in span_edges
    ]
    dependent_gaps = (
        collect_declared_obligation_gaps(
            app.config.workspace_root,
            _declared_obligation_specs(app, edge_names=span_edges),
        )
        if include_dependent
        else []
    )
    canonical_gaps = canonical_edge_gaps(
        edge_names=span_edges,
        raw_graph_gaps=all_direct_span_gaps,
        ledger_gaps=dependent_gaps,
    )
    span_raw_payload = {
        **raw_payload,
        "gaps": all_direct_span_gaps,
        "jobs_considered": len(span_edges),
        "total_delta": sum(float(gap.get("delta") or 0.0) for gap in all_direct_span_gaps),
        "converged": not all_direct_span_gaps,
    }
    refined_payload = enrich_gap_snapshot(
        workspace_root=app.config.workspace_root,
        stream=app.stream,
        workflow_version=scope.workflow_version,
        raw_gap_payload=span_raw_payload,
        runtime_config=app.config.runtime_config,
        publish=False,
    )
    summary = aggregate_edge_gap_truth(canonical_gaps)

    result = {
        "analysis_kind": "odd_sdlc.span_gap_analysis",
        "span": {
            "from_edge": from_edge,
            "to_edge": to_edge,
            "selected_edges": span_edges,
            "zoom": zoom,
            "include_dependent": include_dependent,
        },
        "gaps": canonical_gaps,
        "graph_view": {
            "jobs_considered": len(span_edges),
            "total_delta": span_raw_payload["total_delta"],
            "converged": span_raw_payload["converged"],
            "gaps": all_direct_span_gaps,
        },
        "refined_view": refined_payload,
        "summary": {
            **summary,
            "span_converged": summary["converged"],
            "gap_count": len(canonical_gaps),
        },
    }
    result["selected_view"] = result["summary" if zoom == "combined" else ("graph_view" if zoom == "coarse" else "refined_view")]
    return result

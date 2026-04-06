#!/usr/bin/env python
"""Runtime helper for the odd_manager React/Vite tenant."""
from __future__ import annotations

import argparse
import json
import sys
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


def _load_app(workspace_root: Path):
    _configure_imports(workspace_root)
    from odd_sdlc.app import bootstrap, initialize

    return initialize(bootstrap(workspace_root=workspace_root))


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


def _project_graph_set(
    assets: list[dict[str, Any]],
    asset_types: list[dict[str, Any]],
    bindings: list[dict[str, Any]],
    functions: list[dict[str, Any]],
) -> dict[str, Any]:
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

    graph_status = _dominant_status([node["status"] for node in graph_nodes])
    return {
        "id": "graphset.workspace",
        "label": "Workspace Graph Set",
        "status": graph_status,
        "graphs": [
            {
                "id": "graph.bootstrap",
                "label": "Bootstrap Asset Graph",
                "status": graph_status,
                "derivation": "descriptive function catalog inputs and outputs plus explicit bindings",
                "nodes": graph_nodes,
                "segments": graph_segments,
            }
        ],
    }


def _compose_world(workspace_root: Path) -> dict[str, Any]:
    app = _load_app(workspace_root)
    from odd_sdlc.query import query_domain

    domain_payload = query_domain(app)
    events = app.stream.all_events()
    runtime_payload = _project_runtime(events)
    graph_functions = domain_payload.get("graph_functions", [])
    functions = _project_functions(
        domain_payload.get("functions", []),
        graph_functions,
        domain_payload.get("gaps", {}),
        runtime_payload,
    )
    workorders = _project_workorders(
        domain_payload.get("jobs", []),
        graph_functions,
        domain_payload.get("gaps", {}),
        runtime_payload,
    )
    graph_function_registry = _project_graph_functions(graph_functions, workorders)
    graph_set = _project_graph_set(
        domain_payload.get("assets", []),
        domain_payload.get("asset_types", []),
        domain_payload.get("bindings", []),
        functions,
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
    total_gaps = len(domain_payload.get("gaps", {}).get("gaps", []))
    total_delta = float(domain_payload.get("gaps", {}).get("total_delta", 0))
    workorder_status = _dominant_status([workorder["status"] for workorder in workorders])
    overview_status = _dominant_status([graph_set["status"], workorder_status])

    if workorder_status == "blocked":
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
            "total_assets": len(domain_payload.get("assets", [])),
            "total_workorders": len(workorders),
            "total_gaps": total_gaps,
            "active_runs": active_runs,
            "open_continuations": open_continuations,
            "latest_event_time": runtime_payload["latest_event_time"],
        },
        "graph_set": graph_set,
        "domain": {
            **domain_payload,
            "functions": functions,
            "graph_functions": graph_function_registry,
            "workorders": workorders,
        },
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
        result = _compose_world(workspace_root)
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

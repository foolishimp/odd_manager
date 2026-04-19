# Implements: REQ-F-ODDSDLC-003
# Implements: REQ-F-ODDSDLC-004
# Implements: REQ-F-ODDSDLC-020
# Implements: REQ-F-ODDSDLC-027
"""App-owned bootstrap and runtime surface for odd_sdlc."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from genesis.binding import Worker
from genesis.events import EventStream
from genesis.identity import RuntimeIdentity
from genesis.install import workspace_bootstrap
from genesis.services import Scope, gen_gaps, gen_iterate, gen_start

from .analysis import ensure_workspace_ready
from .asset_types import ASSET_TYPES, SEMANTIC_FACETS
from .ambiguity import load_or_build_ambiguity_register
from .function_catalog import FUNCTION_CATALOG
from .gtl_module import module as odd_sdlc_module
from .program_catalog import PROGRAM_CATALOG
from .software_domain_catalog import ASSET_FAMILIES, EDGE_CONTRACTS, WORK_ACT_TYPES
from .span_analysis import aggregate_edge_gap_truth, canonical_edge_gaps, span_gap_analysis
from .traceability import collect_declared_obligation_gaps
from .triage import enrich_gap_snapshot
from .workspace_assets import bootstrap_assets, bootstrap_bindings, bootstrap_input_collection


@dataclass(frozen=True)
class AppConfig:
    workspace_root: Path
    runtime_config: dict[str, Any] = field(default_factory=dict)
    build: str | None = None
    runtime_identity: RuntimeIdentity | None = None
    domain_module: Any | None = None


def _app_module(config: AppConfig):
    return config.domain_module or odd_sdlc_module(config.workspace_root)


def _decl_value(value: Any) -> Any:
    return value.to_dict() if hasattr(value, "to_dict") else value


def _declared_obligation_specs(app: "OddSdlcApp") -> list[tuple[str, dict[str, Any] | Any]]:
    declarations: list[tuple[str, dict[str, Any] | Any]] = []
    for function in app.scope().module.graph_functions:
        graph = function.template.graph
        if graph is None:
            continue
        for vector in graph.vectors:
            declaration = vector.declarations.get("obligation_ledger")
            if declaration is None:
                continue
            declarations.append((vector.name, declaration))
    return declarations


@dataclass
class OddSdlcApp:
    config: AppConfig
    stream: EventStream
    worker: Worker | None = None

    def scope(self) -> Scope:
        return Scope(
            module=_app_module(self.config),
            workspace_root=self.config.workspace_root,
            build=self.config.build,
            worker=self.worker,
            runtime_identity=self.config.runtime_identity,
            runtime_config=self.config.runtime_config,
        )


def bootstrap(
    *,
    workspace_root: str | Path = ".",
    runtime_config: dict[str, Any] | None = None,
    build: str | None = None,
    runtime_identity: RuntimeIdentity | None = None,
    domain_module: Any | None = None,
) -> AppConfig:
    return AppConfig(
        workspace_root=Path(workspace_root).resolve(),
        runtime_config={
            "domain_package": "odd_sdlc",
            **dict(runtime_config or {}),
        },
        build=build,
        runtime_identity=runtime_identity,
        domain_module=domain_module,
    )


def initialize(config: AppConfig, *, worker: Worker | None = None) -> OddSdlcApp:
    stream = workspace_bootstrap(config.workspace_root)
    return OddSdlcApp(config=config, stream=stream, worker=worker)


def active_programs(app: OddSdlcApp) -> list[dict[str, Any]]:
    module = _app_module(app.config)
    active_executive_programs = set(module.metadata.get("executive_graph_functions", ()))
    return [
        entry.to_dict()
        for entry in PROGRAM_CATALOG
        if entry.name in active_executive_programs
    ]


def catalog(app: OddSdlcApp) -> dict:
    module = _app_module(app.config)
    workspace_root = app.config.workspace_root
    active_function_catalog = list(module.metadata.get("function_catalog", FUNCTION_CATALOG))
    active_executive_programs = set(module.metadata.get("executive_graph_functions", ()))
    function_intent_by_name = {}
    for entry in active_function_catalog:
        if isinstance(entry, dict):
            name = entry.get("name")
            intent = entry.get("intent")
        else:
            name = getattr(entry, "name", None)
            intent = getattr(entry, "intent", None)
        if isinstance(name, str):
            function_intent_by_name[name] = intent or ""

    def _node_contract(node) -> dict[str, Any]:
        return {
            "name": node.name,
            "schema": node.schema if isinstance(node.schema, str) else getattr(node.schema, "__name__", repr(node.schema)),
            "asset_surface": node.asset_surface.to_dict(),
        }
    job_names_by_function_id: dict[str, list[str]] = {}
    for job in module.jobs:
        for contract in job.contracts:
            if contract.kind != "graph_function":
                continue
            job_names_by_function_id.setdefault(contract.target_id, []).append(job.name)
    return {
        "workspace_root": str(workspace_root),
        "semantic_facets": [facet.to_dict() for facet in SEMANTIC_FACETS.values()],
        "asset_types": [profile.to_dict() for profile in ASSET_TYPES.values()],
        "asset_families": [descriptor.to_dict() for descriptor in ASSET_FAMILIES],
        "work_act_types": [descriptor.to_dict() for descriptor in WORK_ACT_TYPES],
        "assets": [asset.to_dict() for asset in bootstrap_assets(workspace_root)],
        "ambiguity_register": load_or_build_ambiguity_register(workspace_root),
        "collections": [bootstrap_input_collection(workspace_root).to_dict()],
        "bindings": [binding.to_dict() for binding in bootstrap_bindings(workspace_root)],
        "functions": [
            entry.to_dict() if hasattr(entry, "to_dict") else entry
            for entry in active_function_catalog
        ],
        "edge_contracts": [descriptor.to_dict() for descriptor in EDGE_CONTRACTS],
        "programs": active_programs(app),
        "graph_functions": [
            {
                "id": function.id,
                "name": function.name,
                "intent": function_intent_by_name.get(function.name, function.declarations.get("intent", "")),
                "function_kind": function.declarations.get("function_kind"),
                "plugin_kind": function.declarations.get("plugin_kind"),
                "harness_kind": function.declarations.get("harness_kind"),
                "harness_contract": _decl_value(function.declarations.get("harness_contract")),
                "harness_implementation": _decl_value(function.declarations.get("harness_implementation")),
                "host_binding_of": function.declarations.get("host_binding_of"),
                "host_binding_kind": function.declarations.get("host_binding_kind"),
                "host_subject_asset": function.declarations.get("host_subject_asset"),
                "host_reviewed_asset": function.declarations.get("host_reviewed_asset"),
                "obligation_ledger": _decl_value(function.declarations.get("obligation_ledger")),
                "template_kind": function.template.kind,
                "tags": list(function.tags),
                "inputs": [node.name for node in function.inputs],
                "outputs": [node.name for node in function.outputs],
                "input_contracts": [_node_contract(node) for node in function.inputs],
                "output_contracts": [_node_contract(node) for node in function.outputs],
                "environment": {
                    "requires": [node.name for node in function.environment.requires],
                    "provides": [node.name for node in function.environment.provides],
                    "carries": [node.name for node in function.environment.carries],
                },
                "vectors": [
                    {
                        "name": vector.name,
                        "source": [
                            node.name
                            for node in (
                                vector.source
                                if isinstance(vector.source, tuple)
                                else (vector.source,)
                            )
                        ],
                        "target": vector.target.name,
                        "obligation_ledger": _decl_value(vector.declarations.get("obligation_ledger")),
                    }
                    for vector in (
                        function.template.graph.vectors
                        if function.template.graph is not None
                        else ()
                    )
                ],
                "job_names": job_names_by_function_id.get(function.id, []),
            }
            for function in module.graph_functions
        ],
        "jobs": [
            {
                "name": job.name,
                "contracts": [
                    {
                        "kind": contract.kind,
                        "target_id": contract.target_id,
                    }
                    for contract in job.contracts
                ],
            }
            for job in module.jobs
        ],
    }


def gaps(
    app: OddSdlcApp,
    *,
    from_edge: str | None = None,
    to_edge: str | None = None,
    zoom: str = "combined",
    include_dependent: bool = False,
) -> dict:
    if from_edge is not None or to_edge is not None:
        if not from_edge or not to_edge:
            raise ValueError("span gap analysis requires both from_edge and to_edge")
        return span_gap_analysis(
            app,
            from_edge=from_edge,
            to_edge=to_edge,
            zoom=zoom,
            include_dependent=include_dependent,
        )
    scope = app.scope()
    raw_payload = gen_gaps(scope, app.stream)
    payload = enrich_gap_snapshot(
        workspace_root=app.config.workspace_root,
        stream=app.stream,
        workflow_version=scope.workflow_version,
        raw_gap_payload=raw_payload,
        runtime_config=app.config.runtime_config,
        publish=True,
    )
    raw_graph_gaps = [
        dict(gap)
        for gap in payload.get("gaps", ())
        if isinstance(gap, dict)
    ]
    declared_obligation_ledgers = collect_declared_obligation_gaps(
        app.config.workspace_root,
        _declared_obligation_specs(app),
    )
    canonical_gaps = canonical_edge_gaps(
        edge_names=[entry[0] for entry in _declared_obligation_specs(app)],
        raw_graph_gaps=raw_graph_gaps,
        ledger_gaps=declared_obligation_ledgers,
    )
    summary = aggregate_edge_gap_truth(canonical_gaps)
    payload["gaps"] = canonical_gaps
    payload["graph_total_delta"] = summary["graph_total_delta"]
    payload["direct_graph_delta"] = summary["direct_graph_delta"]
    payload["carry_delta"] = summary["carry_delta"]
    payload["fulfillment_delta"] = summary["fulfillment_delta"]
    payload["combined_delta"] = summary["combined_delta"]
    payload["total_delta"] = summary["total_delta"]
    payload["graph_converged"] = summary["graph_converged"]
    payload["carry_converged"] = summary["carry_converged"]
    payload["fulfillment_converged"] = summary["fulfillment_converged"]
    payload["converged"] = summary["converged"]
    return payload


def gap_snapshot(app: OddSdlcApp) -> dict:
    scope = app.scope()
    raw_payload = gen_gaps(scope, app.stream)
    payload = enrich_gap_snapshot(
        workspace_root=app.config.workspace_root,
        stream=app.stream,
        workflow_version=scope.workflow_version,
        raw_gap_payload=raw_payload,
        runtime_config=app.config.runtime_config,
        publish=False,
    )
    raw_graph_gaps = [
        dict(gap)
        for gap in payload.get("gaps", ())
        if isinstance(gap, dict)
    ]
    declared_obligation_ledgers = collect_declared_obligation_gaps(
        app.config.workspace_root,
        _declared_obligation_specs(app),
    )
    canonical_gaps = canonical_edge_gaps(
        edge_names=[entry[0] for entry in _declared_obligation_specs(app)],
        raw_graph_gaps=raw_graph_gaps,
        ledger_gaps=declared_obligation_ledgers,
    )
    summary = aggregate_edge_gap_truth(canonical_gaps)
    payload["gaps"] = canonical_gaps
    payload["graph_total_delta"] = summary["graph_total_delta"]
    payload["direct_graph_delta"] = summary["direct_graph_delta"]
    payload["carry_delta"] = summary["carry_delta"]
    payload["fulfillment_delta"] = summary["fulfillment_delta"]
    payload["combined_delta"] = summary["combined_delta"]
    payload["total_delta"] = summary["total_delta"]
    payload["graph_converged"] = summary["graph_converged"]
    payload["carry_converged"] = summary["carry_converged"]
    payload["fulfillment_converged"] = summary["fulfillment_converged"]
    payload["converged"] = summary["converged"]
    return payload


def iterate(app: OddSdlcApp) -> dict:
    return gen_iterate(app.scope(), app.stream)


def start(app: OddSdlcApp, *, auto: bool = False) -> dict:
    ensure_workspace_ready(app.config.workspace_root)
    return gen_start(app.scope(), app.stream, auto=auto)

"""Example app-owned bootstrap and initialization surface.

This file is a starting example. It is not part of GTL or ABG core.

Use it to keep app bootstrap and runtime binding explicit:

- bootstrap creates the app configuration boundary
- initialize binds a published GTL module to the ABG runtime
- gaps / iterate / start expose the engine through app-owned functions
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from gtl.module_model import Module

from genesis.binding import Worker
from genesis.events import EventStream
from genesis.install import workspace_bootstrap
from genesis.services import Scope, gen_gaps, gen_iterate, gen_start


@dataclass(frozen=True)
class AppConfig:
    workspace_root: Path
    runtime_config: dict[str, Any] = field(default_factory=dict)
    build: str | None = None


@dataclass
class GraphFunctionApp:
    config: AppConfig
    module: Module
    stream: EventStream
    worker: Worker | None = None

    def scope(self) -> Scope:
        return Scope(
            module=self.module,
            workspace_root=self.config.workspace_root,
            build=self.config.build,
            worker=self.worker,
            runtime_config=self.config.runtime_config,
        )


def bootstrap(
    *,
    workspace_root: str | Path = ".",
    runtime_config: dict[str, Any] | None = None,
    build: str | None = None,
) -> AppConfig:
    return AppConfig(
        workspace_root=Path(workspace_root).resolve(),
        runtime_config=dict(runtime_config or {}),
        build=build,
    )


def initialize(module: Module, config: AppConfig, *, worker: Worker | None = None) -> GraphFunctionApp:
    stream = workspace_bootstrap(config.workspace_root)
    return GraphFunctionApp(config=config, module=module, stream=stream, worker=worker)


def gaps(app: GraphFunctionApp) -> dict:
    return gen_gaps(app.scope(), app.stream)


def iterate(app: GraphFunctionApp) -> dict:
    return gen_iterate(app.scope(), app.stream)


def start(app: GraphFunctionApp, *, auto: bool = False) -> dict:
    return gen_start(app.scope(), app.stream, auto=auto)

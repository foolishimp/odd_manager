# Implements: REQ-L-GTL3-ATTRS
# Implements: REQ-L-GTL3-CONTEXT
# Implements: REQ-L-GTL3-GRAPH
# Implements: REQ-L-GTL3-NODE
# Implements: REQ-L-GTL3-GRAPHVECTOR
# Implements: REQ-L-GTL3-INTERFACE
# Implements: REQ-L-GTL3-IDENTITY
"""
gtl.graph — Graph structure primitives.

Graph is the one first-class structural type. Node[T] is the typed local
locus. GraphVector is the internal adjacency record (not public ontology).

No external dependencies. Dataclasses + stdlib only.
"""
from __future__ import annotations

import uuid
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass, field
from typing import Any


def _mint_id() -> str:
    """Auto-mint an opaque identity for a first-class GTL type."""
    return str(uuid.uuid4())


def _schema_key(schema: type | str) -> str:
    """Render one schema reference into a stable structural key."""
    if isinstance(schema, str):
        return schema
    module = getattr(schema, "__module__", "")
    qualname = getattr(schema, "__qualname__", getattr(schema, "__name__", repr(schema)))
    return f"{module}.{qualname}" if module else qualname


@dataclass(frozen=True)
class Attr:
    """Immutable key/value attribute for public GTL metadata surfaces."""
    key: str
    value: Any


_REPLAYABLE_SCALAR_TYPES = (str, int, float, bool, type(None))
_REPLAYABLE_GTL_DECL_TYPES = {
    ("gtl.graph", "Node"),
    ("gtl.graph", "GraphVector"),
    ("gtl.function_model", "GraphFunction"),
    ("gtl.function_model", "RefinementBoundary"),
    ("gtl.function_model", "CandidateFamily"),
}


def _is_replayable_gtl_decl(value: Any) -> bool:
    value_type = type(value)
    return (value_type.__module__, value_type.__name__) in _REPLAYABLE_GTL_DECL_TYPES


def _validate_attr_value(value: Any, *, path: str) -> None:
    if isinstance(value, _REPLAYABLE_SCALAR_TYPES):
        return
    if isinstance(value, Attrs):
        for entry in value.entries:
            _validate_attr_value(entry.value, path=f"{path}.{entry.key}")
        return
    if _is_replayable_gtl_decl(value):
        return
    if isinstance(value, Mapping):
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError(f"Attrs values require string mapping keys at {path}, got {key!r}")
            _validate_attr_value(item, path=f"{path}.{key}")
        return
    if isinstance(value, tuple):
        for index, item in enumerate(value):
            _validate_attr_value(item, path=f"{path}[{index}]")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _validate_attr_value(item, path=f"{path}[{index}]")
        return
    raise TypeError(
        f"Attrs values must be replayable declaration data at {path}; "
        f"got {type(value).__module__}.{type(value).__name__}"
    )


def _coerce_attr_entries(value: Any) -> tuple[Attr, ...]:
    if value is None:
        return ()
    if isinstance(value, Attrs):
        return value.entries
    if isinstance(value, Mapping):
        return tuple(Attr(str(k), v) for k, v in value.items())
    if isinstance(value, tuple):
        entries = value
    elif isinstance(value, Iterable) and not isinstance(value, (str, bytes)):
        entries = tuple(value)
    else:
        raise TypeError(f"Cannot coerce {value!r} into Attrs")

    coerced: list[Attr] = []
    for item in entries:
        if isinstance(item, Attr):
            coerced.append(item)
        elif isinstance(item, tuple) and len(item) == 2:
            key, attr_value = item
            coerced.append(Attr(str(key), attr_value))
        else:
            raise TypeError(f"Invalid Attr entry: {item!r}")
    return tuple(coerced)


@dataclass(frozen=True)
class Attrs(Mapping[str, Any]):
    """Immutable ordered mapping for prime GTL metadata/config surfaces."""
    entries: tuple[Attr, ...] = ()

    def __post_init__(self) -> None:
        coerced = _coerce_attr_entries(self.entries)
        seen: set[str] = set()
        for entry in coerced:
            if entry.key in seen:
                raise ValueError(f"Duplicate Attr key: {entry.key!r}")
            seen.add(entry.key)
            _validate_attr_value(entry.value, path=entry.key)
        object.__setattr__(self, "entries", coerced)

    @classmethod
    def coerce(cls, value: Any) -> "Attrs":
        if isinstance(value, cls):
            return value
        return cls(entries=_coerce_attr_entries(value))

    def __getitem__(self, key: str) -> Any:
        for entry in self.entries:
            if entry.key == key:
                return entry.value
        raise KeyError(key)

    def __iter__(self) -> Iterator[str]:
        for entry in self.entries:
            yield entry.key

    def __len__(self) -> int:
        return len(self.entries)

    def items(self) -> tuple[tuple[str, Any], ...]:
        return tuple((entry.key, entry.value) for entry in self.entries)

    def values(self) -> tuple[Any, ...]:
        return tuple(entry.value for entry in self.entries)

    def get(self, key: str, default: Any = None) -> Any:
        try:
            return self[key]
        except KeyError:
            return default

    def to_dict(self) -> dict[str, Any]:
        return dict(self.items())


# ── Context ───────────────────────────────────────────────────────────────

_CONTEXT_SCHEMES = ("git://", "workspace://", "event://", "registry://")


@dataclass(frozen=True)
class Context:
    """
    Externally-located, snapshot-bound constraint dimension.

    locator: URI using a known scheme — used for discovery and retrieval.
    digest: sha256 content hash — the constitutional binding for replay.
    """
    name: str
    locator: str
    digest: str

    def __post_init__(self):
        if not self.digest.startswith("sha256:"):
            raise ValueError(f"Context.digest must start with 'sha256:': {self.digest!r}")
        if not any(self.locator.startswith(s) for s in _CONTEXT_SCHEMES):
            raise ValueError(
                f"Context.locator must use a known scheme {_CONTEXT_SCHEMES}: {self.locator!r}"
            )


# ── Node ─────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Node:
    """
    Typed local locus within a graph.

    schema: type reference or URI string — supports both concrete Python
    types and string references (e.g. "Vector[intent]").

    markov: declarative state/acceptance conditions at this locus.
    Constitutional vocabulary, not runtime metadata.

    id: opaque identity. Auto-minted.
    compare=False: structural equality ignores id.
    """
    name: str
    schema: type | str = ""
    markov: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    id: str = field(default_factory=_mint_id, compare=False)


def node_contract_key(node: Node) -> tuple[str, str, tuple[str, ...]]:
    """Stable structural contract key for interface matching."""
    return (node.name, _schema_key(node.schema), tuple(node.markov))


def interface_contract(nodes: tuple[Node, ...]) -> tuple[tuple[str, str, tuple[str, ...]], ...]:
    """Stable structural contract for an ordered node interface."""
    return tuple(node_contract_key(node) for node in nodes)


# ── GraphVector (internal adjacency record) ──────────────────────────────

@dataclass(frozen=True)
class GraphVector:
    """
    Internal adjacency record and invariant traversal declaration surface.

    Represents a directed step between typed nodes, carrying local
    operator/evaluator metadata and transition-governance declarations.
    Used by the engine for scheduling, binding, substitution, and replay.

    id: opaque identity. Auto-minted.
    compare=False: structural equality ignores id.
    """
    name: str
    source: Node | tuple[Node, ...] = None  # type: ignore[assignment]
    target: Node = None                      # type: ignore[assignment]
    operators: tuple = ()
    evaluators: tuple = ()
    contexts: tuple[Context, ...] = ()
    rule: Any = None
    allows_subwork: bool = False
    declarations: Attrs = field(default_factory=Attrs)
    tags: tuple[str, ...] = ()
    id: str = field(default_factory=_mint_id, compare=False)

    def __post_init__(self) -> None:
        if self.source is None:
            raise ValueError(f"GraphVector({self.name!r}) requires a non-empty source")
        if isinstance(self.source, tuple):
            if not self.source:
                raise ValueError(f"GraphVector({self.name!r}) requires at least one source node")
            if any(node is None for node in self.source):
                raise ValueError(f"GraphVector({self.name!r}) source tuple must not contain None")
        if self.target is None:
            raise ValueError(f"GraphVector({self.name!r}) requires a target node")
        object.__setattr__(self, "declarations", Attrs.coerce(self.declarations))


# ── Graph ─────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Graph:
    """
    The one first-class structural type in GTL 3.

    All workflow structure is graph: a primitive edge, a multi-step workflow,
    a subgraph, a reusable workflow, a refined workflow.

    Frozen, immutable value type with name, inputs, outputs, nodes, vectors,
    contexts, rules, effects, and tags.

    id: opaque identity. Auto-minted.
    compare=False: structural equality ignores id.
    """
    name: str
    inputs: tuple[Node, ...] = ()
    outputs: tuple[Node, ...] = ()
    nodes: tuple[Node, ...] = ()
    vectors: tuple[GraphVector, ...] = ()
    contexts: tuple[Context, ...] = ()
    rules: tuple = ()
    effects: tuple = ()
    tags: tuple[str, ...] = ()
    id: str = field(default_factory=_mint_id, compare=False)

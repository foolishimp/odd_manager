# Implements: REQ-L-GTL3-GRAPHFUNCTION
# Implements: REQ-L-GTL3-HOOKS
# Implements: REQ-L-GTL3-SYNTHESIS
# Implements: REQ-L-GTL3-SELECTION-BOUNDARY
# Implements: REQ-L-GTL3-IDENTITY
"""
gtl.function_model — Reusable workflow programs and structural alternatives.

GraphFunction is the primary reusable GTL compute abstraction.
RefinementBoundary declares lawful synthesis/refinement points.
CandidateFamily declares named families of lawful structural alternatives.

No external dependencies. Dataclasses + stdlib only.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from gtl.graph import Attrs, Graph, Node, _mint_id, interface_contract


@dataclass(frozen=True)
class TemplateRef:
    """
    Replayable template reference for graph-function publication truth.

    inline_graph: embeds one immutable graph value for direct GTL tests and
    purely declarative composition. symbolic: stable named reference resolved
    later by an interpreter/materializer.
    """
    kind: str
    ref: str
    graph: Graph | None = None
    version: str | None = None

    @classmethod
    def inline_graph(cls, graph: Graph, *, ref: str = "") -> "TemplateRef":
        return cls(kind="inline_graph", ref=ref or graph.name, graph=graph)

    @classmethod
    def symbolic(cls, ref: str, *, version: str | None = None) -> "TemplateRef":
        if not ref:
            raise ValueError("TemplateRef.symbolic() requires a non-empty ref")
        return cls(kind="symbolic", ref=ref, version=version)

    def __post_init__(self) -> None:
        if self.kind == "inline_graph":
            if self.graph is None:
                raise ValueError("TemplateRef(kind='inline_graph') requires graph")
        elif self.kind == "symbolic":
            if self.graph is not None:
                raise ValueError("TemplateRef(kind='symbolic') must not embed graph")
        else:
            raise ValueError(f"Unsupported TemplateRef.kind: {self.kind!r}")

    def materialize(self) -> Graph:
        if self.kind == "inline_graph" and self.graph is not None:
            return self.graph
        raise ValueError(f"TemplateRef {self.ref!r} is symbolic and not directly materializable")


def _coerce_template(template: Any, *, name: str) -> TemplateRef:
    if isinstance(template, TemplateRef):
        return template
    if isinstance(template, Graph):
        return TemplateRef.inline_graph(template, ref=f"inline:{name}")
    if isinstance(template, str):
        return TemplateRef.symbolic(template or f"symbolic:{name}")
    if callable(template):
        graph = template()
        if not isinstance(graph, Graph):
            raise TypeError(
                f"GraphFunction({name!r}) callable template must materialize Graph, got {type(graph)!r}"
            )
        return TemplateRef.inline_graph(graph, ref=f"inline:{name}")
    raise TypeError(f"Unsupported GraphFunction.template: {template!r}")


@dataclass(frozen=True)
class GraphFunction:
    """
    Reusable named workflow abstraction — materializable graph template.

    template: replayable template reference. Raw callables are coerced at
    construction into inline graph references and do not remain the published
    surface.

    id: opaque identity. Auto-minted.
    compare=False: structural equality ignores id.
    """
    name: str
    inputs: tuple[Node, ...] = ()
    outputs: tuple[Node, ...] = ()
    template: TemplateRef | Graph | str | Callable[[], Graph] = ""
    effects: tuple = ()
    declarations: Attrs = field(default_factory=Attrs)
    tags: tuple[str, ...] = ()
    id: str = field(default_factory=_mint_id, compare=False)

    @classmethod
    def from_graph(
        cls,
        *,
        name: str,
        graph: Graph,
        inputs: tuple[Node, ...] = (),
        outputs: tuple[Node, ...] = (),
        effects: tuple = (),
        declarations: Attrs = Attrs(),
        tags: tuple[str, ...] = (),
    ) -> "GraphFunction":
        return cls(
            name=name,
            inputs=inputs or graph.inputs,
            outputs=outputs or graph.outputs,
            template=TemplateRef.inline_graph(graph, ref=f"inline:{name}"),
            effects=effects,
            declarations=declarations,
            tags=tags,
        )

    @classmethod
    def symbolic(
        cls,
        *,
        name: str,
        ref: str,
        inputs: tuple[Node, ...] = (),
        outputs: tuple[Node, ...] = (),
        effects: tuple = (),
        declarations: Attrs = Attrs(),
        tags: tuple[str, ...] = (),
        version: str | None = None,
    ) -> "GraphFunction":
        return cls(
            name=name,
            inputs=inputs,
            outputs=outputs,
            template=TemplateRef.symbolic(ref, version=version),
            effects=effects,
            declarations=declarations,
            tags=tags,
        )

    def __post_init__(self) -> None:
        template = _coerce_template(self.template, name=self.name)
        object.__setattr__(self, "template", template)
        object.__setattr__(self, "declarations", Attrs.coerce(self.declarations))
        if template.kind == "inline_graph":
            self._validate_outer_contract(template.graph)

    def _validate_outer_contract(self, graph: Graph | None) -> None:
        if graph is None:
            return
        if interface_contract(graph.inputs) != interface_contract(self.inputs):
            raise ValueError(
                f"GraphFunction({self.name!r}) inline graph inputs do not preserve outer contract"
            )
        if interface_contract(graph.outputs) != interface_contract(self.outputs):
            raise ValueError(
                f"GraphFunction({self.name!r}) inline graph outputs do not preserve outer contract"
            )

    def materialize(self) -> Graph:
        graph = self.template.materialize()
        self._validate_outer_contract(graph)
        return graph


@dataclass(frozen=True)
class RefinementBoundary:
    """
    Explicit lawful refinement/synthesis boundary over a stable outer contract.

    Declares a point where consumer logic can produce or select an
    interface-compatible inner graph. Contains no executable selection
    or synthesis logic.

    Declarative surface for deferred synthesis over a stable outer contract.
    """
    name: str
    inputs: tuple[Node, ...] = ()
    outputs: tuple[Node, ...] = ()
    hints: Attrs = field(default_factory=Attrs)
    tags: tuple[str, ...] = ()
    id: str = field(default_factory=_mint_id, compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "hints", Attrs.coerce(self.hints))


@dataclass(frozen=True)
class CandidateFamily:
    """
    Named family of lawful structural alternatives for one outer contract.

    Every candidate must share the declared inputs/outputs contract.
    Candidate order is preserved and publishable.
    policy_hints are visible to evaluators but do not choose a candidate.

    Fail-closed: empty candidates or contract mismatch raises at construction.

    Explicit structural alternatives without hidden choice.
    """
    name: str
    inputs: tuple[Node, ...] = ()
    outputs: tuple[Node, ...] = ()
    candidates: tuple[GraphFunction, ...] = ()
    policy_hints: Attrs = field(default_factory=Attrs)
    tags: tuple[str, ...] = ()
    id: str = field(default_factory=_mint_id, compare=False)

    def __post_init__(self):
        object.__setattr__(self, "policy_hints", Attrs.coerce(self.policy_hints))
        if not self.candidates:
            raise ValueError(
                f"CandidateFamily({self.name!r}): empty candidates"
            )
        family_in = interface_contract(self.inputs)
        family_out = interface_contract(self.outputs)
        for c in self.candidates:
            c_in = interface_contract(c.inputs)
            c_out = interface_contract(c.outputs)
            if c_in != family_in or c_out != family_out:
                raise ValueError(
                    f"CandidateFamily({self.name!r}): candidate {c.name!r} "
                    f"contract ({c_in!r}->{c_out!r}) does not match "
                    f"family contract ({family_in!r}->{family_out!r})"
                )

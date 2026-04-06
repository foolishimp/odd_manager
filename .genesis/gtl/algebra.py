# Implements: REQ-L-GTL3-COMPOSE
# Implements: REQ-L-GTL3-SUBSTITUTE
# Implements: REQ-L-GTL3-RECURSE
# Implements: REQ-L-GTL3-HOF
# Implements: REQ-L-GTL3-HOOKS
# Implements: REQ-L-GTL3-SYNTHESIS
# Implements: REQ-L-GTL3-SELECTION-BOUNDARY
# Implements: REQ-L-GTL3-LAWS
# Implements: REQ-L-GTL3-IDENTITY
"""
gtl.algebra — Graph algebra: composition, substitution, identity,
              higher-order operators, and DSL sugar.

Pure functions over GTL graph types. No engine/runtime dependency.
"""
from __future__ import annotations

from gtl.graph import Attrs, Graph, Node, GraphVector, node_contract_key
from gtl.function_model import CandidateFamily, GraphFunction, RefinementBoundary, TemplateRef
from gtl.operator_model import Evaluator, Rule


def same_object(a, b) -> bool:
    """Identity equality — same .id."""
    return a.id == b.id


def _stable_union(*tuples: tuple) -> tuple:
    """Stable left-to-right union preserving first occurrence order."""
    seen = []
    for values in tuples:
        for value in values:
            if value not in seen:
                seen.append(value)
    return tuple(seen)


def _is_vector_boundary(node: Node) -> bool:
    """True when a node explicitly declares a Vector[...] representation."""
    schema = node.schema
    return isinstance(schema, str) and schema.strip().startswith("Vector[") and schema.strip().endswith("]")


def _merge_attrs(*values: Attrs) -> Attrs:
    merged: dict[str, object] = {}
    for attrs in values:
        for key, value in attrs.items():
            if key in merged and merged[key] != value:
                raise ValueError(f"Conflicting structured declaration for {key!r}")
            merged[key] = value
    return Attrs.coerce(merged)


def _node_contract_map(nodes: tuple[Node, ...]) -> dict[str, tuple[str, str, tuple[str, ...]]]:
    return {node.name: node_contract_key(node) for node in nodes}


def _evaluator_decl(evaluator: Evaluator) -> dict[str, object]:
    return {
        "name": evaluator.name,
        "regime": evaluator.regime.__name__,
        "binding": evaluator.binding,
        "description": evaluator.description,
    }


def _foldback_decl(foldback: Attrs | dict[str, object]) -> Attrs:
    attrs = Attrs.coerce(foldback)
    mode = attrs.get("mode", "rebind")
    binding = attrs.get("binding")
    if mode != "rebind":
        raise ValueError(
            "recurse(..., foldback=...): foldback.mode must be 'rebind'"
        )
    if not binding:
        raise ValueError(
            "recurse(..., foldback=...): foldback.binding is required"
        )
    if attrs.get("requires_parent_evaluation") is not True:
        raise ValueError(
            "recurse(..., foldback=...): foldback.requires_parent_evaluation must be True"
        )
    return Attrs.coerce(
        {
            "mode": mode,
            "binding": binding,
            "requires_parent_evaluation": True,
            **{
                key: value
                for key, value in attrs.items()
                if key not in {"mode", "binding", "requires_parent_evaluation"}
            },
        }
    )


def _rule_decl(rule: Rule) -> dict[str, object]:
    return {
        "name": rule.name,
        "kind": rule.kind,
        "config": rule.config.to_dict(),
    }


def edge(source: Node, target: Node, *, operators=(), evaluators=(), **kw) -> Graph:
    """Construct a minimal one-vector graph (DSL sugar)."""
    vector = GraphVector(
        name=f"{source.name}→{target.name}",
        source=source,
        target=target,
        operators=operators,
        evaluators=evaluators,
        **kw,
    )
    return Graph(
        name=f"{source.name}→{target.name}",
        inputs=(source,),
        outputs=(target,),
        nodes=(source, target),
        vectors=(vector,),
    )


def _materialize(gf: GraphFunction) -> Graph:
    """Materialize a GraphFunction's template into a Graph."""
    return gf.materialize()


# ── Composition ──────────────────────────────────────────────────────────────


def _compose_pair(f: GraphFunction, g: GraphFunction) -> GraphFunction:
    """Binary composition: f;g where f.outputs satisfy g.inputs."""
    f_output_contracts = _node_contract_map(f.outputs)
    g_input_contracts = _node_contract_map(g.inputs)

    missing = set(g_input_contracts) - set(f_output_contracts)
    if missing:
        raise ValueError(
            f"compose({f.name}, {g.name}): g.inputs not satisfied by f.outputs — "
            f"missing: {sorted(missing)}"
        )
    mismatched = sorted(
        name
        for name, contract in g_input_contracts.items()
        if f_output_contracts.get(name) != contract
    )
    if mismatched:
        raise ValueError(
            f"compose({f.name}, {g.name}): g.inputs not structurally satisfied by f.outputs — "
            f"mismatched: {mismatched}"
        )

    g_output_contracts = _node_contract_map(g.outputs)
    pass_throughs = set(g_input_contracts) & set(g_output_contracts)
    duplicates = (set(f_output_contracts) & set(g_output_contracts)) - pass_throughs
    if duplicates:
        raise ValueError(
            f"compose({f.name}, {g.name}): duplicate output names: {sorted(duplicates)}"
        )

    try:
        fg = _materialize(f)
        gg = _materialize(g)
    except ValueError:
        template = TemplateRef.symbolic(f"compose:{f.template.ref};{g.template.ref}")
    else:
        node_map = {n.name: n for n in fg.nodes}
        for n in gg.nodes:
            if n.name not in node_map:
                node_map[n.name] = n
        all_vectors = fg.vectors + gg.vectors
        ctx_map = {c.name: c for c in fg.contexts}
        for c in gg.contexts:
            if c.name not in ctx_map:
                ctx_map[c.name] = c
        template = TemplateRef.inline_graph(
            Graph(
                name=f"{f.name};{g.name}",
                inputs=fg.inputs,
                outputs=gg.outputs,
                nodes=tuple(node_map.values()),
                vectors=tuple(all_vectors),
                contexts=tuple(ctx_map.values()),
            ),
            ref=f"compose:{f.name};{g.name}",
        )

    return GraphFunction(
        name=f"{f.name};{g.name}",
        inputs=f.inputs,
        outputs=g.outputs,
        template=template,
        effects=_stable_union(f.effects, g.effects),
        declarations=_merge_attrs(f.declarations, g.declarations),
        tags=_stable_union(f.tags, g.tags),
    )


def compose(*functions: GraphFunction) -> GraphFunction:
    """Variadic left-folded composition. Requires at least two functions.

    compose(f, g, h) == compose(compose(f, g), h)
    """
    if len(functions) < 2:
        raise ValueError(
            f"compose() requires at least 2 functions, got {len(functions)}"
        )
    result = functions[0]
    for fn in functions[1:]:
        result = _compose_pair(result, fn)
    return result


# ── Substitution ─────────────────────────────────────────────────────────────


def substitute(outer: Graph, contract_vector: str, inner: Graph) -> Graph:
    """Replace a coarse contract vector with an interface-compatible inner graph.

    contract_vector: the .id of the target vector.
    Id-only — no name fallback.
    """
    target_vec = None
    for v in outer.vectors:
        if v.id == contract_vector:
            target_vec = v
            break
    if target_vec is None:
        raise ValueError(
            f"substitute(): vector {contract_vector!r} not found in graph {outer.name!r}"
        )

    inner_input_contracts = {
        node_contract_key(node)
        for node in inner.inputs
    }
    if isinstance(target_vec.source, tuple):
        vec_source_contracts = {node_contract_key(node) for node in target_vec.source}
    elif target_vec.source is not None:
        vec_source_contracts = {node_contract_key(target_vec.source)}
    else:
        vec_source_contracts = set()
    if not inner_input_contracts <= vec_source_contracts:
        raise ValueError(
            f"substitute(): inner.inputs {sorted(inner_input_contracts)!r} not subset of "
            f"vector source {sorted(vec_source_contracts)!r}"
        )

    inner_output_contracts = {node_contract_key(node) for node in inner.outputs}
    vec_target_contract = node_contract_key(target_vec.target) if target_vec.target else None
    if vec_target_contract is not None and vec_target_contract not in inner_output_contracts:
        raise ValueError(
            f"substitute(): vector target {vec_target_contract!r} not in "
            f"inner.outputs {sorted(inner_output_contracts)!r}"
        )

    merged_vectors_list = []
    for vector in outer.vectors:
        if vector.id == target_vec.id:
            merged_vectors_list.extend(inner.vectors)
        else:
            merged_vectors_list.append(vector)
    merged_vectors = tuple(merged_vectors_list)

    outer_node_names = {n.name for n in outer.nodes}
    extra_nodes = tuple(n for n in inner.nodes if n.name not in outer_node_names)
    merged_nodes = outer.nodes + extra_nodes

    outer_ctx_names = {c.name for c in outer.contexts}
    extra_contexts = tuple(c for c in inner.contexts if c.name not in outer_ctx_names)
    merged_contexts = outer.contexts + extra_contexts

    return Graph(
        name=outer.name,
        inputs=outer.inputs,
        outputs=outer.outputs,
        nodes=merged_nodes,
        vectors=merged_vectors,
        contexts=merged_contexts,
        rules=outer.rules,
        effects=outer.effects,
        tags=outer.tags + (f"substituted:{target_vec.name}",),
    )


# ── Identity ─────────────────────────────────────────────────────────────────


def identity(interface: tuple[Node, ...]) -> GraphFunction:
    """Identity function — neutral element under composition."""
    return GraphFunction(
        name="id",
        inputs=interface,
        outputs=interface,
    )


# ── Recursion ────────────────────────────────────────────────────────────────


def recurse(
    graph_function: GraphFunction,
    termination: Evaluator,
    *,
    foldback: Attrs | dict[str, object],
) -> GraphFunction:
    """Express repeated graph-function application under declared recursion law.

    Returns a GraphFunction with the same outer contract. Recursion is
    bounded by the termination evaluator, and fold-back must declare how child
    return material lawfully re-binds into the parent contract. ABG owns the
    execution loop.
    """
    foldback_decl = _foldback_decl(foldback)
    return GraphFunction(
        name=f"recurse({graph_function.name})",
        inputs=graph_function.inputs,
        outputs=graph_function.outputs,
        template=graph_function.template,
        effects=graph_function.effects,
        declarations=_merge_attrs(
            graph_function.declarations,
            Attrs.coerce(
                {
                    "recursion": {
                        "termination": _evaluator_decl(termination),
                        "foldback": foldback_decl,
                    }
                }
            ),
        ),
        tags=_stable_union(
            graph_function.tags,
            (f"termination:{termination.name}", f"foldback:{foldback_decl['binding']}"),
        ),
    )


# ── Higher-Order Operators ───────────────────────────────────────────────────


def fan_out(f: GraphFunction, *, over: Node) -> GraphFunction:
    """Apply f across an explicit Vector[T] boundary.

    over is mandatory — no hidden inference of cardinality.
    Returns a GraphFunction whose outer contract is vectorized relative to f.
    """
    if not _is_vector_boundary(over):
        raise ValueError(
            f"fan_out({f.name}): over must declare an explicit Vector[...] boundary, got {over.schema!r}"
        )

    return GraphFunction(
        name=f"fan_out({f.name})",
        inputs=(over,),
        outputs=(over,),
        template=f.template,
        effects=f.effects,
        declarations=f.declarations,
        tags=_stable_union(f.tags, (f"over:{over.name}",)),
    )


def fan_in(reducer: GraphFunction, *, over: Node) -> GraphFunction:
    """Reduce an explicit vector boundary into one synthesized result.

    over is mandatory — no hidden inference.
    """
    if not _is_vector_boundary(over):
        raise ValueError(
            f"fan_in({reducer.name}): over must declare an explicit Vector[...] boundary, got {over.schema!r}"
        )

    return GraphFunction(
        name=f"fan_in({reducer.name})",
        inputs=(over,),
        outputs=reducer.outputs,
        template=reducer.template,
        effects=reducer.effects,
        declarations=reducer.declarations,
        tags=_stable_union(reducer.tags, (f"over:{over.name}",)),
    )


def gate(
    target: GraphFunction | RefinementBoundary | CandidateFamily,
    *,
    rule: Rule,
    evaluators: tuple[Evaluator, ...],
) -> GraphFunction:
    """Block continuation behind rule + evaluators over an explicit boundary.

    target may be a GraphFunction, RefinementBoundary, or CandidateFamily.
    gate does not choose a candidate, invent a refinement, or define
    domain pass/fail semantics.
    """
    if not evaluators:
        raise ValueError("gate() requires at least one evaluator")

    target_effects = target.effects if isinstance(target, GraphFunction) else ()
    target_declarations = target.declarations if isinstance(target, GraphFunction) else Attrs()
    target_tags = target.tags if hasattr(target, "tags") else ()

    return GraphFunction(
        name=f"gate({target.name})",
        inputs=target.inputs,
        outputs=target.outputs,
        effects=target_effects,
        declarations=_merge_attrs(
            target_declarations,
            Attrs.coerce(
                {
                    "gate": {
                        "target": target.name,
                        "target_kind": type(target).__name__,
                        "rule": _rule_decl(rule),
                        "evaluators": tuple(_evaluator_decl(evaluator) for evaluator in evaluators),
                    }
                }
            ),
        ),
        tags=_stable_union(target_tags, (f"rule:{rule.name}",)),
    )


def promote(*, source: Node, to: Node) -> GraphFunction:
    """Lift one declared representation boundary into another.

    Both source and to are mandatory. No hidden inference.
    promote does not change semantic truth — only the declared
    representation boundary available to later algebraic steps.
    """
    return GraphFunction(
        name=f"promote({source.name}->{to.name})",
        inputs=(source,),
        outputs=(to,),
        tags=(f"source:{source.name}", f"to:{to.name}"),
    )


# ── Synthesis / Selection sugar ──────────────────────────────────────────────


def deferred_refinement(
    name: str,
    *,
    inputs: tuple[Node, ...],
    outputs: tuple[Node, ...],
    hints=None,
    tags: tuple[str, ...] = (),
) -> RefinementBoundary:
    """Declare a lawful refinement/synthesis boundary without embedding strategy."""
    return RefinementBoundary(
        name=name,
        inputs=inputs,
        outputs=outputs,
        hints=hints or {},
        tags=tags,
    )


def candidate_family(
    name: str,
    *,
    inputs: tuple[Node, ...],
    outputs: tuple[Node, ...],
    candidates: tuple[GraphFunction, ...],
    policy_hints=None,
    tags: tuple[str, ...] = (),
) -> CandidateFamily:
    """Declare a named family of lawful alternatives over one contract boundary.

    Validates that all candidates share the declared outer contract.
    """
    if not candidates:
        raise ValueError(f"candidate_family({name!r}): empty candidates")

    for c in candidates:
        c_in = {n.name for n in c.inputs}
        c_out = {n.name for n in c.outputs}
        family_in = {n.name for n in inputs}
        family_out = {n.name for n in outputs}
        if c_in != family_in or c_out != family_out:
            raise ValueError(
                f"candidate_family({name!r}): candidate {c.name!r} contract "
                f"({sorted(c_in)}->{sorted(c_out)}) does not match family contract "
                f"({sorted(family_in)}->{sorted(family_out)})"
            )

    return CandidateFamily(
        name=name,
        inputs=inputs,
        outputs=outputs,
        candidates=candidates,
        policy_hints=policy_hints or {},
        tags=tags,
    )

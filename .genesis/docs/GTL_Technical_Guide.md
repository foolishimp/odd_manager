# GTL Reference Guide

**Status**: Current GTL 3 reference
**Audience**: Engineers authoring GTL modules and graph functions
**Purpose**: Describe the live GTL language surface and its runtime boundary

## Position

GTL is the declaration language.

ABG is the runtime that interprets and enforces GTL declarations.

GTL is:

- LLM-first
- graph-first
- algebraic
- declarative
- Python-native in syntax

GTL does not own runtime execution state.

GTL owns:

- graph structure
- graph-function publication
- semantic work contracts
- policy-visible hook attachment
- evidence and closure expectations as declaration truth

ABG owns:

- traversal
- graph-call execution
- runtime event truth
- projection
- continuation opening and resolution
- proof and closure facts

## Core Thesis

The irreducible structural type of GTL is `Graph`.

The public callable carrier of GTL is `GraphFunction`.

`GraphVector` is internal structural truth inside a realized graph. It is not a
public work-entry surface.

`Job` binds published graph functions by identity.

The execution shape is:

```text
Job -> GraphFunction -> GraphCall -> materialized graph -> internal GraphVector traversal
```

## Python Surface

The authored surface is Python:

```python
from gtl.graph import Attrs, Context, Graph, GraphVector, Node
from gtl.function_model import CandidateFamily, GraphFunction, RefinementBoundary, TemplateRef
from gtl.module_model import Module, ModuleImport
from gtl.operator_model import Evaluator, F_D, F_H, F_P, Operator, Rule
from gtl.work_model import ContractRef, Job, Role
```

The declaration model is data-first. Runtime behavior is not authored as hidden
controller logic inside GTL.

## Regimes

GTL uses three regime markers across operators and evaluators:

| Regime | Meaning | Typical use |
| --- | --- | --- |
| `F_D` | Deterministic | checks, transforms, proofs |
| `F_P` | Probabilistic | constructive synthesis, bounded agentic work |
| `F_H` | Human | approval, adjudication, external action |

These regimes classify the ambiguity class of the work. They do not by
themselves implement policy.

## Core Types

### `Attrs`

`Attrs` is the immutable metadata carrier for public declaration surfaces.

Use it for:

- graph-function declarations
- graph-vector declarations
- role policy hooks
- module metadata

`Attrs` carries structured, replay-safe configuration. It is the language-owned
surface for hook refs and policy-visible config.

### `Context`

`Context` is an externally located, snapshot-bound constraint dimension.

Use it when a graph boundary depends on an external artifact or environment
surface that should remain explicit in the declaration.

Examples:

- a schema artifact
- a repository path
- a specification snapshot
- a fixed data contract

### `Node`

`Node` is a typed local locus of graph meaning.

A node names a state in the workflow model. Typical examples are:

- `intent`
- `requirements`
- `design`
- `code`
- `tests`
- `artifact`

### `GraphVector`

`GraphVector` is the internal adjacency record between typed nodes.

It carries transition-local truth:

- source
- target
- operators
- evaluators
- contexts
- optional rule
- declarations

`GraphVector` may carry local dispatch, evaluation, escalation, proof, and
closure declarations. Public semantic work does not target vectors directly.

### `Graph`

`Graph` is the named topology of nodes and graph vectors.

Everything structural in GTL is graph:

- one primitive step
- one multi-step workflow
- one composed workflow
- one refined workflow
- one recursive workflow

### `Operator`

An `Operator` performs effectful work.

Examples:

- run a deterministic transform
- invoke a bounded LLM worker
- require a human gate

Operators transform. They do not decide convergence.

### `Evaluator`

An `Evaluator` judges whether a boundary converged.

Examples:

- deterministic validation
- probabilistic assessment
- human approval

Evaluators judge. They do not perform the constructive step.

### `Rule`

`Rule` is passive governance attached to a boundary.

Use it for static guardrails and declarative control constraints. Do not use it
as a hidden execution program.

### `TemplateRef`

`TemplateRef` identifies the declared outer contract for a graph function.

It is the stable callable boundary. Recursive and higher-order graph functions
preserve that outer contract.

### `GraphFunction`

`GraphFunction` is the primary reusable GTL compute abstraction.

It is:

- named
- publishable
- callable by identity
- composable
- recursion-capable
- higher-order

It is the sole public callable carrier in GTL.

A graph function may realize:

- one graph
- one composed graph
- one recursive graph
- one higher-order graph-function application

`GraphFunction.declarations` carries hook refs and structured declaration
surfaces for:

- dispatch
- evaluation
- escalation
- proof
- closure

### `RefinementBoundary`

`RefinementBoundary` is the explicit lawful refinement or synthesis boundary.

Use it when one declared outer contract may be realized by multiple lawful
inner structures.

### `CandidateFamily`

`CandidateFamily` publishes lawful graph-function alternatives over one outer
contract.

Use it when selection among alternatives must remain explicit and inspectable.

`CandidateFamily.policy_hints` can influence selection policy. It is not a
second runtime.

### `Role`

`Role` is the semantic capability class required to perform or supervise work.

`Role` is not the same thing as a worker identity.

`Role.policy_hooks` is a declaration surface for authority, assignment, or
approval constraints.

### `ContractRef`

`ContractRef` is the indirection from a job to the GTL contract it binds.

In the GTL 3 line, semantic work contracts bind published graph functions by
identity.

### `Job`

`Job` is the durable semantic work contract.

A job:

- names the work
- binds one or more published graph functions by identity
- declares required roles
- remains semantic, not runtime-local

### `Module`

`Module` is the publication boundary for GTL declarations.

It publishes:

- graphs
- graph functions
- refinement boundaries
- candidate families
- jobs
- roles
- rules
- metadata

`Module` is the authoritative package of declared GTL truth.

## Graph-Function Algebra

GTL is not limited to single-edge wrappers.

The active algebra includes:

- graph-function composition
- graph-function recursion
- gating
- substitution and refinement
- higher-order graph-function application

The important rule is stable callable identity:

- recursion does not destroy the outer contract
- composition does not invent a second executor
- higher-order graph functions remain inspectable and publishable

## Hook Surfaces

GTL exposes hook attachment points. It does not define a policy mini-language.

The hook surfaces are:

- `GraphFunction.declarations`
- `GraphVector.declarations`
- `Role.policy_hooks`
- `CandidateFamily.policy_hints`

The lawful shape is:

```text
GTL declaration -> hook ref + replay-safe config
ABG resolution  -> policy bundle + executable implementation
Runtime         -> evented enforcement
```

GTL does not own:

- prompt choreography
- hidden retry logic
- internal tactic selection for probabilistic workers

## Publication And Execution Boundary

The GTL side stops at declaration and publication.

ABG-compatible engines own:

- graph-call execution
- frame progression
- continuation truth
- runtime event emission
- proof and closure facts
- replay and projection

This means:

- GTL does not emit runtime facts
- GTL does not carry frame state
- GTL does not become a controller

## Minimal Authoring Example

```python
from gtl.graph import Attrs, Graph, GraphVector, Node
from gtl.function_model import EnvRef, GraphFunction
from gtl.module_model import Module
from gtl.operator_model import Evaluator, F_D, F_P, Operator
from gtl.work_model import ContractRef, Job

requirements = Node("requirements")
design = Node("design")

draft_design = Operator("draft_design", F_P, "agent://builder/design")
design_checks = Evaluator("design_checks", F_D, "design artifact passes checks")

requirements_to_design = GraphVector(
    name="requirements_to_design",
    source=requirements,
    target=design,
    operators=(draft_design,),
    evaluators=(design_checks,),
    declarations=Attrs(
        dispatch={"ref": "policy.dispatch.default_fp"},
        proof={"ref": "policy.proof.default"},
        closure={"ref": "policy.closure.default"},
    ),
)

design_graph = Graph(
    name="design_graph",
    inputs=(requirements,),
    outputs=(design,),
    nodes=(requirements, design),
    vectors=(requirements_to_design,),
)

design_fn = GraphFunction.from_graph(
    name="design_fn",
    graph=design_graph,
    environment=EnvRef.from_contract(
        requires=(requirements,),
        provides=(design,),
    ),
)

module = Module(
    name="example_module",
    graphs=(design_graph,),
    graph_functions=(design_fn,),
    jobs=(
        Job(
            name="produce_design",
            contracts=(ContractRef(kind="graph_function", target_id=design_fn.id),),
        ),
    ),
)
```

The important properties in this example are:

- the public carrier is `GraphFunction`
- the job binds the graph function, not the vector
- hook attachment is declarative
- the graph vector remains internal structure

## Design Rules

Use GTL well by following these rules:

- publish graph functions as the callable carrier
- keep graph vectors internal
- separate operators from evaluators
- attach policy declaratively
- use candidate families for explicit alternatives
- preserve inspectable outer contracts on composed and recursive graph functions
- keep semantic work contracts at the job layer
- let ABG own runtime fact truth

Avoid these mistakes:

- binding public work directly to graph vectors
- turning work vectors into a rival execution primitive
- hiding runtime law in ad hoc Python callbacks
- mixing semantic roles with runtime worker identity
- treating GTL declarations as imperative control code

## Relation To ABG

Use GTL when you need to declare:

- what the workflow structure is
- what the callable carriers are
- what convergence means
- what policy-visible surfaces exist

Use ABG when you need to know:

- what ran
- what opened
- what failed
- what closed
- what remains open
- what proof and closure facts exist

GTL is declaration law.

ABG is runtime fact law.

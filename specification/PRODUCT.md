# odd_manager Product

**Status**: Active
**Derived From**: `specification/INTENT.md`, `.genesis/docs/standards/SPEC_METHOD.md`, `.genesis/docs/standards/GRAPH_METHOD.md`
**Purpose**: Define the current control-plane product realization for `odd_manager`

## Product Position

`odd_manager` is an operator-facing control-plane product for OODD systems.

It provides a lawful management and observability domain over:

- graph sets, typed assets, asset graphs, bindings, and workorders
- GTL declarations
- ABG runtime truth
- `odd_method` builder/domain surfaces as they emerge during that product's
  build-out
- workspace evidence, provenance, and closure material

The manager may be implemented against a stable observation contract before the
full `odd_method` domain-detail library hardens.

That stable contract is:

- URI-addressed assets
- declared asset types
- typed asset nodes
- explicit bindings
- named functions over asset graphs
- GTL graph-function carriers
- ABG runtime facts and aggregates
- direct ABG event and projector access for runtime state
- `odd_method` query-library overlays for domain understanding that ABG does
  not own

It is not:

- the GTL/ABG runtime itself
- the builder/domain product itself
- a retrofit of a transport-metaphor dashboard
- a clone of Paperclip's company/org ontology

Its job is to make current truth legible and operable without inventing a rival
semantic center.

## Product Terms

### GraphSet

A workspace-scoped set of one or more published graphs observed by the manager.

### Asset

A durable truth or delivery surface identified by URI.

### Asset Type

The semantic role an asset fulfills in the domain.

### Asset Collection

A named working set of assets treated as one bound scope.

### Asset Node

A typed locus in a graph that receives one asset or one asset-collection
binding.

### Asset Graph

The dependency topology over typed asset nodes.

### Asset Binding

The mapping from one concrete asset or asset collection into one typed asset
node at call time.

### WorkOrder

The manager-facing published callable transformation over typed asset nodes.

A workorder is realized by a domain function and carried by a GTL
`GraphFunction`.

### Graph Function

The GTL-level public named callable carrier underlying a published workorder.

Its declared `environment` contract is cumulative rather than one-step piped.

### Outcome

A derived convergence or posture view over graphs, assets, workorders, proof,
and closure state.

### Transition

A derived or explicit relation between typed asset states, graph boundaries, or
convergence targets.

### Work Vector

A productized operator or builder view over one public graph-function carrier
and its realized internal vectors.

It may summarize lawful composition or recursion, but it is not itself the
public callable carrier.

A work vector is not a runtime primitive.

### Semantic Job

A durable semantic work contract over published graph functions and declared
roles.

### Run

One engine-owned execution attempt over semantic work.

### Graph Call

One engine-owned realization of one published graph-function boundary against a
resolved live runtime environment.

### Frame

One recursive invocation aggregate inside a graph call.

### Continuation

One engine-owned durable open governance obligation or unresolved runtime
condition derived from event truth.

### Runtime Fact

An emitted ABG event or replay-derived runtime truth surface.

### Policy Surface

A declarative control surface over dispatch, evaluation, escalation, proof, or
closure without redefining graph law.

### Proof Lane

A declared evidence and proving surface used to justify capability or closure
claims.

### Provenance

The attributable lineage that explains how a declaration, call, event, proof,
or closure claim came to exist.

## Goal Model

`GOALS.md` focuses the current wave of control-plane repricing work.

Intent sets the enduring direction.

Product defines the current manager boundary.

Requirements and shared design then decompose that boundary into constitutional
truth and realization law.

## Product End State

The intended end-state product shape is:

1. install `odd_manager` as its own GTL/ABG project
2. preserve a clean separation from `abiogenesis` and `odd_method`
3. publish the manager ontology around graph sets, typed assets, asset graphs,
   bindings, workorders, jobs, roles, runs, calls, continuations, evidence,
   provenance, and closure
4. publish the operator visual language and graph-workspace styling as
   `odd_manager`-owned design law
5. keep shared design law under `build_tenants/common/design/`
6. implement the operator UI in a tenant-local carrier after the design package
   hardens
7. support serious runtime supervision, failure recovery, policy inspection,
   evidence review, and closure explanation
8. treat all dashboard summaries as projections over declaration truth and ABG
   event truth rather than as shadow runtime state

## Current Product Definition

The current product definition of `odd_manager` is:

- a fresh control-plane project boundary
- a design-first project initialized with the ABG installer
- a project with a published domain model under `specification/domain/`
- a project with a published operator visual system under
  `build_tenants/common/design/`
- a manager product subordinate to GTL/ABG runtime law and `odd_method`
  builder/domain truth as that line is actively being built
- a new control-plane product that preserves an established shell, inspector,
  board, and graph-workspace visual language without inheriting a transport
  ontology
- a product allowed to ship with placeholder builder-detail surfaces where the
  current `odd_method` line has not yet published richer semantic detail
- a product that composes ABG-native runtime projections with `odd_method`
  domain query results instead of depending on one monolithic observer payload
- a project whose live design law currently sits in
  `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
- a project whose installer-seeded `build_tenants/odd_manager/python/` surface
  remains starter scaffold only, not the chosen UI carrier

The current implementation target proposed by design, but not yet created, is:

- `build_tenants/react_vite/`

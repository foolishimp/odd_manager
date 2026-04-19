# Domain Model — odd_manager

**Version**: 0.1.0
**Date**: 2026-04-10
**Status**: Active
**Derives From**:
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/requirements/02-canonical-ontology.md`
- `specification/requirements/03-read-model-and-projection.md`
- `/Users/jim/src/apps/odd_method/specification/PRODUCT.md`
- `/Users/jim/src/apps/odd_method/specification/requirements/02-graph-functions.md`
- `/Users/jim/src/apps/odd_method/specification/requirements/07-asset-typing-and-binding.md`
- `/Users/jim/src/apps/odd_method/specification/requirements/10-odd-sdlc-software-domain-buildout.md`
- `/Users/jim/src/apps/odd_method/docs/ODD_SDLC_DISAMBIGUATION_STRATEGY.md`
- `/Users/jim/src/apps/odd_method/build_tenants/common/design/ODD_SDLC_TRANSLATION.md`

## Purpose

This document publishes the domain model that `odd_manager` observes, projects,
and acts on.

It is the shared vocabulary for:

- readers and projection code
- API and transport surfaces
- UI and operator-facing panels
- audit, provenance, and proving surfaces

This domain model is published inside `odd_manager`, but it remains subordinate
to the declaration and runtime truth emitted by the managed system.

## Position

The observed domain is not one permanent project-global graph.

One managed workspace may expose:

- multiple graphs
- typed assets inside those graphs
- asset families and asset collections
- explicit asset bindings into typed nodes
- published callable functions over those graphs
- ambiguity and capability posture as current domain truth

Within `odd_manager`, the manager-facing name for a published callable function
is `WorkOrder`.

A `WorkOrder` remains traceable to the underlying domain function and GTL
`GraphFunction`. It is not a second executor.

The manager is allowed to ship against this stable observation contract even
when the richer `odd_method` semantic library is still changing.

## Stable Observation Contract

The latest live `odd_method` model currently gives `odd_manager` enough stable
shape to observe and supervise:

- `Asset` with stable identity, URI, declared type, provenance, and optional
  checkpoint material
- `AssetFamily` as a stable semantic grouping over lifecycle lanes
- `AssetCollection` as a named bound scope
- explicit node bindings from typed nodes to concrete asset identities
- function catalog entries with name, intent, typed inputs, typed outputs, and
  backing graph-function identity
- published programs, edge contracts, and work-act types where the builder
  query library exposes them
- an ambiguity register with current status, policy action, and expected
  resolving boundary
- capability contracts and capability-gated stop states for side-effecting
  lifecycle stages
- published cumulative environment contracts where the builder exposes
  `requires`, `provides`, and `carries`
- GTL graph-function carriers and ABG runtime aggregates
- a query-library boundary for domain overlays that ABG does not own

`odd_manager` should treat these surfaces as stable enough to build around.

## Runtime And Domain Query Boundary

The latest `odd_method` ADR and first-slice requirements ratify this
composition boundary:

- ABG owns runtime event truth and runtime aggregate projections
- `odd_method` owns read-only domain query logic
- `odd_manager` composes both into one supervisory UI

The query-library side may provide:

- asset views
- asset-family and collection views
- asset-type semantics
- binding views
- function catalog views
- program, edge-contract, and work-act-type views
- ambiguity-register and capability-posture views
- gap and convergence overlays
- checkpoint and provenance interpretation

It must not redefine:

- `Run`
- `GraphCall`
- `Continuation`
- `Frame`
- `RuntimeFact`

Those remain ABG-native.

## Provisional Detail Policy

The following richer detail may remain provisional while `odd_method` is still
being updated:

- deep asset-type semantic libraries
- polished function intent descriptions
- full gap interpretation libraries
- proof and closure hint libraries
- domain-specific convergence explanation

The following currently published upstream truths should not be downgraded to
placeholder state once they exist:

- ambiguity register entries
- capability contracts
- policy action over active ambiguity
- bounded stop states such as `pending_capability`

Where that detail is incomplete, `odd_manager` may project placeholder detail
cards, badges, or inspector rows.

Those placeholders are lawful only when they remain anchored to the stable
objects named above and are labeled as provisional.

## Core Objects

### GraphSet

A workspace-scoped set of one or more published graphs.

`odd_manager` uses `GraphSet` as the top-level observed topology rather than
assuming one hidden canonical graph.

Where upstream builder metadata is still thin, a `GraphSet` may initially be a
derived projection assembled from function catalog and binding surfaces.

### Asset

A durable surface of truth or produced delivery state identified by URI.

### AssetType

The semantic role an asset fulfills in the domain.

An asset type may carry evaluation, descriptive, proof, or closure meaning.

In the current live builder line, the manager must tolerate asset-type detail
that is still shallow or partially published.

### AssetFamily

A named semantic grouping over related asset types and lifecycle lanes.

### AssetCollection

A named working set of assets treated as one bound scope.

### AssetNode

A typed locus in a graph that receives one asset or one asset-collection
binding.

### AssetGraph

The dependency topology over typed asset nodes.

An asset graph is a member of a `GraphSet`.

In the first manager implementation, graph topology may be projected from
published function inputs and outputs plus explicit node-binding truth until the
builder line publishes richer graph descriptors.

### AssetBinding

The mapping from one concrete asset or asset collection into one typed asset
node at call time.

### WorkOrder

The manager-facing published callable transformation over typed asset nodes.

A `WorkOrder` is realized by a domain function and carried by a GTL
`GraphFunction`.

While the builder catalog is still evolving, a workorder may initially expose
only carrier identity, intent, and typed inputs and outputs.

The manager may additionally project the carrier's cumulative environment
contract when upstream publication exposes it.

### EdgeContract

A published description of one lawful transition boundary, its inputs or
conditions, and its closure posture.

### Program

A published higher-order workflow grouping over callable carriers and related
domain structure.

### WorkActType

A published class of constructive or operational software-domain act used to
explain what kind of work is occurring.

### Job

A durable semantic work contract over published callable carriers and declared
roles.

### Role

A semantic capability class required to perform, supervise, or approve work.

### Run

One engine-owned execution attempt over semantic work.

### GraphCall

One engine-owned realization of one published GTL `GraphFunction` boundary.

`odd_manager` does not replace `GraphCall` with a separate runtime aggregate.
It explains a graph call in terms of the selected `WorkOrder`.

Constructive dispatch is lawful only against the resolved live runtime
environment for that boundary. The manager should therefore treat missing
carried bindings or unresolved environment state as first-class runtime
explanation, not as hidden parameter-passing detail.

### Frame

One recursive invocation aggregate inside a graph call.

### Continuation

One engine-owned durable open governance obligation or unresolved runtime
condition derived from prior event truth.

### RuntimeFact

An emitted ABG event or replay-derived runtime truth surface.

### Gap

A projected delta from convergence for one asset, asset collection, graph, or
callable boundary.

Where the managed builder line publishes per-edge obligation ledgers, a gap
carries separate carry and fulfillment truth rather than one blended scalar:

- `carry_converged` — the obligation set is correctly accounted for with no
  silent drops or extra obligations
- `fulfillment_converged` — each carried obligation is actually realized
- `edge_converged` — carry and fulfillment are both converged; the primary
  closure signal
- `carry_delta` and `fulfillment_delta` — separate pressure indicators
- `combined_delta` — a derived convenience projection, not the primary closure
  signal

Gap interpretation may begin as provisional descriptive detail until the
builder line publishes a more stable gap library.

### EdgeObligationLedger

A per-edge published accounting surface emitted by the builder line for each
constructive edge that carries explicit obligations.

Each ledger records the obligation source and derivation rule, expected and
carried obligation counts, per-obligation carry and fulfillment status,
blocking reasons, and evidence refs.

`odd_manager` observes this surface as a query-derived domain overlay. It does
not own the obligation semantics or the fulfillment rules.

### ConvergenceTarget

The declared condition under which one asset, asset collection, or graph
boundary counts as converged.

Where the builder line publishes obligation ledgers, edge convergence is the
compound condition `carry_converged AND fulfillment_converged`. A bare blended
scalar is a derived convenience, not the primary closure signal.

Convergence explanation may be partial when the upstream builder line has not
yet published richer closure semantics.

### AmbiguityRegister

A query-derived domain surface that records major ambiguity, current status,
policy action, affected assets, threatened invariants, and expected resolving
boundary.

### CapabilityContract

A tenant-local declared capability surface that governs whether executional or
operational stages are lawful.

### BoundedStopState

An honest current posture such as `pending_capability`, `fh_required`, or
another explicit carried or blocked state that explains why downstream closure
has not occurred.

### PolicySurface

A declarative control surface over dispatch, evaluation, escalation, proof, or
closure.

### ProofLane

A declared evidence and proving surface used to justify capability or closure
claims.

### ProvenanceRecord

Attributable lineage that explains how a declaration, binding, call, fact, or
closure claim came to exist.

### ClosureRecord

The operator-facing closure state over an asset, graph, workorder, or run.

## Ownership And Mapping

### Builder And Domain Layer

The emerging builder/domain line owns:

- assets
- asset families
- asset types
- asset collections
- asset nodes
- asset graphs
- asset bindings
- domain functions
- edge contracts
- programs
- work-act types
- ambiguity register
- capability contracts and capability-gated stop states
- convergence targets, gap interpretation, and edge obligation ledgers

### GTL Layer

GTL owns:

- graph structure
- typed nodes
- graph functions
- jobs
- roles
- module structure
- policy hook declarations

### Runtime Layer

ABG owns:

- runs
- graph calls
- frames
- continuations
- event emission
- replay-derived runtime projections
- worker/backend binding
- proof and closure enforcement

### odd_manager Layer

`odd_manager` owns:

- projections over graph sets, graphs, assets, asset families, collections,
  bindings, workorders, ambiguity posture, and capability posture
- operator-facing grouping, orientation, and drilldown
- derived posture, attention, and readiness views
- composition of ABG runtime projections with ODD domain query overlays
- honest placeholder presentation for provisional builder detail
- attribution and audit presentation

`odd_manager` does not own hidden runtime semantics or hidden builder
semantics.

## Mapping Rules

- domain `Function` -> manager `WorkOrder` -> GTL `GraphFunction`
- GTL `GraphFunction` call -> ABG `GraphCall`
- asset or asset-collection binding -> `AssetBinding`
- graph topology over typed nodes -> `AssetGraph`
- one workspace's observable graph topology set -> `GraphSet`
- domain `ambiguity_register` -> manager ambiguity posture and inspection views
- domain capability contracts and stop states -> manager bounded-stop
  explanation surfaces
- domain `edge_obligation_ledger` -> manager gap carry/fulfillment separation
  in projected gap views

## Derived Objects

The following may exist in `odd_manager` as derived operator views:

- outcome
- transition
- work vector
- lens
- readiness score
- attention queue

These are lawful only when they are projections over the published graph, asset,
workorder, runtime, policy, and proof model described above.

## Publishing Rules

The published domain model for `odd_manager` must preserve these rules:

1. No assumption of one permanent global graph.
2. Assets are first-class and typed.
3. Asset families, collections, and capability-bearing domain overlays are
   surfaced when upstream publishes them.
4. Bindings into typed nodes are explicit.
5. Published callable functions are surfaced as workorders.
6. Runtime aggregates remain ABG-owned.
7. Domain query overlays do not redefine runtime aggregates.
8. Placeholder builder detail stays explicitly provisional.
9. Published ambiguity and capability posture is not silently downgraded to
   placeholder state.
10. Derived operator objects do not become rival source truth.

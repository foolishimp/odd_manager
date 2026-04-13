# Canonical Ontology

**Family**: `REQ-OM-ONT-*`
**Status**: Active
**Category**: Constraint / Guarantee
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`

### REQ-OM-ONT-001 - The product exposes canonical supervisory objects

`odd_manager` shall expose a canonical supervisory object model centered on the
actual managed domain and runtime.

Acceptance Criteria
- the product provides first-class surfaces for graph sets, assets, asset
  types, asset families, asset collections, asset nodes, asset graphs, asset
  bindings, workorders, jobs, roles, runs, graph calls, frames,
  continuations, runtime facts, policy, evidence, provenance, closure,
  ambiguity register, capability contracts, and bounded stop states
- operator-visible labels and actions are anchored to those objects
- the product does not require a second hidden ontology to explain product
  state

### REQ-OM-ONT-002 - One workspace may expose multiple graphs

The product shall not assume one permanent project-global graph.

Acceptance Criteria
- the product can represent more than one graph inside one workspace
- graphs remain identifiable as distinct members of a graph set
- graph-specific state can be inspected without collapsing all topology into
  one fused graph

### REQ-OM-ONT-003 - Published callable functions are surfaced as workorders

The product shall surface published callable functions as workorders over typed
asset nodes.

Acceptance Criteria
- a workorder remains traceable to its underlying domain function and GTL
  graph-function carrier
- workorders do not replace runs, graph calls, frames, or continuations as
  runtime aggregates
- the operator can inspect the typed inputs and outputs of a published
  workorder

### REQ-OM-ONT-004 - Work vectors, outcomes, and transitions remain derived views

The product may project work vectors, outcomes, and transitions, but those
remain derived operator views over the published graph, asset, and workorder
model.

Acceptance Criteria
- derived views remain traceable to published graphs, typed assets, bindings,
  workorders, proof, and closure state
- derived views do not become rival source truth
- operator summaries do not treat derived views as a second execution engine

### REQ-OM-ONT-005 - Continuations remain derived runtime obligations

The product shall treat a continuation as a derived runtime obligation rather
than as a hidden task queue or strategy artifact.

Acceptance Criteria
- a continuation remains tied to its causing event and enclosing run
- the product can distinguish open continuations from broader product plans or
  goals
- continuation state is explained in runtime and governance terms rather than
  as ambient unfinished work

### REQ-OM-ONT-006 - Policy, proof, provenance, and closure are first-class

The product shall treat policy, proof, provenance, and closure as first-class
operator surfaces rather than as subordinate metadata.

Acceptance Criteria
- the operator can inspect the policy and proof surfaces relevant to a selected
  outcome, call, or continuation
- the operator can inspect ambiguity policy and capability posture relevant to a
  selected graph, workorder, or lifecycle stage where those surfaces exist
- provenance is reachable as part of ordinary supervisory work
- closure claims can be explained in terms of evidence and open obligations

### REQ-OM-ONT-007 - A published domain model exists inside odd_manager

`odd_manager` shall publish its observed domain model as an explicit project
artifact.

Acceptance Criteria
- the published domain model is stored inside the project specification surface
- the published domain model names the graph, asset, binding, workorder,
  runtime, and derived-view objects used by the product
- requirements, design, and implementation can trace back to the published
  domain model

### REQ-OM-ONT-008 - Ownership boundaries across language, runtime, builder, and UI are explicit

The product shall preserve explicit ownership boundaries across declaration
law, runtime law, builder/domain law, and UI-only read models.

Acceptance Criteria
- declaration-owned objects remain distinguishable from runtime-owned objects
- builder/domain-owned objects remain distinguishable from control-plane read
  models
- UI-only constructs such as badges, scores, and lenses remain identifiable as
  derived views rather than source truth

### REQ-OM-ONT-009 - Derived lenses remain projections over the same world

The product may support multiple derived operator lenses, but each lens shall
remain a projection over the same underlying managed world.

Acceptance Criteria
- changing the selected lens changes interpretation and emphasis without
  mutating raw underlying truth
- different lenses do not imply separate projects or separate runtime engines
- lens-specific summaries remain traceable back to the same underlying
  declaration and runtime surfaces

### REQ-OM-ONT-010 - Placeholder builder detail is allowed when canonical identity is present

The product may use placeholder or incomplete builder-domain detail while
`odd_method` is still publishing its live model, provided canonical identity
and runtime truth remain intact.

Acceptance Criteria
- placeholder detail may be used for rich type semantics, gap interpretation,
  closure hints, proof hints, or function descriptions that are not yet
  published cleanly by the builder line
- once upstream publishes ambiguity, capability, or policy-bearing domain
  overlays explicitly, the manager does not hide them behind generic
  placeholder state
- placeholder detail does not replace canonical asset URI, declared type, node
  identity, binding identity, workorder identity, or graph-function identity
- the product labels provisional detail honestly rather than presenting
  invented precision as settled domain truth

### REQ-OM-ONT-011 - Published ambiguity and capability objects are first-class supervisory truth

When the managed builder/domain line publishes ambiguity and capability objects,
`odd_manager` shall surface them as first-class supervisory truth rather than
as incidental annotations on gaps or status badges.

Acceptance Criteria
- ambiguity register entries remain inspectable as distinct objects or object
  collections with stable identity or stable classification
- capability-bearing surfaces remain distinguishable from generic status text
  or gap summaries
- bounded stop states such as `pending_capability` or `fh_required` are
  explained in terms of the governing domain object rather than inferred only
  from generic failure wording

# ODD Method

## 1. Position

`ODD_METHOD.md` exists to make one instruction precise:

`using ODD_METHOD, build this product`

That instruction should mean something stronger than:

- write some product docs
- sketch a graph
- add a few helper scripts

It means:

- build the product as a GTL/ABG domain product
- define typed domain assets and nodes
- publish named graph functions as the constructive carrier
- bind them into a GTL module
- let ABG own traversal governance, runtime facts, and provenance
- let ABG own continuation and re-entry after each publish boundary
- keep product commands and services as cooperative bounded-step subsystems that
  publish assets or evidence and return control to ABG
- expose visible current state as projection over constructive history

This is a programming paradigm, not only a documentation preference.

The paradigm is:

`product = typed asset/domain model + GTL-defined graph functions + ABG traversal-control runtime + governed projection/query surfaces`

If the constructive carrier remains hidden in imperative loops, local service logic, or product-specific orchestration scripts, the product is not yet built using ODD method.

Within this method, `ODD`, `GTL`, and `ABG` name normative capability roles
and construction algebra, not a required repository, package, vendor, or
concrete implementation:

- `ODD` names the graph-native product-authoring profile;
- `GTL` names the typed declarative graph-language role; and
- `ABG` names the singular traversal-governance and runtime-truth authority
  role.

A consumer binds those roles to concrete conforming realizations in its own
Product, requirements, design, and immutable dependency identity. A consumer,
reference realization, or historical product may prove or falsify conformance;
it does not supply method authority.

The method has two core jobs:

1. describe the product as a declared asset graph in graph-native terms
2. ensure automation never outruns a lawful manual traversal of the same graph

The graph is not decoration around the process. The graph is the process model. GTL is the language expression of the method. ABG is the traversal governance, binding, and runtime-truth substrate that realizes the GTL program without owning the domain's internal HOW.

---

## 2. Method Role

`SPEC_METHOD.md` defines the general constitutional method.

`ODD_METHOD.md` defines the graph-native ODD product-authoring method that uses GTL-defined graph functions as the primary constructive carrier.

The role split is:

- `SPEC_METHOD.md` — constitutional baseline for goals, intent, product, requirements, design, and lawful re-entry
- `ODD_METHOD.md` — constitutional law for graph-native traversal governance (assets, vectors, traversal, graph functions) AND product-authoring law for building an ODD product correctly over that substrate

This method does not replace product-specific domain methods such as `WORLD_MODEL_METHOD.md`.

Where a product is ODD and world-model-driven:

- `ODD_METHOD.md` governs graph-native structure and ODD product shape
- `WORLD_MODEL_METHOD.md` governs world-model semantics, publication, and composition law

Those methods compose.

---

## 3. Method Composition

`ODD_METHOD.md` is not meant to be sufficient on its own for domain-correct product work.

It gives the structural law for how a graph-native ODD product should be built.

It does not, by itself, give:

- the product's domain semantics
- the product's current intent and product-definition line
- the product's local capability and constraint requirements
- the product's currently ratified design surfaces

So the composition rule is:

- `ODD_METHOD.md` tells you how to build the product as a graph-native ODD product
- domain methods tell you what semantic law the product must honor
- local `INTENT.md`, `PRODUCT.md`, requirements, and design tell you the currently ratified local line

Examples:

- for a graph-native software-development ODD product
  - `ODD_METHOD.md` provides the graph-native substrate and ODD structural law
  - product-local `INTENT.md`, `PRODUCT.md`, requirements, ADRs, and GTL surfaces provide the local product line

- for a world-model product
  - `ODD_METHOD.md` provides the graph-native substrate and ODD structural law
  - `WORLD_MODEL_METHOD.md` provides world-model semantic law
  - product-local `INTENT.md`, `PRODUCT.md`, requirements, and design provide the local product line

If an agent reads only `ODD_METHOD.md`, it should understand the paradigm.

If it needs to build one concrete product correctly, it must then read the product-specific method and local authority surfaces.

---

## 4. Method Folder Semantics

The methodology library has two roles. Mutable source authors a future release;
consumers select one complete immutable release.

- `specification/standards/` in the `specification_methodology` source
  repository is the **authoring library** for the next method cut. Mutable
  source does not govern a consumer before publication and explicit selection.
- `.genesis/docs/standards/` in a project workspace is an **installed
  distribution** of one selected release. Its authority derives from the
  selected version, immutable reference, and exact member inventory.

The selected immutable release is consumer authority. An installed copy must
match that release; mutable source cannot silently repair, replace, or outrank
it. A mismatch is an adoption defect resolved by selecting and installing a
released cut, not by mixing source and installed members.

Both roots contain three classes of document:

- `*_METHOD.md` — constitutional method surfaces
- `*_GUIDE.md` — operational guides and application standards
- `*_TEMPLATE.md` — reusable starter forms and examples

Only `*_METHOD.md` documents are constitutional method surfaces.

`*_GUIDE.md` documents refine application of the method.

`*_TEMPLATE.md` documents are convenience artifacts only.

When an installed distribution disagrees with its selected immutable release,
the selected release wins and the installation must be repaired. Mutable source
authors a future cut; it does not govern the installed consumer.

---

## 5. Graph Model

The product is expressed as a declared asset graph over state-transitions relevant to the product's work.

### Nodes

Nodes are durable truth surfaces or product assets. Each node names a bounded state of truth.

Examples from a software-development ODD product:

- `intent`
- `product`
- `requirements`
- `design`
- `module_decomp`
- `code`
- `uat_testcases`
- `integration_tests`
- `bootloader`
- build targets

These are illustrative asset names from one concrete product. The method law is that nodes name bounded states; specific node names are product-local.

### Vectors

Vectors are lawful transitions between nodes.

Each vector declares:

- required upstream assets
- target asset
- governing evaluators and gates
- output contract

Vectors are the admissible transitions of the product.

### Probabilistic Compute

In ODD method, probabilistic compute is bounded constructive work over one
declared vector or edge traversal where the worker's internal solution path is
not fully determined by the graph or runtime.

One vector or edge traversal is the bounded unit of probabilistic compute.

The vector declares the admissible external traversal space:

- required upstream assets
- target asset or output contract
- required context
- role or capability expectation
- governing evaluators and gates
- provenance obligation
- lawful stop, hold, gap, continuation, or completion states

ABG may govern, invoke, observe, and classify the traversal. It does not own the
worker's hidden constructive path.

Anything not constrained by the traversal boundary remains worker-internal HOW:

- hidden LLM reasoning
- heuristic search
- domain implementation strategy
- tool-local execution detail
- product-specific business choice

F_P is the graph/runtime shorthand for this bounded probabilistic worker turn.
F_D is deterministic evaluation or proof over declared properties of the
traversal. F_D may optimize or validate a domain-local path where the domain can
make part of the work precise, but it does not move domain HOW into GTL, ABG, or
the framework.

The method governs the traversal contract, evidence, provenance, and control
truth. It does not make the framework the executor of the domain's internal
solution strategy.

### Graph Functions

Graph functions are named constructive programs that realize vectors.

A graph function may:

- realize one outer vector directly
- refine one outer vector into a small inner workflow
- act as a reusable higher-order library function

The outer vector remains the constitutional contract. The graph function is the constructive realization of that contract.

### Traversal

The workflow is a traversal over the graph. Traversal means:

- bind the current target
- locate the next admissible vectors
- traverse one vector
- materialize the next asset
- prove the vector closed
- continue until the selected target closes

The graph is the declared program space of the product.

---

## 6. Product Boundary

The graph-native product and the project built with it are distinct.

The installed product provides the method, runtime, and carrier surfaces. It does not provide the target project's business domain.

A clean install means:

1. install the graph-native ODD product
2. author the target project's intent, product definition, requirements, and realization root
3. traverse the product graph to build the target project's domain outputs

The installed product owns:

- the graph-native method and its traversal-control substrate
- runtime and control surfaces
- command surfaces
- release-managed methodology surfaces
- project scaffold templates

The target project owns:

- constitutional surfaces per `SPEC_METHOD.md` (`GOALS.md`, `INTENT.md`, `PRODUCT.md`, `requirements/`)
- one or more realization roots — the canonical root name in this ecosystem is `build_tenants/` for software-development ODD products; other domain types may use their own realization-root names
- domain outputs and evidence (for a software-development ODD product these are design, code, tests, docs, and proof surfaces; other domains name their produced artifacts accordingly)

The installed product must not assume prior knowledge of the target project's domain.

---

## 7. Self-Host Boundary Rule

Self-hosting is lawful only when the installed product under use remains distinct from the product under development.

A released installed product may help build the next version of itself, but the two must not collapse into one mixed authority surface.

The required distinction is:

- installed released builder
- in-development product being built

This is the same boundary preserved when one compiler release builds the next compiler release.

The framework must preserve distinct:

- territories
- authority surfaces
- runtime state
- project-owned specification and build-tenant surfaces

If automation, runtime resolution, or qualification silently merges those surfaces, the framework is violating the method.

---

## 8. Responsibility Layers And Local Binding

`ODD_METHOD.md` governs structural responsibility layers and their required publication shape.

It does not freeze one product's local asset names as universal ODD doctrine.

The method-level expectation is:

- a responsibility layer expresses one capability class
- the product binds that capability to its own local domain semantics
- the GTL carrier publishes the lawful transitions for that bound capability

Examples of capability classes may include:

- bootstrap or intake
- design
- implementation
- qualification
- release
- operational transition
- retrofit

Those are responsibility-layer ideas, not mandatory universal instance names.

For one concrete product, each active layer should bind explicitly to:

- local typed assets or typed nodes
- public graph-function carriers
- required carried environment
- proof or closure surfaces
- projection or query surfaces

That means an audit should distinguish clearly between:

- shared ODD structural law
- local product semantic bindings

If a product copies another product's local asset names without semantic need, that is not reuse of method. It is accidental doctrine transfer.

If a product declares a capability in prose but does not bind it into typed assets, graph functions, and proof lanes, that capability is under-built.

---

## 9. Method Governance And Audit

Products governed under `ODD_METHOD.md` should be audited against this method as the shared constitutional surface.

That audit should ask at minimum:

- what responsibility layer or capability class is being implemented
- what local typed assets or nodes bind that capability into the product
- what public graph functions carry the constructive transition
- what proof or closure lane justifies the capability
- what projected/query state is exposed without replacing ABG runtime truth
- whether any product command, service, or query surface is trying to replace
  ABG continuation with tenant-local orchestration
- whether the execution-authority audit proves that traversal loops, actor
  invocation, process supervision, retry/continuation, runtime events, and
  closure folds remain owned by ABG

The governance rule is:

- approved shared-pattern work must update `ODD_METHOD.md` when it changes or clarifies the reusable structural law
- product-local work may remain local if it does not change shared structural law

Grey work must not be silently absorbed into the line.

When an implementation or design move is not clearly covered by the current method, it must be evaluated against `ODD_METHOD.md` and resolved as one of:

- compliant with the current method
- non-compliant with the current method
- valid and worth incorporation into `ODD_METHOD.md`

If the result is incorporation, the implementation is not fully approved until the method surface is updated accordingly.

If the result is non-compliance, the implementation should be repriced, repaired, or rejected rather than normalized by repetition.

The practical rule is:

- no shared structural pattern becomes "approved by usage"
- no grey pattern becomes constitutional by drift
- reusable structural law is ratified in `ODD_METHOD.md`
- local product law is ratified in the product's own authority surfaces

---

## 10. What An ODD Product Is

An ODD product is a configured GTL/ABG domain product whose constructive work is carried by published graph functions over typed domain assets.

The stable app boundary is:

```text
App
= Bootstrap Surface
+ Initialization Surface
+ Domain Configuration
+ Typed Domain Assets / Nodes
+ GTL Function Catalog
+ GTL Module
+ Policy Hook Bindings
+ ABG Runtime
+ Projection / Query Surface
+ Proof Surface
```

Read the ownership split strictly.

The `Product Specification` and `Product Realization` subsections below name the **canonical topology for a software-development ODD product** in this ecosystem. ODD method at the universal layer commits to the authority split (one `WHAT` surface, one `HOW` surface, runtime owned by ABG, product owning domain meaning) but not to specific directory names. Other ODD product types may adapt directory layout while preserving that authority split.

### Product Specification (software-development topology)

`specification/` is the authoritative `WHAT`.

It defines:

- intent
- product position
- goals
- requirements
- scenarios

### Product Realization (software-development topology)

`build_tenants/` is the authoritative `HOW`.

It carries:

- design
- GTL publications
- code
- tests
- local proof surfaces

### ABG

ABG owns:

- traversal
- dispatch
- actor invocation
- process supervision
- graph-call realization
- runtime facts
- runtime event emission and replay
- frames
- continuations
- retry and correction control
- closure folds over runtime truth
- re-entry after publish boundaries
- lineage and provenance

### ODD Product

The ODD product owns:

- domain asset meaning
- graph-function meaning
- published function catalog
- policy overlays
- domain query projections
- closure and gap interpretation for its domain

### Query And Service Layers

Service or query layers may own:

- transport
- sessions
- routing
- browser-safe projection
- API surfaces

They do not own runtime truth.

They also do not own continuation truth.

Do not hide the real constructive carrier behind the word `service`.

---

## 11. Core Law

An ODD product is built correctly only when all of the following are true.

### 11.1 Typed Assets And Nodes Are Explicit

The product works over explicit typed assets or typed nodes.

It does not work over:

- one hidden project blob
- one giant mutable workspace object
- one undocumented service payload

Concrete assets must bind explicitly into typed domain boundaries.

Where an asset is a real produced or consumed boundary, declare its `asset_surface`.

### 11.2 Graph Functions Are The Primary Constructive Carrier

Every operative constructive step is carried by:

- one named `GraphFunction`, or
- one lawful graph-function composition

Do not leave the real carrier inside:

- orchestration loops
- bespoke Python pipeline runners
- controller scripts
- service methods that only happen to call GTL-adjacent helpers

### 11.2A Outcome-First Realization Order

If ODD introduces an edge traversal as the unit of compute, an ODD product must
use that unit of compute to build its own operative framework behavior.

The required realization order is:

1. declare the outcome traversal over typed assets
2. publish the declarative GTL/ABG carrier structure
3. implement only the minimal imperative adapter code that remains necessary

Outcome traversal means the product declares the governed movement before
implementation:

- source asset type
- target asset type
- edge traversal or graph-function name
- closure or evaluation obligation
- lineage obligation
- ambiguity or gap obligation
- allowed `F_D`, `F_P`, and `F_H` bindings

Declarative carrier structure means:

- GTL graph functions
- typed nodes
- vectors
- operator bindings
- evaluator bindings
- carrier schemas
- policy declarations
- projection declarations
- lineage ledger declarations

Imperative adapter code is lawful only where it transports or persists facts:

- file or network IO
- CLI or API transport
- event persistence
- runtime invocation
- projection rendering
- tool execution that has already been admitted by a declared traversal

Imperative code must not own domain meaning, semantic target movement, step
selection, closure semantics, lineage truth, or constructive workflow truth.

If framework behavior is implemented imperatively first and only later
described with GTL vocabulary, the product is ODD-shaped but not yet ODD-built.

### 11.3 The Function Catalog Is Published

The live line must publish a machine-readable function catalog.

At minimum, each retained function should expose:

- name
- inputs
- outputs
- intent
- public or helper role

If the callable surface exists only in prose or prompt memory, the product is under-built.

### 11.4 The GTL Module Is The Operative Publication Surface

The product must publish:

- the public graph-function carriers
- the graph or graphs those carriers traverse
- typed node and vector surfaces
- semantic jobs or equivalent outer callable contracts bound to the public carrier

Do not bind callers directly to hidden inner vectors.

Where a public carrier refines into inner executable structure, publish the live traversal boundaries explicitly through lawful GTL boundary surfaces such as `RefinementBoundary` or `CandidateFamily`.

The outer public carrier remains the callable contract.

### 11.5 Current State Is A Projection Over Constructive History

Visible current state is a projection.

It is not a replacement for runtime truth.

The ODD query lane may expose:

- asset views
- function catalog views
- checkpoint overlays
- provenance overlays
- domain-specific explainability overlays

It must not redefine ABG runtime facts.

### 11.5A ABG Owns Continuation And Re-Entry

An ODD application over GTL/ABG is a cooperative subsystem, not a replacement
runtime.

ABG owns:

- continuation authority
- re-entry after publish boundaries
- graph-call lifecycle
- step selection over the declared graph

The product may:

- publish typed assets and evidence
- execute one admitted bounded constructive step
- publish downstream read models or domain overlays
- return control to ABG

The product must not:

- own a hidden continuation loop
- carry multi-step controller memory across publish boundaries
- infer later steps locally instead of re-entering through ABG
- treat public `next` and explicit graph-function continuation as rival
  authorities inside one controller
- build product-local orchestration that effectively replaces ABG

If an application attempts to replace ABG continuation with tenant-local
control flow, it is no longer behaving as an ODD application over GTL/ABG. It
has drifted into a different architecture that only happens to publish some
ODD-shaped artifacts.

### 11.5B Execution Authority Audit

Any ODD product over GTL/ABG that changes runtime, `start`/`iterate`, worker
transport, actor invocation, process supervision, plugin dispatch, event
projection, closure, assurance, retry, or continuation semantics must include
an execution-authority audit before activation and closure.

The audit must prove that there is exactly one execution authority for the
affected traversal. For a consumer using the GTL and ABG roles, that authority
is the one consumer-bound realization of the ABG role. This remains true when
the realization under change itself implements that role. A different
realization is lawful only under an explicitly ratified, non-overlapping
runtime scope.

The audit must inventory at least these surfaces:

| Surface | Lawful owner | Product or plugin role | Forbidden local implementation |
| --- | --- | --- | --- |
| Traversal selection and vector advance | ABG | Declare graph functions, vectors, assets, and domain policy inputs | Product-local runner deciding the next traversal step |
| Actor invocation and process supervision | ABG | Provide actor bindings, prompts, payload adapters, and evidence adapters | Product-local worker `spawn`, `spawnSync`, `exec`, timeout, kill, or stdout/stderr supervision outside the ABG actor seam |
| Retry, correction, continuation, and re-entry | ABG | Publish bounded-step outputs and return control | Product-local retry loops, carry-over controller memory, or hidden `next` authority |
| Runtime event emission, append, replay, and projection | ABG | Map domain evidence into admitted event payloads | Direct event append, side ledger mutation, or projection reconstruction that bypasses ABG runtime truth |
| Closure fold and assurance gate | ABG, with product policy and gain inputs | Provide domain interpretation, evaluators, gap reasons, and policy weights | Worker self-report or product postflight directly closing the runtime unit |

The audit is not satisfied by reviewing produced artifacts alone. It must
include a code, call-graph, or static-surface review appropriate to the
language and tenant, and it must name the evidence used to rule out hidden
execution authority.

Non-closure conditions include:

- a downstream product contains its own `start` or `iterate` loop for an ABG
  traversal
- product or plugin code supervises worker processes outside the ABG actor seam
- product or plugin code constructs retry, continuation, or re-entry state
  outside ABG
- product or plugin code appends runtime events or mutates runtime ledgers
  without ABG admission
- plugin output carries next-vector, closure, actor-invocation, process, or
  runtime-event authority instead of evidence or policy input
- two controllers can each claim authority for one traversal

If any of those conditions are present, the product may be useful, but it is
not currently ODD-correct over GTL/ABG.

### 11.5C Projection-Source Coherence

Projection and query lanes are downstream read models over admitted carrier,
runtime, event, or source truth.

They may summarize, index, filter, or render that truth.

They must not reconstruct an alternate authority surface beside the admitted
carrier.

For an ODD product, this means:

- function catalog views must reconcile to the admitted GTL module or public
  carrier
- asset ownership and start-target views must be derived from, or structurally
  compared against, the admitted carrier they expose
- runtime status views must derive from ABG runtime facts, events, replay, or
  projection truth
- domain query overlays must fail closed when the carrier they describe is
  missing, stale, or structurally divergent

Name equality is not enough.

A same-named graph function, node, carrier, policy, or route with different
inputs, outputs, vectors, declarations, ownership, or closure law is a different
truth surface until reconciled.

Negative proof for a projection must include structural drift, not only missing
source truth.

### 11.5D Constructive Evaluation And Yield Loop

Every ODD product over GTL/ABG must preserve one constructive evaluation loop
from intent lineage and model synthesis through observation to next lawful
action.

This is the method-level homeostasis loop. The constitutional surface names the
operative functions directly: `synthesize_model`, `eval_gap`, `evaluate_next`,
and `evaluate_action`.

The selected Product outcome under `STDO-UP-013` is external authority for this
loop. Product models, gaps, assurance, ledgers, and projections may interpret
that outcome but cannot author, select, or enlarge it. `evaluate_next` may
select material work only within that outcome or an admitted bounded
prerequisite or experiment. Graph or edge closure is evidence toward Product
acceptance; it is not Product or release acceptance. When the selected outcome
is accepted, an admitted prerequisite is discharged, an admitted experiment's
stated decision is resolved, another admitted terminal condition is reached, or
its governing basis or bound is exhausted, rejected, withdrawn, superseded,
repriced away, or falsified, the loop selects no further material work without
another admitted basis. A `reprice` disposition requests lawful constitutional
re-entry; it does not perform the reprice or select the successor outcome.

The loop is framework-independent. Product implementations may use different
carrier names, but they must preserve this authority shape:

```text
selected Product outcome and admitted bounded-basis refs
-> TargetObligationBinding

IntentLineage
-> ProductAssetModel
-> ObservationSnapshot
-> GapPressureRow
-> TargetObligationBinding
-> PriorityProjection
-> ConstructionIntent
-> AdmittedEvidence
-> EdgeFulfillmentLedger
-> EdgeClosureDecision
-> NextActionProjection
```

The objects have these method-level meanings:

| Object | Definition | Authority |
| --- | --- | --- |
| `IntentLineage` | Admitted source intent and its lineage refs: human, imported source, prior product, intent engine, or prior synthesized construction intent. | ABG event-log truth over source intent. It seeds the product model and must not invent graph actions. |
| `ProductAssetModel` | Desired and known typed asset model synthesized from intent lineage, prior model, and admitted product truth. | Product-owned model truth whose publication basis is carried by admitted events and product-owned projection refs. It is not runtime fact or action authority. |
| `Worksite` | Current workspace, runtime archive, transform assets, product asset root, profile, and observed file or process state. | Observable substrate, not authority by itself. |
| `RuntimeEventLog` | Append-only admitted runtime facts. | ABG runtime truth. |
| `RuntimeProjection` | Replay-derived current runtime state over event log and execution basis. | ABG projection truth. |
| `ObservationSnapshot` | Read-only view of runtime truth plus worksite facts relevant to construction. | ABG evaluator carrier with product domain rows. |
| `GapPressureRow` | Typed pressure over missing, partial, blocked, waiting, or ambiguous assets and evidence. | Product domain meaning over admitted observation. |
| `TargetObligationBinding` | Exact binding from gap pressure to the selected Product outcome, any admitted prerequisite or experiment basis, target assets, required roles, evidence refs, and admissible graph outcomes. | Product domain binding over GTL/ABG action authority. |
| `ActionCatalog` | Published lawful graph actions: graph functions, vectors, targets, inputs, and eligible outcomes. | GTL/product publication consumed by ABG. |
| `NextActionBasis` | Sum type naming why `evaluate_next` is being called: `initial_selection`, `post_yield_resume`, `post_close_graph_continuation`, `post_retry`, `post_repair`, `post_reenter`, `post_reprice`, or `post_block`. `post_reprice` records a re-entry request and carries no action-selection authority. | Dispatch basis for next-action evaluation. It is not a separate controller. |
| `PriorityProjection` | Deterministic ranking over bound lawful actions under visible policy. | ABG evaluator kernel plus product policy. |
| `ConstructionIntent` | Admitted selected action for one bounded graph invocation, preserving the selected outcome or admitted bounded-basis refs carried by its target binding. | ABG admission and traversal authority. |
| `AdmittedEvidence` | Admitted worker, process, product, execution, materialization, liveness, and postflight evidence. | ABG/product admission, not worker self-closure. |
| `EdgeFulfillmentLedger` | Evidence and convergence carrier for one edge attempt or version. | Closure evidence truth. |
| `EdgeClosureDecision` | Sum type over the ledger: close, yield, retry, repair, re-enter, reprice, block. | Closure decision truth. |
| `NextActionProjection` | Read model that observes `NextActionBasis` plus current truth and selects a next graph action only when lawful. | ABG next-action evaluation projection with product policy. |

The loop has one model synthesis function and three distinct evaluation
functions. They may share underlying libraries, but they must not share
authority:

| Function | Inputs | Output | Boundary |
| --- | --- | --- | --- |
| `synthesize_model` | `IntentLineage + prior ProductAssetModel + admitted product truth` | `ProductAssetModel` | Model synthesis. It may update desired and known typed asset truth. It must not observe the worksite, select work, invoke work, or close work. |
| `eval_gap` | `ProductAssetModel + RuntimeEventLog + RuntimeProjection + Worksite` | `ObservationSnapshot + GapPressureRow` | Read-only gap discovery. It compares desired model truth to observed reality and emits missing, partial, blocked, waiting, or ambiguous asset pressure. It does not choose work and does not close work. |
| `evaluate_next` | `NextActionBasis + fresh eval_gap + TargetObligationBinding + ActionCatalog + Policy` | `PriorityProjection + NextActionProjection + selected_action` | Next-action selection. `TargetObligationBinding` carries the exact selected Product outcome and any admitted bounded-basis refs. `NextActionBasis` is either `initial_selection(IntentLineage, ProductAssetModel)` or one explicit post-action basis derived from an `EdgeClosureDecision`: `post_yield_resume`, `post_close_graph_continuation`, `post_retry`, `post_repair`, `post_reenter`, `post_reprice`, or `post_block`. Except for unresolved `post_reprice`, which returns typed no-action pending separately admitted constitutional authority, it may select only published lawful graph actions that bind to the gap and governing basis. It does not admit construction intent and does not evaluate the result of an action. |
| `evaluate_action` | `ConstructionIntent + AdmittedEvidence + TargetObligationBinding + Policy` | `EdgeFulfillmentLedger + EdgeClosureDecision` | Action-result evaluation. It decides close, yield, retry, repair, re-enter, reprice, or block for the action just taken. It does not choose the next graph action. |

The word `evaluator` is not sufficient by itself. A design, ticket, code module,
or proof must name which function it is implementing or consuming:
`synthesize_model`, `eval_gap`, `evaluate_next`, or `evaluate_action`.

Intent has lineage through the loop. Bootstrap or external intent may come from a
human, imported source, prior product, or intent engine. That intent seeds the
product asset model used by `eval_gap`. Current construction intent is
synthesized against that model and the observed gap, then admitted by a distinct
admission step after `evaluate_next` selects a published graph action. Intent
does not invent unpublished actions; gap-derived action selection provides the
selected action basis for admitting current construction intent over an
already-published graph function or vector. `ConstructionIntent` must cite the
lineage, selected action, and `TargetObligationBinding` that preserve the exact
selected Product outcome and any admitted bounded-basis refs.

The loop is governed by these axioms:

**A0. One Surface**

There is one authoritative computational surface for traversal consequence:

```text
IntentLineage
-> ProductAssetModel
-> ObservationSnapshot
-> GapPressureRow
-> TargetObligationBinding
-> PriorityProjection
-> ConstructionIntent
-> AdmittedEvidence
-> EdgeFulfillmentLedger
-> EdgeClosureDecision
-> NextActionProjection
```

No CLI branch, prompt prose, postflight string, gap-dossier action list, query
projection, service method, or local operator summary may become a rival source
of traversal truth.

**A1. Worksite Is Observed, Not Trusted**

The file system, process output, screen logs, worker artifacts, and product
files are observations. They become authority only after admission into typed
evidence and fold into ledger and decision truth.

**A1a. Workspace-Ledger Governed Work Pair**

The worksite/workspace and ledger form the governed work pair:

```text
W = mutable workspace under construction
L = immutable governed ledger of work over W
E = immutable event log / replay spine
Ev = evaluator work over L
```

The workspace is where F_P construction occurs. The ledger is the immutable
governed account of closure-relevant work over that workspace. The ledger is not
a copy of the workspace; it is the admitted trace of callout basis, observed
deltas, file refs, digests, execution evidence, obligations touched, claims
made, evaluator inputs, evaluator outputs, and admission status.

The loop is:

```text
F_P acts in W.
Admission records governed facts in L.
E orders and anchors L entries with predecessor refs.
Ev evaluates a declared L snapshot, not ambient W.
Ev output is itself F_P work and is admitted back into L/E.
L/E constrain the next lawful F_P action in W.
```

The consistency rule is:

```text
W can change without being true.
L can be true without being the whole W.
Closure can only use W through L.
Eval can only judge W through L.
Eval only affects traversal after its own L/E admission.
```

Every closure-relevant F_P callout that does work needs ledger admission.
Evaluator work is not outside F_P merely because it reads ledgers. Evaluator work
is F_P work over governed ledger state, and its result must be admitted into the
immutable ledger/event spine before it can affect closure, routing, or traversal.
Corrections append or supersede ledger/event facts; they do not rewrite the
governed history of work.

**A1b. Ledger Is Governed Attention**

A ledger is the system's governed attention over construction history.

This is a structural analogy, not an implementation dependency on transformer
attention. Model attention selects from context through learned weights. ODD
ledger attention is typed, immutable, lineage-constrained, policy-bounded, and
replayable.

An evaluator may attend only to admitted ledger rows reachable through declared
lineage, predecessor refs, target binding, policy, and the relevant event-log
cursor. Workspace facts, worker prose, archives, summaries, or controller memory
outside that reachable ledger set are not inside the evaluator's lawful
attention surface.

Lineage is therefore not only provenance bookkeeping. Lineage is the attention
graph: it determines which evidence the evaluator may see, what must be ignored,
and which predecessor chain makes the judgment reproducible.

**A2. Exact Target Binding**

Every constructive action must bind the current gap to exact target assets and
obligations before invocation:

```text
selected Product outcome ref
+ optional admitted prerequisite or experiment basis ref
+ gap pressure + target assets + required roles + evidence refs
-> TargetObligationBinding
```

A broad edge cannot satisfy a specific product or evidence gap unless the
binding proves that edge is the lawful action for those exact assets.

**A3. Published Action Law**

`evaluate_next` may rank only published lawful actions from the action catalog.
If the desired action is unpublished, the lawful result is a typed no-action
disposition, not fallback to a broad executive graph or local script.

**A4. Evaluate_Next Totality**

`evaluate_next` must be total.

If `NextActionBasis` is `initial_selection`, `evaluate_next` selects from the
current model, current gap, target binding, catalog, and policy. If
`NextActionBasis` is `post_yield_resume`, `evaluate_next` resumes or yields the
same edge from replay-visible resume truth without classifying the action as
failure. If `NextActionBasis` is `post_close_graph_continuation`,
`evaluate_next` may select the next graph edge after the current edge is closed,
or no action when the graph is complete. For `post_retry`, `post_repair`,
`post_reenter`, and `post_block`:

```text
if higher-priority lawful action exists:
  select it
else if current graph edge remains lawful:
  follow the graph
else if authority is missing:
  reprice or block
else:
  block with typed no-action disposition
```

For `post_reprice`, `evaluate_next` must return a typed no-action disposition
while constitutional re-entry remains unresolved. The reprice decision cannot
authorize a replacement action. Work may be evaluated again only after lawful
re-entry separately admits an exact selected Product outcome or bounded basis
and supplies it through a new `initial_selection` or basis-bearing resume.

Default graph following is ordinary, but it is still an `evaluate_next`
decision, not hidden sequential control.

**A4a. Evaluation Function Separation**

`synthesize_model`, `eval_gap`, `evaluate_next`, and `evaluate_action` are
separate authority functions.

`synthesize_model` may synthesize the current product asset model from
event-log-backed intent lineage, prior model, and admitted product truth only.
It must not observe the worksite, admit construction intent, invoke work, close
work, or select next action.

`eval_gap` may emit observation and gap pressure only. It must not admit
construction intent, invoke work, close work, or select next action.

`evaluate_action` may fold admitted action evidence into ledger and closure
decision only. It must not select the next graph action.

`evaluate_next` may bind target obligations, rank lawful published actions, and
publish next-action projection. It must not admit construction intent or decide
whether the prior action closed, yielded, failed, or requires repair except by
consuming the admitted `EdgeClosureDecision`.

Any module that lets one of these functions perform another function's authority
creates a rival control surface and violates A0.

**A5. F_P Freedom, F_D Authority**

F_P may inspect, discover, reason, draft, transform, and propose within the
bounded action. F_P must not close the edge, emit runtime events, mutate ledgers,
or decide re-entry. F_D/ABG/product admission owns durable evidence and closure
truth.

**A6. Evidence Before Closure**

No edge closes from raw artifact presence, raw worker report, raw process
success, or CLI summary. Closure is a fold over admitted evidence:

```text
AdmittedEvidence
-> EdgeFulfillmentLedger
-> EdgeClosureDecision
```

**A7. Ledger Is Evidence, Not Action Selector**

`EdgeFulfillmentLedger` records evidence and convergence:

```text
counts
obligation rows
materialization refs
liveness refs
admission refs
edge_converged
```

It does not select the next action. Action selection belongs to `evaluate_next`
over `EdgeClosureDecision` plus fresh `eval_gap` truth.

**A8. Closure Decision Is A Sum Type**

The closure decision vocabulary is:

```text
close
yield
retry
repair
re-enter
reprice
block
```

Each disposition is replay-visible and must carry basis and reason refs
sufficient to reproduce the decision.

**A9. Yield Is Lawful Iterate**

`yield` is the lawful iteration boundary:

```text
same edge or attempt remains lawful
progress or waiting state is admitted
resume basis is replay-visible
control returns without failure classification
```

Yield is not retry. Yield is not block. Yield is not timeout. Yield is not a
local CLI loop. It is the pressure-release state that lets long-running,
bounded, or partially productive work return control without losing the current
edge.

**A10. Liveness Does Not Close Semantic Truth**

Liveness observes activity, inactivity, process state, and interruption. It can
support yield or liveness interruption. It cannot by itself declare semantic
failure, semantic closure, or requirement non-satisfaction.

**A11. Re-Entry Is Graph Law**

Repair and re-entry are graph actions selected by `evaluate_next` from admitted
closure truth and published action authority. They are not local retry branches
over strings.

`evaluate_action` may emit `repair` or `re-enter` as a closure disposition.
`evaluate_next` selects which published graph action realizes that repair or
re-entry. Disposition is conceptual; selection is invocational.

**A12. Public Query Is A Read-Only Evaluation View**

A public query or gaps view may render read-only outputs from `eval_gap`,
`evaluate_action`, and `evaluate_next`: gap pressure, closure decision, and
next-action projection. It must not append events, invoke workers, admit intent,
run `evaluate_action`, or choose traversal by itself.

**A13. Replayability**

Every closure decision and next-action selection must be reproducible from:

```text
RuntimeEventLog
+ execution basis
+ ABG event-log-backed IntentLineage
+ ProductAssetModel publication basis and its event refs
+ selected Product outcome identity and admitted bounded-basis refs
+ GapPressureRow
+ TargetObligationBinding
+ ActionCatalog
+ admitted evidence
+ EdgeFulfillmentLedger
+ EdgeClosureDecision
+ NextActionBasis
+ visible policy refs
```

If replay cannot reproduce the decision, the implementation has created hidden
state.

**A13a. Causal Chain Integrity**

Each governing admitted or replay-derived carrier and projection in the loop
must reference its causal predecessor refs:

```text
selected Product outcome and admitted bounded-basis refs
-> TargetObligationBinding

IntentLineage
-> ProductAssetModel
-> GapPressureRow
-> TargetObligationBinding
-> PriorityProjection
-> NextActionProjection (selected_action)
-> ConstructionIntent
-> AdmittedEvidence
-> EdgeFulfillmentLedger
-> EdgeClosureDecision
-> NextActionBasis
-> NextActionProjection (next)
```

The target binding must be reachable from the exact selected Product outcome
and any admitted bounded-basis refs. The first `NextActionProjection` in the
chain carries the selected action that admits `ConstructionIntent`, which
preserves those authority refs. The second `NextActionProjection` is the
post-action projection produced from `NextActionBasis` plus fresh `eval_gap`
truth. Both must be reachable from their predecessor refs.

A13 requires that the decision can be reproduced from the inputs. A13a
requires that each governing carrier or projection carry the predecessor refs
that make reproduction reachable without external joins. A broken predecessor
chain is non-replayable at the carrier level and therefore fails A13.

**A14. Recursive Published Refinement**

The homeostasis loop recurses over published refinement.

If a graph function refines an outer vector into published inner vectors, each
inner vector boundary obeys `synthesize_model`, `eval_gap`, `evaluate_next`, and
`evaluate_action` with its own visible model, gap, binding, action, evidence,
ledger, closure, and next-action projection.

If the inner realization is intentionally opaque, it is ordinary implementation
inside one bounded action. It may use local control flow to compute the action's
internal result, but it must not publish, dispatch, retry, repair, re-enter, or
close graph work as a hidden traversal controller. Once a refinement is
published as graph structure, it is governed by the loop recursively.

**A15. Method Ownership**

ABG owns runtime truth, event replay, graph-call lifecycle, actor/process
supervision, continuation, and re-entry mechanics. The product owns domain asset
meaning, graph-function catalog meaning, gap interpretation, and priority
policy. Design Module Method governs realization modules inside that split; it
must not fragment `eval_gap`, `evaluate_next`, or `evaluate_action` into
module-local decision authorities.

**A16. Constitutional Override**

For any ticket, design, code module, or proof that touches `synthesize_model`,
`eval_gap`, `evaluate_next`, `evaluate_action`, traversal, gap evaluation,
action selection, construction intent, worker invocation, evidence admission,
fulfillment, liveness, closure, re-entry, public query, or live proof, the
causally applicable members of this axiom set and the constitutional equation
are the controlling acceptance constraints for the selected Product outcome
and affected published boundary. Unchanged accepted relations cite their
accepted basis rather than being re-proven. The axiom family does not authorize
horizontal realization growth, create Product work, or widen the selected
outcome.

Ticket-local closure wording, test names, source-grep checks, compact CLI
summaries, or implementation notes cannot weaken the constitutional loop. If a
ticket appears complete by its local checklist but leaves a rival traversal
consequence path, the ticket is not constitutionally complete. The lawful
result is to request lawful re-entry, keep the gap as a closure blocker, or
admit separately bounded paydown under an independently selected Product
outcome or prerequisite basis.

The following artifacts may provide evidence, diagnostics, or read-model
context only. They must not independently close an edge, select a next action,
or route retry, repair, or re-entry:

```text
gap dossier
postflight report
assurance report
materialization manifest
runtime liveness projection
run summary
worker prose
screen or PTY transcript
prompt package
harness target argument
source-grep test
CLI branch or compact output
public query or gaps view
service method output
```

If any of those artifacts conflict with the admitted `EdgeFulfillmentLedger`,
`EdgeClosureDecision`, or `NextActionProjection`, the ledger, decision, and
projection chain wins. If that chain is absent, the edge has not
constitutionally closed and the next action has not been constitutionally
selected.

The constitutional equation is:

```text
let U = (selected_product_outcome_ref, optional_admitted_bounded_basis_ref)
let L = project_intent_lineage_from_event_log(source_intent_refs, prior_intent_refs)
let M0 = synthesize_model(L, prior_model, admitted_product_truth)
let G0 = eval_gap(M0, RuntimeEventLog, RuntimeProjection, Worksite)
let O = G0.observation
let B0 = bind(U, G0.pressures, ActionCatalog, target obligations)
let Q0 = initial_selection(L, M0)
let N0 = evaluate_next(Q0, G0, B0, ActionCatalog, Policy)
let I = admit_construction_intent(L, B0, N0.selected_action, N0.next_action_projection)
let E = admit_evidence(invoke(I))
let A = evaluate_action(I, E, B0, Policy)
let M1 = synthesize_model(L, M0, admitted_product_truth)
let G1 = eval_gap(M1, RuntimeEventLog, RuntimeProjection, Worksite)
let B1 = bind(U, G1.pressures, ActionCatalog, target obligations)
let Q1 = next_action_basis_from(A.decision)
let N1 = evaluate_next(Q1, G1, B1, ActionCatalog, Policy)

return N1
```

Where:

```text
A.ledger = EdgeFulfillmentLedger
A.decision = EdgeClosureDecision
A.decision.disposition in {close, yield, retry, repair, re-enter, reprice, block}
Q0.kind = initial_selection
Q1.kind in {
  post_yield_resume,
  post_close_graph_continuation,
  post_retry,
  post_repair,
  post_reenter,
  post_reprice,
  post_block
}
Q1.kind = post_reprice and no separately admitted constitutional basis
  => N1 = typed no-action pending re-entry
```

The implementation is correct only when the next work decision is derived from
that equation, `U` remains causally reachable through the target binding and
construction intent, and no other path can decide what work happens next.

### 11.6 Product-Specific Semantics Sit Above The Shared Carrier

ODD method gives the product shape, not the domain semantics.

That means:

- the same ODD structural law can build many different domain products
- each product defines its own asset meanings, proof lanes, and query overlays

Do not confuse:

- structural GTL law
- product-specific semantic law

### 11.7 Manual Walkthrough Must Still Be Lawful

Automation must remain true for a manual walkthrough.

A human operator, using only the declared authority surfaces, should be able to:

1. identify the current asset state (current typed asset or node)
2. identify the next lawful vector and its public graph-function carrier (vector is the constitutional transition contract; the graph function is the published constructive program that realizes it — see §5.2 and §5.3)
3. determine the required inputs, evaluators, output contract, and carried environment
4. construct or assess the next asset (produced asset or checkpoint)
5. repeat until target-relative closure is reached

Automation may make this faster, safer, or more repeatable. It may not invent a different process.

**Automation is lawful** when it:

- renders prompts
- scaffolds artifacts
- selects the next traversal step
- runs workers
- collects evidence
- assesses closure

**Automation is unlawful** when it:

- skips undeclared nodes
- fabricates authority not present in the declared surfaces
- collapses multiple constitutional transitions into one opaque step without declaring the refinement
- depends on implementation-carrier knowledge that the installed product should not have
- collapses the installed builder and the product under development into one authority surface during self-host work

If the team cannot explain the manual traversal, the automation is not yet method-safe. If automation cannot be explained in these terms, it is ahead of the method.

### 11.7A Conforming Agentic Development

ODD method is the premise for conforming agentic development over the graph-native worksite. An agentic coder produces governed work by following the constitutional process over a minimal declared authority packet, with the artifacts it produces gated by admission. `SPEC_METHOD.md` governs the general constitutional process and `TICKET_METHOD.md` governs artifact admission; this section names the ODD specialization and composes that law rather than re-declaring it.

Conformance has two halves: an F_P proof that the process is followable, and an F_D gate that admits the produced artifacts.

**The walkthrough is the conformance proof.**

§11.7 requires automation to remain true for a manual walkthrough. The agentic form of that law is a conformance test of the method itself: an agentic coder executes the constitutional process end-to-end on real work — intake triage, smallest lawful re-entry, the spec/requirement/design/ticket chain, the constructive evaluation loop of §11.5D, and closure proof — using only the declared authority surfaces. The agentic coder is F_P over the constitutional process.

The agent works from a minimal declared authority packet, not from memory and not from wholesale hidden context. `SPEC_METHOD.md` already requires declared context — input/output contract, required context, role, evaluator regime, and provenance — for any agentic work unit. The ODD addition is that the packet carries only the smallest declared authority sufficient to decide the step, with its source refs, and that conformance is enforced by admitting the produced artifact rather than by enlarging what the agent must hold. Compression is prompt input, never the deciding authority.

The walkthrough proves at two levels:

- the work it produces must be lawful: correct change-class, traceable, admitted
- a point where the walkthrough cannot proceed is a method defect only when a competent agent, correctly configured and using the declared authority, still cannot decide — ambiguity, a missing step, contradictory authority, or an un-decidable change-class in an owning surface. That defect is repriced into the owning authority surface, the same way a failed manual traversal is a graph defect under §11.7.

An agent that ignored the declared authority, relied on stale memory, or reasoned badly has produced agent error, not a method defect. Admission rejects the malformed artifact either way, so a bad agent turn neither becomes law nor silently indicts the method.

This proof is independent of any automated runtime. A live lane that depends on external execution conditions — an overloaded model API, a flaky transport — cannot prove the constitutional process is sound, because it conflates process validity with runtime availability. The walkthrough proves the process; the runtime only executes it.

**The validator is the conformance gate.**

The constitutional process is an interface contract, and interface conformance is enforced by validating artifacts against the contract, not by the conformer holding the contract.

ODD does not re-declare the artifact rules. Tickets, change-class declarations, design-module derivations, and execution contracts are admitted under `SPEC_METHOD.md` and `TICKET_METHOD.md`, which already require that a drafted classification be admitted or rejected against deterministic criteria rather than taken as automatic truth. ODD requires only that agentic development pass through that admission: the agentic coder produces the artifact; the declared admission gates it deterministically, fail-closed, naming the violated rule — exactly as a typed asset is enforced by its constructor (§11.1).

This preserves the F_P/F_D split at the method layer. The agentic coder is F_P: it reasons, drafts, and proposes within the declared packet. Admission is F_D: it decides whether the produced artifact conforms. The walkthrough establishes that the process is followable; admission establishes that each act of following it conforms.

**Conformance is not approval-by-usage.**

A passed admission and a completed walkthrough are conformance evidence, not ratification. Shared method change still follows §9: grey work is not made constitutional by repeated agentic execution. The agentic coder conforms to the method; it does not amend the method by acting.

### 11.7B Real Authority-Path Negative Proof (`STDO-UP-010`)

Negative proof for an ODD or graph-native boundary exercises the supported
Product authority path. It must not manufacture the refusal state, blocked
event, gap, or verdict that the system is supposed to derive.

Closure-grade negative evidence identifies the supported entry and governing
authority, invalidates the real authority-bearing input, exercises the
supported path, proves refusal before the prohibited effect, and establishes
that no legacy, fallback, reconstruction, or parallel path succeeds. Source,
packaged, installed, and runtime absence are distinct claims.

Where these identities apply, the supported relation is:

```text
public entry
  -> admitted GTL composition owns traversal topology
  -> named GraphFunction supplies the callable work contract
  -> implementation or plugin binding realizes only its admitted seam
  -> ABG owns traversal, event, continuation, and replay truth
  -> replay-derived projection
  -> typed Product outcome or continuation
```

No CLI, SDK, service, adapter, plugin, fixture, query, or projection may become
a rival traversal controller. The consumer owns the concrete test and evidence
mechanism; this section owns the property that mechanism must prove.

### 11.8 Cumulative Environment Law Is Mandatory

Do not model composition as "the last output feeds the next input".

The real ODD law is cumulative typed environment.

Each retained `GraphFunction` should declare:

- `environment.requires`
- `environment.provides`
- `environment.carries`

Later functions may require any typed binding available in the cumulative carried environment, not only the immediately previous output.

If a product publishes graph functions without this cumulative environment law, the line is graph-shaped but structurally wrong.

### 11.9 Global Convergence Must Be Stable Under Zoom

Local green arcs are not enough.

If an outer public carrier is refined into inner executable structure, then:

- the refined inner chain must close lawfully
- the enclosing coarse contract must also remain true after fold-back
- zoomed and unzoomed views must agree on whether the enclosing carrier is open or closed

For current product closure, live current requirements that lack an executable proof witness keep the enclosing carrier open until they are:

- realized
- explicitly deferred
- explicitly repriced out of the active branch

For the active software line, the immediate pressure is usually realized testcase or archived test evidence, but the governing law is proof-lane aware: the witness must be a governed realized proof surface appropriate to the requirement class.

---

## 12. Scenario Rule

Scenarios are graph-native proving surfaces.

They are not only test documentation.

A scenario bundle should make clear:

- which feature or use-case boundary is being exercised
- which assets are expected to exist before the scenario starts
- which vectors are expected to be traversed
- which significant paths are expected to be exercised
- what evidence closes the scenario

The best proving paths come from declared scenarios and use cases because they pressure both feature intent and design decisions.

That makes them the best source for selecting the significant code and control paths the system must exercise.

---

## 13. Installed-Dev Rule

Where the product has an installable development form, decisive proof runs against that installed development form in an isolated environment.

For a graph-native ODD product, this means the proving lane should exercise:

1. install
2. project bootstrap
3. graph traversal
4. evidence collection
5. target-relative closure

Direct source checks remain useful. They do not replace installed-dev proof.

---

## 14. Dogfooding Rule

The product should be developed through the same graph-native method it claims to provide.

Where the product provides ODD framework behavior, it must build that behavior
through ODD graph functions. It must not merely publish ODD-shaped artifacts
after imperative execution has already decided the work.

That means the project should increasingly describe and build itself through:

- explicit assets
- explicit vectors
- explicit graph functions
- explicit scenario bundles
- explicit target-relative closure

The method is stronger when the product can walk itself.

---

## 15. Release Boundary

Release version is not constitutional graph truth.

Release version belongs to the release process and release metadata.

The graph-native method concerns:

- current assets
- current vectors
- current closures
- current authority

Release tapping remains a separate process surface.

---

## 16. Failure Pattern

The method is being violated when any of these are true:

1. a claimed product step has no corresponding node or vector
2. a graph function exists with no clear outer contract
3. automation performs work that cannot be described as a manual traversal
4. the installed product depends on authoring-carrier knowledge that a clean target project should not contain
5. scenarios cannot name the significant paths they intend to prove
6. the project claims closure without target-relative evidence
7. the cumulative environment law is bypassed by "last-output feeds next-input" wiring
8. zoomed and unzoomed views disagree about whether a carrier is closed
9. imperative service code owns an operative transition that has no published graph-function outcome contract
10. framework behavior is implemented as workspace orchestration first and only later described with GTL vocabulary
11. imperative code decides closure, continuation, semantic target movement, or lineage truth outside declared graph-function, ABG runtime, or product-owned carrier truth
12. a GTL/ABG product or plugin carries hidden execution authority for
    traversal loops, actor invocation, process supervision, retry,
    continuation, runtime events, projection, or closure folds
13. yield or lawful iteration is flattened into retry, block, timeout, local
    waiting state, or a hidden CLI loop instead of being represented as
    replay-visible closure disposition
14. a public query, gaps view, postflight string, service method, or installed
    operator summary can decide next work outside the constructive evaluation
    loop
15. a constitutional process cannot be followed end-to-end by an agentic coder
    from the declared authority, or a produced constitutional artifact is
    accepted without passing deterministic admission (§11.7A)

---

## 17. Invocation Rule

When an agent or designer is instructed:

`using ODD_METHOD, build this product`

the expected sequence is:

1. read `SPEC_METHOD.md` and keep the constitutional chain intact
2. read the product-specific method if one exists
3. read the local product authority surfaces:
   - `INTENT.md`
   - `PRODUCT.md`
   - relevant requirement families
   - active design surfaces
4. identify the product's semantic chain from source to published outcome
5. identify the domain-specific typed assets or nodes
6. identify the public graph-function carriers
7. define the machine-readable function catalog
8. define or update the GTL module, including outer callable carriers and live traversal boundaries
9. define how coarse carriers, refined inner carriers, and executable proof lanes close together without scale contradiction
10. complete the execution-authority audit for affected runtime, plugin,
    worker, event, projection, assurance, closure, or continuation surfaces
11. define the constructive evaluation loop from intent lineage and model
    synthesis through observation, target binding, lawful action selection,
    admitted evidence, fulfillment ledger, closure decision, and next-action
    projection
12. define the closure decision vocabulary, including `yield` as lawful
    iteration rather than retry, block, timeout, or local waiting state
13. define the projection/query lane as projection over admitted constructive
    history, including the structural coherence rule between the read model and
    its source carrier
14. only then implement code, policy, and transport surfaces

The instruction does **not** mean:

- start from imperative scripts and add GTL words later
- treat graph functions as documentation wrappers
- let service code become the hidden real carrier

---

## 18. Cold-Start Reading Order

When starting cold in a concrete ODD product, use this order.

### General ODD Product

1. `SPEC_METHOD.md`
2. `ODD_METHOD.md`
3. product `INTENT.md`
4. product `PRODUCT.md`
5. relevant product requirements
6. active design surfaces
7. GTL module, function catalog, and query surfaces

### World-Model Product

1. `SPEC_METHOD.md`
2. `ODD_METHOD.md`
3. `WORLD_MODEL_METHOD.md`
4. product `INTENT.md`
5. product `PRODUCT.md`
6. relevant requirement families
7. current design surfaces
8. GTL module, function catalog, query surfaces, and proof lane

The practical rule is:

- `ODD_METHOD.md` sets the structural expectation
- the product-specific method sets the domain law
- the local product surfaces set the current build line

If an LLM skips that ordering, it will usually either:

- understand the paradigm but miss the domain
- or understand the domain but realize it through the wrong carrier

---

## 19. Ramp-Up Checklist

An LLM ramping into an ODD product should quickly answer:

1. What is the product's semantic chain from source to published outcome?
2. What are the typed domain assets or nodes?
3. What are the public graph functions?
4. Where is the machine-readable function catalog?
5. Where is the GTL module?
6. What belongs to ABG versus the product?
7. What is the projection/query lane?
8. What admitted carrier, runtime, event, or source truth does each projection
   derive from, and how does it fail closed on structural drift?
9. What proves that execution authority has not escaped ABG into product or
   plugin code?
10. What is the product's constructive evaluation loop from observation to next
    lawful action?
11. What are the closure decision dispositions, and how is `yield` represented
    as replay-visible lawful iteration?
12. What proof surfaces close the current capabilities?
13. What outer carrier remains open if a refined inner lane is green but live requirements still lack executable proof?
14. Can an agentic coder follow the constitutional process from the declared authority alone, and do the artifacts it produces pass deterministic admission?

If those questions cannot be answered quickly, the product is not yet sufficiently ODD-shaped.

---

## 20. Canonical Compression

ODD method is the graph-native product-authoring method for building GTL/ABG domain products. It requires typed domain assets, named graph functions, a published function catalog, a GTL module as the operative carrier, ABG-owned execution authority, one constructive evaluation loop from observation to next lawful action, projection/query surfaces that expose current state as projection over constructive history, and automation that remains explainable as a lawful manual traversal of the same graph. Operative framework behavior must be built outcome-first: outcome traversals first, declarative GTL/ABG carrier structure second, and minimal imperative adapter code last. Yield is the lawful iteration boundary, not retry, block, timeout, or a hidden local loop. Agentic development conforms by following the constitutional process from a minimal declared authority packet, with produced artifacts passing deterministic admission: the agentic walkthrough proves the process is followable, and admission proves each act conforms.

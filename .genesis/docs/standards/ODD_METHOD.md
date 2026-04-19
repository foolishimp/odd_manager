# ODD Method

**Governance**: Maintained by the methodology author.

**Scope**: Constitutional product-authoring method for ODD products built over
GTL and ABG.

**Relation**: Refines `SPEC_METHOD.md` and composes with `GRAPH_METHOD.md`.
Use this method when building an ODD product or repricing an imperative
prototype into an ODD product.

Use `GLOSSARY_GUIDE.md` for shared recursive-product terminology unless this
method explicitly narrows a term.

---

## Position

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
- let ABG own traversal, runtime facts, and provenance
- expose visible current state as projection over constructive history

This is a programming paradigm, not only a documentation preference.

The paradigm is:

`product = typed asset/domain model + GTL-defined graph functions + ABG runtime + governed projection/query surfaces`

If the constructive carrier remains hidden in imperative loops, local service
logic, or product-specific orchestration scripts, the product is not yet built
using ODD method.

---

## Method Role

`SPEC_METHOD.md` defines the general constitutional method.

`GRAPH_METHOD.md` defines the constitutional method for graph-native products.

`ODD_METHOD.md` defines the product-authoring method for ODD products that use
GTL-defined graph functions as the primary constructive carrier.

The role split is:

- `SPEC_METHOD.md`
  - constitutional baseline for goals, intent, product, requirements, design,
    and lawful re-entry
- `GRAPH_METHOD.md`
  - constitutional law for graph-native execution, assets, vectors, traversal,
    and graph functions
- `ODD_METHOD.md`
  - product-authoring law for building an ODD product correctly over that
    substrate

This method does not replace product-specific methods such as
`WORLD_MODEL_METHOD.md`.

Where a product is both ODD and world-model-driven:

- `ODD_METHOD.md` governs ODD product shape
- `GRAPH_METHOD.md` governs graph-native carrier and traversal law
- `WORLD_MODEL_METHOD.md` governs world-model semantics, publication, and
  composition law

Those methods compose.

---

## Method Composition

`ODD_METHOD.md` is not meant to be sufficient on its own for domain-correct
product work.

It gives the structural law for how an ODD product should be built.

It does not, by itself, give:

- the product's domain semantics
- the product's current intent and product-definition line
- the product's local capability and constraint requirements
- the product's currently ratified design surfaces

So the composition rule is:

- `ODD_METHOD.md` tells you how to build the product as an ODD product
- domain methods tell you what semantic law the product must honor
- local `INTENT.md`, `PRODUCT.md`, requirements, and design tell you the
  currently ratified local line

Examples:

- for `odd_sdlc`
  - `ODD_METHOD.md` provides the shared ODD structural law
  - `GRAPH_METHOD.md` provides graph-native constitutional law
  - `odd_sdlc` `INTENT.md`, `PRODUCT.md`, requirements, ADRs, and GTL surfaces
    provide the local product line

- for `odd_domain`
  - `ODD_METHOD.md` provides the shared ODD structural law
  - `GRAPH_METHOD.md` provides graph-native constitutional law
  - `WORLD_MODEL_METHOD.md` provides world-model semantic law
  - `odd_domain` `INTENT.md`, `PRODUCT.md`, requirements, and design provide
    the local product line

If an agent reads only `ODD_METHOD.md`, it should understand the paradigm.

If it needs to build one concrete product correctly, it must then read the
product-specific method and local authority surfaces.

---

## Derived Guidance

This method should be read together with:

- the `abiogenesis` builder guide: `LLM_GTL_APP_BUILDER_GUIDE.md`
- the `odd_sdlc` product design guide: `LLM_ODD_SDLC_GUIDE.md`

Those guides are operational builder aids.

This document is the constitutional method surface that makes their shared
pattern explicit and reusable beyond `odd_sdlc`.

When those guides are available in the current source tree or installed product
line, prefer reading them by canonical document name and owning product lineage
rather than by one machine-local absolute path.

`odd_sdlc` is the canonical reference implementation of the pattern today.

The point is not to copy SDLC-specific asset names.

The point is to copy the structural law.

---

## Responsibility Layers And Local Binding

`ODD_METHOD.md` governs structural responsibility layers and their required
publication shape.

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

If a product copies another product's local asset names without semantic need,
that is not reuse of method. It is accidental doctrine transfer.

If a product declares a capability in prose but does not bind it into typed
assets, graph functions, and proof lanes, that capability is under-built.

---

## Method Governance And Audit

Products governed under `ODD_METHOD.md` should be audited against this method
as the shared ODD constitutional surface.

That audit should ask at minimum:

- what responsibility layer or capability class is being implemented
- what local typed assets or nodes bind that capability into the product
- what public graph functions carry the constructive transition
- what proof or closure lane justifies the capability
- what projected/query state is exposed without replacing ABG runtime truth

The governance rule is:

- approved shared-pattern work must update `ODD_METHOD.md` when it changes or
  clarifies the reusable ODD structural law
- product-local work may remain local if it does not change shared ODD law

Grey work must not be silently absorbed into the line.

When an implementation or design move is not clearly covered by the current
method, it must be evaluated against `ODD_METHOD.md` and resolved as one of:

- compliant with the current method
- non-compliant with the current method
- valid and worth incorporation into `ODD_METHOD.md`

If the result is incorporation, the implementation is not fully approved until
the method surface is updated accordingly.

If the result is non-compliance, the implementation should be repriced, repaired,
or rejected rather than normalized by repetition.

The practical rule is:

- no shared structural pattern becomes "approved by usage"
- no grey pattern becomes constitutional by drift
- reusable ODD law is ratified in `ODD_METHOD.md`
- local product law is ratified in the product's own authority surfaces

---

## What An ODD Product Is

An ODD product is a configured GTL/ABG domain product whose constructive work
is carried by published graph functions over typed domain assets.

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

### Product Specification

`specification/` is the authoritative `WHAT`.

It defines:

- intent
- product position
- goals
- requirements
- scenarios

### Product Realization

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
- graph-call realization
- runtime facts
- frames
- continuations
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

Do not hide the real constructive carrier behind the word `service`.

---

## Core Law

An ODD product is built correctly only when all of the following are true.

### 1. Typed Assets And Nodes Are Explicit

The product works over explicit typed assets or typed nodes.

It does not work over:

- one hidden project blob
- one giant mutable workspace object
- one undocumented service payload

Concrete assets must bind explicitly into typed domain boundaries.

Where an asset is a real produced or consumed boundary, declare its
`asset_surface`.

### 2. Graph Functions Are The Primary Constructive Carrier

Every operative constructive step is carried by:

- one named `GraphFunction`, or
- one lawful graph-function composition

Do not leave the real carrier inside:

- orchestration loops
- bespoke Python pipeline runners
- controller scripts
- service methods that only happen to call GTL-adjacent helpers

### 3. The Function Catalog Is Published

The live line must publish a machine-readable function catalog.

At minimum, each retained function should expose:

- name
- inputs
- outputs
- intent
- public or helper role

If the callable surface exists only in prose or prompt memory, the product is
under-built.

### 4. The GTL Module Is The Operative Publication Surface

The product must publish:

- the public graph-function carriers
- the graph or graphs those carriers traverse
- typed node and vector surfaces
- semantic jobs or equivalent outer callable contracts bound to the public
  carrier

Do not bind callers directly to hidden inner vectors.

Where a public carrier refines into inner executable structure, publish the
live traversal boundaries explicitly through lawful GTL boundary surfaces such
as `RefinementBoundary` or `CandidateFamily`.

The outer public carrier remains the callable contract.

### 5. Current State Is A Projection Over Constructive History

Visible current state is a projection.

It is not a replacement for runtime truth.

The ODD query lane may expose:

- asset views
- function catalog views
- checkpoint overlays
- provenance overlays
- domain-specific explainability overlays

It must not redefine ABG runtime facts.

### 6. Product-Specific Semantics Sit Above The Shared Carrier

ODD method gives the product shape, not the domain semantics.

That means:

- the same ODD structural law can build `odd_sdlc`, `odd_domain`, and future
  domain products
- each product defines its own asset meanings, proof lanes, and query overlays

Do not confuse:

- structural GTL law
- product-specific semantic law

### 7. Manual Walkthrough Must Still Be Lawful

Automation must remain true for a manual walkthrough.

A human should be able to identify:

- the current typed assets
- the next lawful graph function
- the required carried environment
- the produced asset or checkpoint
- the proof or gap outcome

If automation cannot be explained in those terms, it is ahead of the method.

### 8. Cumulative Environment Law Is Mandatory

Do not model composition as "the last output feeds the next input".

The real ODD law is cumulative typed environment.

Each retained `GraphFunction` should declare:

- `environment.requires`
- `environment.provides`
- `environment.carries`

Later functions may require any typed binding available in the cumulative
carried environment, not only the immediately previous output.

If a product publishes graph functions without this cumulative environment law,
the line is graph-shaped but structurally wrong.

### 9. Global Convergence Must Be Stable Under Zoom

Local green arcs are not enough.

If an outer public carrier is refined into inner executable structure, then:

- the refined inner chain must close lawfully
- the enclosing coarse contract must also remain true after fold-back
- zoomed and unzoomed views must agree on whether the enclosing carrier is
  open or closed

For current product closure, live current requirements that lack an executable
proof witness keep the enclosing carrier open until they are:

- realized
- explicitly deferred
- explicitly repriced out of the active branch

For the active software line, the immediate pressure is usually realized
testcase or archived test evidence, but the governing law is proof-lane aware:
the witness must be a governed realized proof surface appropriate to the
requirement class.

---

## Invocation Rule

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
8. define or update the GTL module, including outer callable carriers and live
   traversal boundaries
9. define how coarse carriers, refined inner carriers, and executable proof
   lanes close together without scale contradiction
10. define the projection/query lane as projection over constructive history
11. only then implement code, policy, and transport surfaces

The instruction does **not** mean:

- start from imperative scripts and add GTL words later
- treat graph functions as documentation wrappers
- let service code become the hidden real carrier

---

## Cold-Start Reading Order

When starting cold in a concrete ODD product, use this order.

### General ODD Product

1. `SPEC_METHOD.md`
2. `GRAPH_METHOD.md`
3. `ODD_METHOD.md`
4. product `INTENT.md`
5. product `PRODUCT.md`
6. relevant product requirements
7. active design surfaces
8. GTL module, function catalog, and query surfaces

### World-Model Product Such As odd_domain

1. `SPEC_METHOD.md`
2. `GRAPH_METHOD.md`
3. `ODD_METHOD.md`
4. `WORLD_MODEL_METHOD.md`
5. product `INTENT.md`
6. product `PRODUCT.md`
7. relevant requirement families
8. current design surfaces
9. GTL module, function catalog, query surfaces, and proof lane

The practical rule is:

- `ODD_METHOD.md` sets the structural expectation
- the product-specific method sets the domain law
- the local product surfaces set the current build line

If an LLM skips that ordering, it will usually either:

- understand the paradigm but miss the domain
- or understand the domain but realize it through the wrong carrier

---

## Ramp-Up Checklist

An LLM ramping into an ODD product should quickly answer:

1. What is the product's semantic chain from source to published outcome?
2. What are the typed domain assets or nodes?
3. What are the public graph functions?
4. Where is the machine-readable function catalog?
5. Where is the GTL module?
6. What belongs to ABG versus the product?
7. What is the projection/query lane?
8. What proof surfaces close the current capabilities?
9. What outer carrier remains open if a refined inner lane is green but live
   requirements still lack executable proof?

If those questions cannot be answered quickly, the product is not yet
sufficiently ODD-shaped.

---

## Canonical Compression

ODD method is the product-authoring method for building GTL/ABG domain
products. It requires typed domain assets, named graph functions, a published
function catalog, a GTL module as the operative carrier, and projection/query
surfaces that expose current state as projection over constructive history.

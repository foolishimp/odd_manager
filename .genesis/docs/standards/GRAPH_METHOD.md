# Graph Method

**Governance**: Maintained by the methodology author.

**Scope**: Constitutional method for graph-native products.

**Relation**: Refines `SPEC_METHOD.md`. For graph-native work, this is the stronger method surface.

Use `GLOSSARY_GUIDE.md` for shared terminology unless this method explicitly
narrows a term for graph-native work.

---

## Domain View

This domain is software development itself.

`genesis_sdlc` provides the software-development process domain. It does not
provide the target project's business domain.

That means the product is best understood as a declared asset graph over the
software-development process:

- assets are states of truth or delivery
- vectors are lawful transitions between those states
- graph functions are constructive programs over those transitions
- traversal builds the next assets until a selected target closes

GTL is the language expression of this method.

It provides the node, vector, and graph-function vocabulary needed to declare
the product in graph terms.

ABG is the execution and binding runtime that traverses and realizes that GTL
program.

The graph is not decoration around the process. The graph is the process model.

This document exists because the general spec-driven method is not specific
enough once the product is understood in those terms.

A graph-native product needs a graph-native constitutional method.

The method therefore has two jobs:

1. describe the product in graph terms
2. ensure automation never outruns a lawful manual traversal of the same graph

---

## Position

`SPEC_METHOD.md` defines the philosophical baseline.

`GRAPH_METHOD.md` defines the constitutional what and how for graph-native
delivery.

For `genesis_sdlc`, this is the constitutional enforcing method surface for the
software-development-process domain.

`*_GUIDE.md` files explain how to operate within the method.

`*_TEMPLATE.md` files are starter scaffolds and examples. They are convenience
surfaces, not constitutional authority.

This document does not replace intent, requirements, design, code, evidence, or
repricing.

It gives them a stricter shape:

- assets are typed nodes
- transitions are vectors
- constructive work is realized as graph functions
- progress is target-relative traversal over the graph

The practical consequence is simple:

the product should be walkable by hand in the same terms that automation uses.

If automation cannot be explained as a lawful manual traversal over declared assets and vectors, the automation is ahead of the method.

This method also inherits the recursive product taxonomy from
`SPEC_METHOD.md`.

For graph-native work, keep the distinction explicit between:

- the released graph-native product
- the installed instance of that product
- the mutable source project building the next release cut
- `PRODUCT.md` as the product-definition surface of that mutable source project

Where a graph-native product is also world-model-driven:

- `GRAPH_METHOD.md` governs graph-native execution, traversal, and graph law
- `WORLD_MODEL_METHOD.md` governs world-model semantics, publication, and
  composition law

Those methods compose over the same product rather than replacing one another.

---

## Method Folder Semantics

`.genesis/docs/standards/` is the installed methodology library root for a
project workspace.

It contains three classes of document:

- `*_METHOD.md` — constitutional method surfaces
- `*_GUIDE.md` — operational guides and application standards
- `*_TEMPLATE.md` — reusable starter forms and examples

Only `*_METHOD.md` documents are constitutional method surfaces.

`*_GUIDE.md` documents refine application of the method.

`*_TEMPLATE.md` documents are convenience artifacts only.

---

## Core Rule

Every automation must be true for a manual walkthrough.

That means a human operator, using only the declared authority surfaces, should be able to:

1. identify the current asset state
2. identify the next lawful vector
3. determine the required inputs, evaluators, and output contract
4. construct or assess the next asset
5. repeat until target-relative closure is reached

Automation may make this faster, safer, or more repeatable.

It may not invent a different process.

---

## Graph Model

### Nodes

Nodes are durable truth surfaces or product assets.

Examples:

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

Each node names a bounded state of truth.

### Vectors

Vectors are lawful transitions between nodes.

Each vector declares:

- required upstream assets
- target asset
- governing evaluators and gates
- output contract

Vectors are the admissible transitions of the product.

### Graph Functions

Graph functions are named constructive programs that realize vectors.

A graph function may:

- realize one outer vector directly
- refine one outer vector into a small inner workflow
- act as a reusable higher-order library function

The outer vector remains the constitutional contract.

The graph function is the constructive realization of that contract.

### Traversal

The workflow is a traversal over the graph.

Traversal means:

- bind the current target
- locate the next admissible vectors
- traverse one vector
- materialize the next asset
- prove the vector closed
- continue until the selected target closes

The graph is not only a diagram.

It is the declared program space of the product.

---

## Product Boundary

The graph-native product and the project built with it are distinct.

For `genesis_sdlc`, the product provides the software-development domain.

It does not provide the target project domain.

The canonical software-development-process doctrine therefore belongs with
`genesis_sdlc`, not with any particular engine implementation.

A clean install therefore means:

1. install the generic SDLC product
2. author the target project's intent, product definition, requirements, and build tenant
3. traverse the product graph to build the target project's software

The installed product owns:

- the graph-native SDLC method
- runtime and control surfaces
- command surfaces
- release-managed methodology surfaces
- project scaffold templates

The target project owns:

- `GOALS.md`
- `INTENT.md`
- `PRODUCT.md`
- `requirements/`
- `build_tenants/`
- project design, code, tests, docs, and evidence

The installed product must not assume prior knowledge of the target project's domain.

## Self-Host Boundary Rule

Self-hosting is lawful only when the installed product under use remains
distinct from the product under development.

For `genesis_sdlc`, that means a released installed `genesis_sdlc` may help
build the next `genesis_sdlc` version, but the two must not collapse into one
mixed authority surface.

The required distinction is:

- installed released builder
- in-development product being built

This is the same boundary preserved when one compiler release builds the next
compiler release.

The framework should therefore preserve distinct:

- territories
- authority surfaces
- runtime state
- project-owned specification and build-tenant surfaces

If automation, runtime resolution, or qualification silently merges those
surfaces, the framework is violating the method.

---

## Constitutional Stack

The graph-native constitutional stack is:

1. `GOALS.md`
2. `INTENT.md`
3. `PRODUCT.md`
4. `requirements/`
5. design surfaces
6. module decomposition
7. realization surfaces such as code and tests
8. evidence and target closure

The role of each layer is distinct.

### `GOALS.md`

`GOALS.md` defines the current overriding concerns for the active body of work.

It is more immediate than intent and higher-level than requirements.

It keeps temporary focus and current wave direction out of the deeper
constitutional surfaces until they are intentionally repriced there.

### `INTENT.md`

`INTENT.md` defines:

- the problem boundary
- intent vectors

It states directional truth under the active goals.

### `PRODUCT.md`

`PRODUCT.md` defines the end-state product realization under the active goals
and intent.

It is the bridge between directional intent and decomposed constitutional requirements.

It starts sparse.

It should accrete into the clearer product definition as the product matures.

### `requirements/`

`requirements/` decomposes the product definition into detailed obligation.

Requirements are not the first product-definition surface.

They are the detailed constitutional decomposition of `PRODUCT.md`.

---

## Graph-Native Delivery Rule

The graph should reflect the constitutional stack.

Where the product model requires a separate product-definition layer, the graph should contain a separate product node and product-realization vector rather than skipping directly from intent to requirements.

The preferred shape is therefore:

`goals → intent → product → requirements`

not:

`intent → requirements`

unless the product definition is intentionally collapsed and that collapse is itself declared.

---

## Manual Walkthrough Rule

Before automating a traversal, the project should be able to describe the same traversal manually.

The manual walkthrough should name:

- the current node
- the next vector
- the authority surfaces used
- the output artifact expected
- the evaluator or gate that proves closure

This rule exists to prevent hidden procedural law.

If the team cannot explain the manual traversal, the automation is not yet method-safe.

---

## Automation Rule

Automation is lawful only when it preserves the manual graph walk.

That means automation may:

- render prompts
- scaffold artifacts
- select the next traversal step
- run workers
- collect evidence
- assess closure

It may not:

- skip undeclared nodes
- fabricate authority not present in the declared surfaces
- collapse multiple constitutional transitions into one opaque step without declaring the refinement
- depend on implementation-carrier knowledge that the installed product should not have
- collapse the installed builder and the product under development into one
  authority surface during self-host work

---

## Scenario Rule

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

## Installed-Dev Rule

Where the product has an installable development form, decisive proof runs against that installed development form in an isolated environment.

For a graph-native product, this means the proving lane should exercise:

1. install
2. project bootstrap
3. graph traversal
4. evidence collection
5. target-relative closure

Direct source checks remain useful.

They do not replace installed-dev proof.

---

## Dogfooding Rule

The product should be developed through the same graph-native method it claims to provide.

For `genesis_sdlc`, that means the project should increasingly describe and build itself through:

- explicit assets
- explicit vectors
- explicit graph functions
- explicit scenario bundles
- explicit target-relative closure

The method is stronger when the product can walk itself.

---

## Release Boundary

Release version is not constitutional graph truth.

Release version belongs to the release process and release metadata.

The graph-native method concerns:

- current assets
- current vectors
- current closures
- current authority

Release tapping remains a separate process surface.

---

## Failure Pattern

The graph-native method is being violated when any of these are true:

1. a claimed product step has no corresponding node or vector
2. a graph function exists with no clear outer contract
3. automation performs work that cannot be described as a manual traversal
4. the installed product depends on authoring-carrier knowledge that a clean target project should not contain
5. scenarios cannot name the significant paths they intend to prove
6. the project claims closure without target-relative evidence

---

## Direction

The direction of this method is:

- stronger asset definition
- clearer vector contracts
- clearer graph-function realization
- stronger product/project boundary
- stronger manual-to-automation equivalence
- stronger scenario-driven proof

This is the graph-native refinement of the spec-driven method.

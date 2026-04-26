# Domain Model — odd_manager

**Version**: 0.3.0
**Date**: 2026-04-23
**Status**: Active
**Derives From**:
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/requirements/02-canonical-ontology.md`
- `specification/requirements/03-read-model-and-projection.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.ai-workspace/context/project_bootstrap.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.genesis/odd_sdlc/python/code/odd_sdlc/query_contract.py`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.genesis/odd_sdlc/python/code/odd_sdlc/query.py`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.genesis/odd_sdlc/python/code/odd_sdlc/start_targeting.py`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.genesis/odd_sdlc/python/code/odd_sdlc/execution_contract.py`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.genesis/odd_sdlc/python/code/odd_sdlc/project_profile.py`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.ai-workspace/runtime/odd_sdlc-ambiguity-register.json`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.ai-workspace/runtime/odd_sdlc-requirement-closure.json`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.ai-workspace/runtime/odd_sdlc-execution-contract.json`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.ai-workspace/runtime/odd_sdlc-gap-dossiers.json`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test38/.ai-workspace/runtime/odd_sdlc-workspace-state.json`

## Purpose

This document publishes the domain model that `odd_manager` observes, projects,
and supervises.

It gives one shared vocabulary for:
- runtime readers and projector code
- API and transport surfaces
- UI and operator-facing panels
- audit, provenance, admission, and closure explanations

The observed workspace listed above is evidence for the active `odd_sdlc`
semantic contract. It does not define project identity for `odd_manager`.

## Position

`odd_manager` owns a cross-domain supervisory core.

That core is extended by domain-specific overlays published by the active
domain package contract.

The live observed `odd_sdlc` contract baseline is:
- manager contract: `odd_manager.domain-world v1`
- source contract: `odd_sdlc.query-domain v16`

The current reference observation boundary is therefore a concrete
`odd_sdlc`-governed workspace like `data_mapper.test38`, not an abstract
builder sketch and not the older `data_mapper.test35` read model.

## Observed Semantic Revision

The prior observed standard was `data_mapper.test35` carrying
`odd_sdlc.query-domain v10`.

`data_mapper.test38` revises that contract materially:
- `analysis_manifest` is no longer a stable top-level query-domain surface for
  manager consumers; it remains provenance feeding other published read models
- `gaps` is no longer the first-class odd_sdlc publication boundary; the
  stable surface is now `gap_dossier`
- the domain package now publishes start-addressability and dispatch truth
  explicitly through `start_target_catalog`, `asset_ownership_index`, and
  `execution_contract_surface`
- execution gating is now first-class through
  `operational_capabilities`
- the manager may continue to project a compact `Gap` overlay for UI
  continuity, but that overlay is now derived from `gap_dossier` when the
  upstream source contract is `v16`

This revision changes the meaning of the observed domain pack. It is not just a
file-count increase.

## Core Observation Contract

Across supported domain packages, `odd_manager` supervises:
- published domain-package identity
- published query-contract identity and version
- graph sets
- assets, asset types, asset families, asset collections, and asset nodes
- asset bindings
- workorders and backing GTL graph-function carriers
- jobs and roles
- ABG runtime aggregates: run, graph call, frame, continuation, runtime fact
- policy, ambiguity, capability, execution-admission, provenance, and closure
  surfaces

These objects are stable enough to remain part of the shared manager ontology.

## Runtime And Domain Query Boundary

The composition rule is strict:
- ABG owns runtime event truth and runtime aggregate projections
- the active domain package owns read-only domain overlays and domain-specific
  explanations
- `odd_manager` composes both into one supervisory world

The domain side may provide:
- asset and binding views
- function catalog, program, edge-contract, and work-act-type views
- ambiguity-register and operational-capability views
- start-addressability and asset-ownership views
- admitted execution-contract and per-edge gap-dossier views
- generated delivery artifacts such as requirement, scenario, design, test,
  release, and operational-cycle surfaces

It must not redefine:
- `Run`
- `GraphCall`
- `Frame`
- `Continuation`
- `RuntimeFact`

Those remain ABG-native.

## First Supported odd_sdlc Artifact Family

The first live `odd_sdlc` domain pack is defined against the artifact family
observed in `data_mapper.test38`.

### Constitutional And Runtime Inputs

- `specification/GOALS.md`
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/requirements/10-generated-bootstrap.md`
- `.ai-workspace/runtime/odd_sdlc-requirement-closure.json`
- `.ai-workspace/runtime/odd_sdlc-ambiguity-register.json`
- `.ai-workspace/runtime/odd_sdlc-execution-contract.json`
- `.ai-workspace/runtime/odd_sdlc-gap-dossiers.json`
- `.ai-workspace/runtime/odd_sdlc-workspace-state.json`

### Domain-Specific Delivery Evidence

- `specification/scenarios/20-generated-uat-testcases.md`
- `specification/scenarios/30-generated-testcase-authority.md`
- `specification/scenarios/40-generated-scenarios.md`
- `build_tenants/<tenant>/design/20-generated-feature-decomp.md`
- `build_tenants/<tenant>/design/30-generated-odd-design.md`
- `build_tenants/<tenant>/design/40-generated-implementation-design.md`
- `build_tenants/<tenant>/design/40-generated-implementation-modules.md`
- `build_tenants/<tenant>/design/40-generated-test-design.md`
- `build_tenants/<tenant>/design/60-generated-retrofit-plan.md`
- `build_tenants/<tenant>/test_env/tests/40-generated-test-modules.md`
- `build_tenants/<tenant>/release/60-generated-release-surface.md`
- `docs/45-generated-build-execution.md`
- `docs/46-generated-build-execution-result.md`
- `docs/47-generated-test-execution.md`
- `docs/48-generated-test-execution-result.md`
- `docs/50-generated-deployment.md`
- `docs/55-generated-deployment-result.md`
- `docs/60-generated-runtime-observation.md`
- `.ai-workspace/fp_ledgers/*`
- `.ai-workspace/fp_manifests/*`
- `.ai-workspace/fp_results/*`

`odd_manager` treats this artifact family as a domain overlay over the shared
core ontology, not as a replacement ontology.

## Core Objects

### DomainContract

The published identity of the active domain package and query-contract version.

This object governs compatibility and domain-pack selection inside the manager.

### GraphSet

A workspace-scoped set of one or more observed graphs.

### Asset

A durable surface of truth or produced delivery state identified by URI.

### AssetType

The semantic role an asset fulfills in the domain.

### AssetFamily

A named semantic grouping over related asset types and lifecycle lanes.

### AssetCollection

A named working set of assets treated as one bound scope.

### AssetNode

A typed locus in a graph that receives one asset or one asset-collection
binding.

### AssetGraph

The dependency topology over typed asset nodes.

### AssetBinding

The mapping from one concrete asset or asset collection into one typed asset
node at call time.

### WorkOrder

The manager-facing published callable transformation over typed asset nodes.

A `WorkOrder` remains traceable to the underlying domain function and GTL
`GraphFunction`. It is not a second executor.

### Job

A durable semantic work contract over published callable carriers and declared
roles.

### Role

A semantic capability class required to perform, supervise, or approve work.

### Run

One engine-owned execution attempt over semantic work.

### GraphCall

One engine-owned realization of one published GTL `GraphFunction` boundary.

### Frame

One recursive invocation aggregate inside a graph call.

### Continuation

One engine-owned durable open governance obligation or unresolved runtime
condition derived from prior event truth.

### RuntimeFact

An emitted ABG event or replay-derived runtime truth surface.

### AmbiguityRegister

A query-derived domain surface that records major ambiguity, current status,
policy action, affected assets, threatened invariants, and expected resolving
boundary.

### OperationalCapabilityProjection

A published capability declaration surface describing whether build execution,
test execution, deployment, and runtime observation are declared lawful
operational families in the current workspace.

### StartTargetCatalog

A published list of manager-visible graph-function carriers that are
start-addressable, including their carrier class, input and output surfaces,
and execution binding posture.

### AssetOwnershipIndex

A published mapping from an asset surface to the governing start target or work
item route that is responsible for advancing that asset.

### ExecutionContractSurface

The admitted dispatch contract for the next lawful constructive act, including
scope, normalized target, `until` semantics, proof surface, and provenance of
the admission basis.

### GapDossier

A published per-edge gap-analysis register carrying gap truth, route state,
triage evidence, resumption trigger, and current execution-contract context.

### Gap

A compact manager projection over one unconverged edge or callable boundary.

For `odd_sdlc.query-domain v10`, this is sourced directly from the published
`gaps` payload.

For `odd_sdlc.query-domain v16`, this is derived from `gap_dossier` so current
manager widgets can remain stable while the upstream model evolves.

## odd_sdlc Extension Objects

The current `odd_sdlc` pack extends the core ontology with domain objects that
stay query-derived rather than becoming manager primitives.

### RequirementInventory

The generated requirement authority carried by
`specification/requirements/10-generated-bootstrap.md`.

### RequirementClosureRegister

The current carry and fulfillment status over admitted requirements, as
published in `.ai-workspace/runtime/odd_sdlc-requirement-closure.json`.

### ScenarioSurface

The generated technical and acceptance scenario surfaces published under
`specification/scenarios/`.

### TestcaseAuthority

The published admission surface tying requirements to testcase and test-module
coverage when the asset is materialized.

### GeneratedDesignSurface

One published generated design, decomposition, implementation-design,
implementation-module, or test-design surface under
`build_tenants/<tenant>/design/`.

### OperationalCycleSurface

One published build execution, build result, test execution, test result,
deployment, deployment result, or runtime-observation surface under `docs/`
or the active tenant output tree.

### ReleaseSurface

The published release posture surface under `build_tenants/<tenant>/release/`.

### FPArtifact

One constructive artifact in `.ai-workspace/fp_ledgers/`,
`.ai-workspace/fp_manifests/`, or `.ai-workspace/fp_results/`.

## Placeholder Policy

Placeholder detail is lawful only where the active domain package has not yet
published richer meaning.

The following are not placeholder once published:
- domain-contract identity
- generated requirement inventory
- requirement-closure register
- ambiguity-register entries
- operational-capability posture
- start-target catalog and asset-ownership index
- admitted execution-contract surface
- gap-dossier entries
- generated scenario, testcase-authority, design, release, and
  operational-cycle surfaces

Missing or stale publication must be represented honestly as absence, staleness,
or incompatibility state.

## Ownership Rules

### GTL-Owned

- graph structure
- typed nodes
- graph functions
- jobs
- roles

### ABG-Owned

- run, graph-call, frame, and continuation aggregates
- worker and backend identity binding
- event emission and replay-derived runtime projection
- proof and closure enforcement

### odd_sdlc-Owned For The Current Pack

- generated requirement, scenario, testcase-authority, design, test, release,
  and operational-cycle artifact families
- ambiguity and operational-capability overlays
- start-target and asset-ownership publication
- admitted execution-contract and per-edge gap-dossier publication
- domain-specific explanations over software-delivery work

### odd_manager-Owned

- cross-domain page and panel ownership
- domain-pack compatibility selection
- composition of ABG runtime truth with domain overlays
- operator-facing grouping, drill-down, attention, and posture views
- compatibility projection from source-domain surfaces to stable manager UI
  slices
- honest placeholder, absence, and incompatibility presentation

## Publishing Rules

1. Core GTL/ABG runtime objects remain stable across domain packages.
2. The current `odd_sdlc` pack is defined against observed published artifacts
   and query surfaces, not against older `odd_method`-first assumptions.
3. Domain overlays extend the core ontology without replacing it.
4. Generated delivery artifacts remain domain overlays rather than new runtime
   primitives.
5. Start-addressability, admitted execution, operational capability, and gap
   dossiers are first-class domain publications in the current `odd_sdlc`
   model.
6. Unsupported or stale domain contracts degrade to explicit compatibility
   state while leaving core GTL/ABG projections available.

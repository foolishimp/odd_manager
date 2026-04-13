# odd_manager Alignment Refactor Plan

**Status**: Active branch-plan artifact
**Purpose**: Provide a cold-start, drift-correcting plan for realigning `odd_manager` to the latest live `odd_method`
**Method**: `SPEC_METHOD.md`
**Recommended vehicle**: clean branch in `odd_manager`, not a new project
**Active branch**: `odd_method_alignment_20260410_control_surface_reprice`

## Position

This is not a greenfield replacement.

`odd_manager` remains the correct product boundary. The live observer path still
loads current `odd_method` successfully. The problem is constitutional and
design drift, then partial implementation drift.

The wave should therefore run as:

- `product_reprice`
- `requirement_reprice`
- `design_reframe`
- `realization_refactor`

This ordering follows the constitutional chain in
`/Users/jim/src/apps/specification_methodology/specification/standards/SPEC_METHOD.md`.

Do not treat this as a local code cleanup.

## Why This Wave Exists

The live `odd_method` surface has materially changed.

The latest refactor makes `odd_sdlc`:

- a governed disambiguation pipeline, not only an asset-generation pipeline
- capability-gated for executional and operational stages
- explicit about major ambiguity, risk appetite, and `F_H` escalation
- query-contract rich enough to expose more than the older first-slice observer subset

The key upstream authority surfaces for this wave are:

- `/Users/jim/src/apps/odd_method/specification/GOALS.md`
- `/Users/jim/src/apps/odd_method/specification/PRODUCT.md`
- `/Users/jim/src/apps/odd_method/specification/requirements/10-odd-sdlc-software-domain-buildout.md`
- `/Users/jim/src/apps/odd_method/docs/ODD_SDLC_DISAMBIGUATION_STRATEGY.md`
- `/Users/jim/src/apps/odd_method/docs/REQUIREMENTS_TRACEABILITY.md`
- `/Users/jim/src/apps/odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/query.py`
- `/Users/jim/src/apps/odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/query_contract.py`
- `/Users/jim/src/apps/odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/project_profile.py`
- `/Users/jim/src/apps/odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/ambiguity.py`
- `/Users/jim/src/apps/odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/gtl_module.py`

The upstream truths that matter most are:

1. major ambiguity is first-class domain truth
2. execution and operational stages are conditional on declared capability
3. lawful bounded stop states such as `pending_capability` matter
4. query-domain payload shape has expanded
5. the observer must distinguish runtime truth from query-derived domain overlays

## Current odd_manager Drift Summary

The current live `odd_manager` implementation is not broken, but it is behind
the latest `odd_method` observer contract.

### Constitutional drift

`odd_manager` product and domain surfaces still describe the stable upstream
shape mainly as:

- assets
- asset types
- bindings
- functions
- graph functions
- gaps

That no longer captures the live upstream posture.

Primary affected files:

- `/Users/jim/src/apps/odd_manager/specification/PRODUCT.md`
- `/Users/jim/src/apps/odd_manager/specification/domain/DOMAIN_MODEL.md`
- `/Users/jim/src/apps/odd_manager/specification/requirements/02-canonical-ontology.md`
- `/Users/jim/src/apps/odd_manager/specification/requirements/03-read-model-and-projection.md`

### Design drift

The common dashboard design still points at the older first-slice builder
integration note and does not yet describe:

- ambiguity register projection
- capability-gated stage rendering
- asset-family and program-level overlays
- query-contract evolution handling

Primary affected file:

- `/Users/jim/src/apps/odd_manager/build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

### Implementation drift

The runtime/world adapter already consumes the live upstream query payload, but
the explicit type layer and UI posture still assume an older subset.

Primary affected files:

- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/runtime/odd_manager_world.py`
- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/lib/types.ts`
- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/features/home/HomePanel.tsx`
- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/features/builder/BuilderPanel.tsx`
- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/features/inspector/InspectorPanel.tsx`

## Cold-Start Recovery Protocol

Any future agent or operator restarting this wave should follow this exact
sequence before making changes.

1. Read the governing method:
   - `/Users/jim/src/apps/specification_methodology/specification/standards/SPEC_METHOD.md`
2. Read the live upstream odd_method authority:
   - `GOALS.md`
   - `PRODUCT.md`
   - `requirements/10-odd-sdlc-software-domain-buildout.md`
   - `docs/ODD_SDLC_DISAMBIGUATION_STRATEGY.md`
   - `docs/REQUIREMENTS_TRACEABILITY.md`
3. Read the current odd_manager constitutional and design surfaces:
   - `/Users/jim/src/apps/odd_manager/specification/PRODUCT.md`
   - `/Users/jim/src/apps/odd_manager/specification/domain/DOMAIN_MODEL.md`
   - `/Users/jim/src/apps/odd_manager/specification/requirements/02-canonical-ontology.md`
   - `/Users/jim/src/apps/odd_manager/specification/requirements/03-read-model-and-projection.md`
   - `/Users/jim/src/apps/odd_manager/build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
4. Run a live observer probe:
   - `python3 build_tenants/react_vite/runtime/odd_manager_world.py world --workspace /Users/jim/src/apps/odd_manager`
5. Compare the probe payload against the typed/UI assumptions in:
   - `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/lib/types.ts`
   - the current React panels
6. Only after that, choose the active change class and continue down-chain.

If an agent skips steps 1 to 5 and starts patching UI code first, treat that as
process drift.

## Branch Strategy

Use a clean dedicated branch.

Recommended naming shape:

- `odd-method-alignment/<date>-observer-reprice`

Do not start from a new project unless one of these becomes true:

- `odd_manager` is no longer the correct product boundary
- the shared control-plane ontology is being abandoned
- the current tenant architecture is intentionally being discarded

None of those conditions currently hold.

## Evaluation Lens

Every upstream `odd_method` concept encountered during the wave must be
classified before adoption.

Use exactly one of:

- `adopt`: upstream concept becomes first-class in `odd_manager`
- `adapt`: upstream concept is projected through a manager-specific view
- `defer`: upstream concept is real but not yet operator-critical
- `drop`: prior placeholder or assumption is now superseded and should be removed

This lens must be recorded in the work report for each major concept:

- ambiguity register
- risk appetite
- capability-gated execution
- asset families
- collections
- edge contracts
- programs
- work-act types
- bounded stop states such as `pending_capability`

## Phase Plan

### Phase 0: Baseline And Freeze

**Goal**: create a stable starting point and stop accidental mixed-law edits.

Tasks:

- create the clean branch
- record the exact upstream odd_method commit and working-tree status
- record the exact odd_manager baseline used for the wave
- freeze any unrelated UI churn until the repricing surfaces are updated

Outputs:

- branch created
- baseline note committed or recorded in branch notes
- no mixed unrelated edits in the same work wave

Done when:

- a cold start can identify the exact branch and upstream baseline without asking chat history

### Phase 1: Product Reprice

**Change class**: `product_reprice`

**Goal**: update the odd_manager product definition to match the live upstream
observer boundary.

Files to update:

- `/Users/jim/src/apps/odd_manager/specification/PRODUCT.md`
- `/Users/jim/src/apps/odd_manager/specification/domain/DOMAIN_MODEL.md`

Required repricing points:

- the stable observation contract now includes governed ambiguity and capability surfaces
- the manager observes capability-gated stop states honestly
- the query overlay is richer than the first-slice subset
- the manager remains subordinate to ABG runtime truth and odd_method domain truth

Minimum product terms to add or revise:

- ambiguity register
- ambiguity policy / risk appetite
- capability contract or technology capability surface
- bounded stop state
- asset family
- program
- work-act type
- edge contract

Done when:

- a competent engineer can read product/domain alone and derive the new observer boundary without reading code

### Phase 2: Requirement Reprice

**Change class**: `requirement_reprice`

**Goal**: turn the repriced product boundary into explicit obligations.

Files to update:

- `/Users/jim/src/apps/odd_manager/specification/requirements/02-canonical-ontology.md`
- `/Users/jim/src/apps/odd_manager/specification/requirements/03-read-model-and-projection.md`
- optionally `/Users/jim/src/apps/odd_manager/specification/requirements/05-inspection-governance-and-evidence.md`
- optionally `/Users/jim/src/apps/odd_manager/specification/requirements/09-verification-and-traceability.md`

Required requirement additions or edits:

- first-class projection of ambiguity register state
- first-class projection of capability-gated stop states
- explicit distinction between ABG runtime status and odd_method ambiguity/capability overlays
- support for asset families, collections, programs, edge contracts, and work-act types where upstream publishes them
- honest rendering of `pending_capability`, `fh_required`, carried ambiguity, and hard blocks

Recommended requirement shape:

- extend existing ontology/projection families rather than inventing a parallel family unless the surface becomes large enough to justify a dedicated family

Done when:

- each new product truth has a requirement home
- no UI or runtime behavior needs to infer these obligations from prose alone

### Phase 3: Design Reframe

**Change class**: `design_reframe`

**Goal**: choose how the updated observer boundary appears in the manager.

Files to update:

- `/Users/jim/src/apps/odd_manager/build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
- optionally `/Users/jim/src/apps/odd_manager/build_tenants/common/design/README.md`

Design decisions required:

- where ambiguity register state is surfaced
- where capability contracts and missing capability show up
- how blocked, gated, carried, and converged states are visually distinguished
- how new upstream catalog objects enter the information architecture
- how much of the upstream richness is shown by default vs inspector-only
- how query-contract versioning is handled without creating a shadow schema authority

Recommended design posture:

- make ambiguity/capability visible in overview, builder, and inspector
- keep richer catalog objects inspectable before making them primary navigation
- preserve the ABG runtime / odd_method query boundary explicitly in labels and provenance

Done when:

- implementation can be derived from design decisions rather than inventing layout or semantics ad hoc

### Phase 4: Projection Adapter Refactor

**Change class**: `realization_refactor` after phases 1 to 3 are complete

**Goal**: align the world payload and local types with the live upstream contract.

Files to update:

- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/runtime/odd_manager_world.py`
- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/lib/types.ts`

Implementation tasks:

- make the expanded query payload explicit in `DomainProjection`
- include `query_contract` and enough contract metadata to detect upstream drift
- add typed support for:
  - `ambiguity_register`
  - `asset_families`
  - `collections`
  - `edge_contracts`
  - `programs`
  - `work_act_types`
- ensure degraded mode still returns structurally valid placeholders for the new fields

Done when:

- the runtime adapter and TS types no longer silently depend on unknown extra keys
- a contract bump upstream becomes visible as an intentional type/update task

### Phase 5: UI Alignment Refactor

**Change class**: `realization_refactor`

**Goal**: make the new observer truths legible to operators.

Primary files:

- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/features/home/HomePanel.tsx`
- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/features/builder/BuilderPanel.tsx`
- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/features/inspector/InspectorPanel.tsx`
- `/Users/jim/src/apps/odd_manager/build_tenants/react_vite/src/app/App.tsx`

Implementation order:

1. surface ambiguity summary in overview
2. surface capability-gated block states in builder and inspector
3. surface richer upstream catalog objects in inspector before broader navigation
4. only then consider new primary navigation or dashboard cards

Operator truths that must become visible:

- which ambiguities are active
- which are blocking
- which require `F_H`
- which stages are blocked by missing capability
- whether a stop state is lawful and bounded rather than generic failure

Done when:

- an operator can tell why the upstream workspace is blocked without reading raw JSON

### Phase 6: Qualification And Drift Control

**Change class**: evidence and proving

**Goal**: prove the observer is aligned and keep it aligned.

Required evidence:

- scenario or test showing ambiguity register projection from live odd_method query output
- scenario or test showing `pending_capability` is rendered honestly
- scenario or test showing ABG runtime status and odd_method ambiguity status remain distinct
- scenario or test showing degraded mode still behaves honestly

Suggested test targets:

- runtime adapter unit tests around payload composition
- React view tests for overview/inspector ambiguity and capability cards
- one end-to-end smoke path against the local manager world endpoint

Done when:

- observer drift on the new surfaces is detectable by tests rather than only by manual review

## Practical Work Packages

Use these as branch-level slices.

### WP-1: Reprice odd_manager constitutional surfaces

Deliverables:

- updated `PRODUCT.md`
- updated `DOMAIN_MODEL.md`
- updated ontology/projection requirements

### WP-2: Reframe common dashboard design

Deliverables:

- updated dashboard design artifact
- explicit observer information architecture for ambiguity/capability

### WP-3: Align runtime adapter and types

Deliverables:

- explicit payload support in Python adapter
- explicit TypeScript domain types

### WP-4: Surface ambiguity and capability in UI

Deliverables:

- overview summary
- builder and inspector visibility

### WP-5: Add observer qualification

Deliverables:

- tests or scenario proofs covering the new upstream observer truths

## Drift-Correction Rule

If future upstream odd_method changes land during this branch wave:

1. do not patch implementation first
2. classify the new change using `SPEC_METHOD`
3. decide whether it changes product, requirements, design, or only realization
4. update this plan if the change class or wave order changes
5. only then continue implementation

This rule exists to stop the branch from becoming another mixed-law accumulation.

## Review Checklist For Each PR Or Commit Wave

- Does the change cite the upstream odd_method authority it is aligning to?
- Does it name the active change class?
- Does it preserve the ABG runtime / odd_method query boundary?
- Does it make ambiguity and capability truth more explicit rather than more implicit?
- Does it avoid inventing shadow ontology or silent fallback semantics?
- Does it add or update evidence where behavior changed?

If any answer is no, the wave is incomplete.

## Current Recommendation

Proceed on a clean branch with selective migration through the evaluation lens.

Do not start by editing React panels.

Start at:

1. `specification/PRODUCT.md`
2. `specification/domain/DOMAIN_MODEL.md`
3. `specification/requirements/02-canonical-ontology.md`
4. `specification/requirements/03-read-model-and-projection.md`
5. `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

Only after those are repriced should implementation continue.

# odd_manager Dashboard Design

**Status**: Active
**Date**: 2026-04-06
**Implements**: `REQ-OM-BND-*`, `REQ-OM-ONT-*`, `REQ-OM-PROJ-*`, `REQ-OM-NAV-*`, `REQ-OM-INS-*`, `REQ-OM-WRK-*`, `REQ-OM-COL-*`, `REQ-OM-SES-*`, `REQ-OM-VER-*`
**Derives From**:
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/domain/DOMAIN_MODEL.md`
- `specification/requirements/01-control-plane-boundary.md`
- `specification/requirements/02-canonical-ontology.md`
- `specification/requirements/03-read-model-and-projection.md`
- `specification/requirements/04-orientation-and-navigation.md`
- `specification/requirements/05-inspection-governance-and-evidence.md`
- `specification/requirements/06-operator-workbench.md`
- `specification/requirements/07-live-coordination-and-durable-record.md`
- `specification/requirements/08-session-workspace-and-provider-adapters.md`
- `specification/requirements/09-verification-and-traceability.md`
- `/Users/jim/src/apps/abiogenesis/docs/LLM_GTL_APP_BUILDER_GUIDE.md`
- `/Users/jim/src/apps/abiogenesis/specification/GTL_3_CONSTITUTIONAL_DESIGN.md`
- `/Users/jim/src/apps/abiogenesis/specification/ABG_3_CONSTITUTIONAL_DESIGN.md`
- `/Users/jim/src/apps/abiogenesis/specification/PRODUCT.md`
- `/Users/jim/src/apps/odd_method/specification/INTENT.md`
- `/Users/jim/src/apps/odd_method/specification/PRODUCT.md`
- `/Users/jim/src/apps/odd_method/specification/requirements/08-odd-sdlc-first-slice.md`
- `/Users/jim/src/apps/odd_method/specification/scenarios/06-first-odd-sdlc-asset-function-call.md`
- `/Users/jim/src/apps/odd_method/build_tenants/common/design/ODD_SDLC_TRANSLATION.md`
- `/Users/jim/src/apps/odd_method/build_tenants/common/design/adrs/ADR-006-abg-runtime-and-odd-query-plugin-boundary.md`
- `/Users/jim/src/apps/paperclip/doc/PRODUCT.md`

## Repo Home

`odd_manager` is the correct repo for this design because the manager is now a
separate product boundary:

- `abiogenesis` owns GTL/ABG product truth
- `odd_method` owns the emerging outcome-driven builder/domain line and is
  still in build
- `odd_manager` owns the operator-facing control-plane and dashboard product

This artifact belongs in `build_tenants/common/design/` because it is shared
realization law that should govern any later UI carrier. It is not yet
tenant-local implementation detail.

The proposed target implementation path after this design package is accepted
is:

- `build_tenants/react_vite/`

That path is proposed, not yet created. The installer-seeded
`build_tenants/odd_manager/python/` surface remains starter scaffold only.

## Executive Framing

### What This Dashboard Is

`odd_manager` is the control surface for OODD systems built on GTL and ABG.

It gives operators one place to understand:

- which graphs are present in the current workspace
- which typed assets and bindings are active, blocked, or open
- which workorders and semantic jobs are active
- what ABG runtime facts, graph calls, frames, and continuations are currently
  true
- what policy, evidence, provenance, and closure state justify the current
  posture

### What This Dashboard Is Not

It is not:

- a new runtime
- a replacement for GTL or ABG
- the builder/domain product
- a railway simulator
- a company/org/task operating system in the Paperclip sense
- a chat-first shell with hidden semantics

### Why It Matters

The value is not "nicer agent UX."

The value is that companies, divisions, and regulated operating systems can
supervise governed probabilistic work through attributable runtime truth,
evidence, provenance, and closure rather than through opaque transcripts or
ambient orchestration folklore.

## Comparison Synthesis

### Borrow From Paperclip

- board-level supervisory posture rather than transcript-first orientation
- progressive disclosure from summary to artifacts to raw detail
- persistent work context split across topics, records, and live sessions
- output-aware management surfaces rather than generic chat
- serious control-plane tone

### Retained Interface Strengths

- strong world-model orientation instead of table-only navigation
- explicit panel ownership
- context inspector split across documents, requirements, and history
- dispatch/timetable idea as a derived management lens
- resolved runtime identity surfaces for role, worker, and backend
- local drilldown from spatial overview into object detail

### Reject From Paperclip

- company/org/employee ontology as product truth
- budgets, reporting chains, and company-goal hierarchy as default manager
  primitives
- task/comment semantics as the semantic center

### Rejected Historical Semantics

- train/station/railway language as primary ontology
- hardcoded dev/test/uat/prod lines as canonical worldview
- legacy lifecycle assets as the dashboard's underlying object model
- release-terminal logic as the universal shape of all supervised work
- inherited self-hosting bootloader baggage as ordinary application truth

### Reject From Both

- any hidden semantic layer that outruns GTL/ABG declarations and event truth
- chat-first framing that obscures runtime, policy, evidence, and closure
- summaries that cannot be replayed from authoritative sources

## Published Visual System

The retained operator visual language is now `odd_manager` design law.

It is not a migration footnote. Any future UI carrier shall preserve these
visual rules unless the shared design package is intentionally revised.

### Core Tokens

- light-theme shell palette uses:
  - `--bg: #f3efe5`
  - `--panel: #fffdf8`
  - `--panel-strong: #f7f2e7`
  - `--ink: #10243e`
  - `--muted: #516273`
  - `--line: #d7d0c2`
  - `--accent: #0f8b8d`
  - `--accent-strong: #005f73`
  - `--warn: #cc5803`
  - `--gate: #9a3412`
  - `--ok: #2a6f3e`
- headings use `Space Grotesk` over `IBM Plex Sans`
- body copy and controls use `IBM Plex Sans` with sensible system fallbacks
- panels are rounded, layered, and paper-like rather than flat utility blocks
- shadows stay soft and industrial rather than glossy or neon

### Graph Workspace Language

- the graph workspace is a large rounded field with layered paper gradients and
  a restrained teal radial accent
- graph nodes are rounded cards with compact operational density rather than
  generic editor boxes
- graph routes are thick supervisory segments whose state is readable before
  reading text
- each node carries a compact pulse or status indicator that mirrors route
  state
- the workspace includes overview or minimap support and lightweight overlay
  controls for zoom and focus
- local inspector, board, and graph surfaces must feel like one operating
  system rather than separate micro-products

### State Semantics

- `active` uses `--accent-strong` emphasis and may use restrained glow
- `pending` uses `--accent` blended with baseline line color
- `converged` uses `--ok`
- `gated` uses `--gate`
- `blocked` uses `--warn`
- selected and related state use border and emphasis treatment without breaking
  identity or evidence traceability

### Prohibited Drift

- do not collapse the shell into generic dark SaaS styling
- do not replace the graph workspace with default node-editor chrome
- do not break the shared status color semantics between routes, nodes,
  overview, and inspector chips
- do not flatten the visual hierarchy into table-first utility screens

## Canonical Product Ontology

### Primary Objects

- `GraphSet`
- `Asset`
- `AssetType`
- `AssetCollection`
- `AssetNode`
- `AssetGraph`
- `AssetBinding`
- `WorkOrder`
- `GraphFunction`
- `Job`
- `Role`
- `Run`
- `GraphCall`
- `Frame`
- `Continuation`
- `RuntimeFact`
- `PolicySurface`
- `ProofLane`
- `ProvenanceRecord`
- `ClosureRecord`

### Relationships

- one workspace may expose multiple graphs
- graphs are dependency topologies over typed asset nodes
- concrete assets or asset collections bind into typed nodes explicitly
- workorders are published callable transformations over typed asset nodes
- a workorder is carried by a GTL graph function
- jobs bind published callable carriers by identity
- roles declare semantic capability classes required for work
- a run realizes a job
- a graph call realizes a graph function inside a run and is explainable in
  terms of the selected workorder
- frames realize recursive invocation boundaries inside graph calls
- runtime facts are emitted against runs, graph calls, or frames
- continuations are derived from runtime facts and remain run-local
- policy surfaces constrain dispatch, evaluation, escalation, proof, or closure
- proof lanes and provenance records justify closure claims

### GTL-Owned

- graph structure
- typed nodes
- contexts
- rules, evaluators, operators, and regimes
- graph functions
- semantic jobs
- semantic roles
- module and library structure
- policy hook declarations and opaque hook configuration

### ABG-Owned

- run, graph-call, frame, and continuation aggregates
- worker identity and role binding
- transport and backend resolution
- event emission
- replay-derived projection
- provenance and lineage
- retries, correction, and supersession
- proof, escalation, and closure enforcement

### odd_method-Owned

- outcome-driven builder/domain framing
- assets addressed by URI
- asset types, asset collections, and typed asset nodes
- asset graphs and asset bindings
- named functions over asset graphs
- builder-facing graph-function publication rules
- the current ODD translation surface captured in
  `odd_method/build_tenants/common/design/ODD_SDLC_TRANSLATION.md`

### UI And Read-Model Only

- outcome
- transition
- work vector
- posture summaries
- attention queues
- risk and readiness badges
- grouped operator lenses
- saved focus state
- visual graph layout
- panel and page composition

Within `odd_manager`, `WorkOrder` is the manager-facing callable object.

It remains traceable to the underlying domain function and GTL
`GraphFunction`.

Derived objects such as `Outcome`, `Transition`, and `WorkVector` are lawful
only as projections over published graphs, typed assets, bindings, workorders,
runtime facts, and proof state.

## Current Builder Integration Note

`odd_method` is still in build.

The live `odd_method` repo state on 2026-04-06 currently exposes enough stable
shape for `odd_manager` to build around, but not enough frozen detail to treat
the full builder-domain library as closed.

The observable live integration surface today is:

- the `odd_method` specification stack
- the installed method standards
- `odd_method/specification/requirements/08-odd-sdlc-first-slice.md`
- `odd_method/specification/scenarios/06-first-odd-sdlc-asset-function-call.md`
- `odd_method/build_tenants/common/design/ODD_SDLC_TRANSLATION.md`
- `odd_method/build_tenants/common/design/adrs/ADR-006-abg-runtime-and-odd-query-plugin-boundary.md`
- `odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/domain_model.py`

The current stable builder signals visible to the manager are:

- URI-addressed assets
- declared asset types
- asset collections
- explicit typed-node bindings
- named function catalog entries with typed inputs and outputs
- backing GTL graph-function identity
- a ratified query-library boundary for domain overlays

`odd_manager` should therefore treat `odd_method` integration as
spec-and-design-defined while that line is still in build.

`odd_manager` is allowed to ship with placeholder detail where richer builder
semantic material is not yet published cleanly.

## Runtime And Query Composition Model

The ratified composition model is:

1. read or subscribe to ABG event truth directly
2. project runtime aggregates from ABG truth
3. invoke `odd_method` query-library logic for domain overlays
4. compose both into the operator UI

This means:

- realtime runtime understanding comes directly from ABG
- domain comprehension comes from ODD query logic
- `odd_manager` does not depend on one monolithic served observer payload
- ODD query overlays do not redefine runtime aggregates

The first query cadence may be on-demand.

## Placeholder Detail Strategy

The manager should be buildable now even if `odd_method` continues to change.

That means:

- the shell, graph workspace, and inspector may be fully implemented
- graph orientation may use stable ids, types, bindings, workorder carriers,
  and runtime links immediately
- graph topology may initially be a derived placeholder projection over
  published function inputs, outputs, and bindings
- richer domain overlays may come from query-library calls without requiring a
  background sync service
- richer domain descriptions may render as explicit placeholders until the
  upstream builder line hardens
- placeholder detail must never masquerade as canonical domain publication

## Read Model And Projection Model

### Minimum Machine-Readable Objects

The UI needs, at minimum:

- declaration-side objects:
  - graph sets
  - asset graphs
  - assets
  - asset types
  - asset bindings
  - workorders
  - jobs
  - roles
  - policy references
  - proof-lane definitions
- runtime-side objects:
  - runs
  - graph calls
  - frames
  - continuations
  - runtime facts
  - worker/backend bindings
  - failure classification
  - closure state
- query-overlay objects:
  - asset views
  - binding views
  - function catalog views
  - gap overlays
  - convergence overlays
  - checkpoint and provenance interpretation
- bridge objects:
  - provenance links
  - evidence links
  - source-asset bindings
  - graph membership and graph-selection state

The first implementation may treat rich type semantics, proof hints, closure
explanations, and gap narratives as optional fields.

### Example Projection Shapes

```json
{
  "assetGraph": {
    "id": "graph.spec_bootstrap",
    "label": "Specification Bootstrap",
    "nodeIds": ["node.input_set", "node.intent_surface", "node.product_surface"],
    "workOrderIds": ["wo.derive_intent_surface", "wo.derive_product_surface"],
    "status": "active"
  }
}
```

```json
{
  "workOrder": {
    "id": "wo.derive_requirement_surface",
    "functionId": "fn.derive_requirement_surface",
    "graphFunctionId": "gf.derive_requirement_surface",
    "inputNodeTypes": ["input_set", "intent_surface", "product_surface", "goal_surface"],
    "outputNodeTypes": ["requirement_surface"],
    "graphIds": ["graph.spec_bootstrap"]
  }
}
```

```json
{
  "graphCall": {
    "callId": "gc_1024",
    "runId": "run_88",
    "workOrderId": "wo.derive_requirement_surface",
    "graphFunctionId": "gf.derive_requirement_surface",
    "materializationId": "mat_31",
    "status": "active",
    "worker": {
      "roleId": "requirements_operator",
      "workerId": "worker.codex",
      "backend": "claude_code"
    },
    "openContinuationIds": ["cont_9"]
  }
}
```

### Authoritative Projections

Authoritative or replay-derived projections are:

- graph-set projection
- asset-graph projection
- asset-binding projection
- workorder projection
- run projection
- graph-call projection
- frame projection
- continuation projection
- GTL declaration surfaces

### Derived Projections

Derived projections are:

- outcome summaries
- transition summaries
- work-vector views
- home posture summaries
- grouped attention queues
- readiness scores
- risk badges
- grouped operator lenses such as "builder," "runtime," or "closure"
- visual graph routes and board cards

No derived projection may become the only source for runtime truth.

## Information Architecture

### Top-Level Pages

1. `Home`
   - immediate posture over live runs, open continuations, blocking evidence,
     and recent change
2. `Graphs`
   - graph-set and asset-graph workspace over typed assets, bindings, and
     workorders
3. `Runtime`
   - runs, graph calls, frames, worker/backend resolution, runtime facts
4. `Continuations`
   - open obligations, retry/repair/review queues, causal links
5. `Evidence And Policy`
   - proof lanes, evaluations, closure posture, policy attachments
6. `Builder`
   - `odd_method` source surfaces, in-build work-vector framing, and
     graph-function integration boundary as those surfaces harden
7. `Provenance`
   - timeline, lineage, event truth, supersession, correction

### Builder Guide Alignment

These pages map onto the artifact-first operator surfaces in
`LLM_GTL_APP_BUILDER_GUIDE.md`:

- `Define` -> `Graphs`
- `Build` -> `Builder`
- `Run` -> `Runtime`
- `Audit` -> `Evidence And Policy` plus `Provenance`
- `Correct` -> `Continuations`
- `Prove` -> `Evidence And Policy`

### Panel Ownership

- `Home` owns posture, attention, and "what changed"
- `Graphs` owns graph-set topology and focus selection
- `Runtime` owns call/run/frame inspection
- `Continuations` owns open obligation management
- `Evidence And Policy` owns proof, policy, and closure explanation
- `Builder` owns domain/builder reference context
- `Provenance` owns raw event-derived narrative
- a persistent inspector owns the currently selected object's details, related
  documents, evidence, and history

### Drilldown Model

The standard drilldown path is:

`GraphSet -> AssetGraph -> AssetNode -> WorkOrder -> GraphCall -> Frame -> Runtime Facts -> Continuation -> Policy/Evidence -> Closure`

A second lawful path begins from runtime urgency:

`Continuation -> causing event -> graph call/frame -> workorder -> policy attachment -> required proof lane -> closure consequence`

### What The Home Screen Must Answer Immediately

- which graphs are currently active, blocked, or near closure
- which typed assets and workorders currently carry the main operational risk
- what run and graph-call activity is live now
- which continuations require human or system attention
- whether the current problem is runtime, policy, proof, or non-convergence
- what changed most recently
- what the next lawful action is

## Operator Journeys

### Orient

The operator lands on `Home`, sees the current posture, recent change, and the
highest-severity open obligations, then pivots into the selected graph,
workorder, or runtime object.

### Inspect Current Runtime Truth

The operator opens `Runtime`, selects a run or graph call, verifies worker,
backend, active frames, and emitted facts, then checks whether the current
state is active work, fail-closed runtime failure, or lawful open progression.

### Understand Open Continuations

The operator opens `Continuations`, sorts by kind, age, or severity, then
opens the causing event and the affected call/frame to understand why the
obligation is still open.

### Inspect Evidence And Policy

The operator pivots from a continuation, asset, graph, workorder, or closure
claim into
`Evidence And Policy`, where they inspect proof lanes, evaluator outcomes,
policy attachments, and closure blockers.

### Supervise Or Build Through odd_method

The operator opens `Builder`, reviews the relevant `odd_method` asset-graph and
workorder framing, follows links into source design/spec surfaces, and
confirms which translated assets, bindings, and published callable boundaries
currently define the constructive boundary without assuming the builder line is
already complete.

### Recover From Failure Or Blocked Closure

The operator starts from the open failure or continuation, checks whether the
issue is:

- runtime defect
- policy/configuration defect
- probabilistic non-convergence
- proof failure after constructive work
- superseded or abandoned work

Then they take a lawful action with attributable policy and evidence context.

## Interface Retention Map

### What Is Retained

- the world-model orientation
- the executive brief posture concept
- the dispatch board as a derived attention lens
- explicit resolved runtime identity
- local inspector-driven drilldown
- clear panel ownership
- serious operations-console tone
- the published graph-workspace styling language

### What Is Recast

- location-shaped nodes become typed domain objects such as asset graph, asset
  node, workorder, graph call, or continuation depending on context
- routes become workorder boundaries, binding relations, or derived
  transitions
- the primary spatial page becomes `Graphs`
- the attention board becomes runtime posture or attention queue
- local detail becomes an object inspector over semantic and runtime truth

### What Is Removed

- train/station/railway language as the semantic center
- hardcoded dev/test/uat/prod trains
- legacy lifecycle nodes as the universal managed model
- fixed release-terminal worldview
- inherited bootloader/self-hosting assets as default application truth

### What Must Be Rebuilt

- shared control-plane types into GTL/ABG/OODD-native control-plane types
- declaration and runtime projections over graph sets, typed assets,
  workorders, runs, calls, and continuations
- the spatial network from hardcoded lifecycle geometry into graph-set and
  asset-graph views
- detail panels from location-shaped stories into object semantics and runtime
  law
- builder integration around current `odd_method` asset graphs, bindings, and
  callable boundaries

## Phased Implementation Plan

### Phase 1 - Read-Model Refactor

- define the new shared TypeScript model around graph sets, typed assets,
  workorders, GTL, ABG, and current `odd_method` surfaces
- build replay-derived projections for runs, graph calls, frames, and
  continuations
- define declaration-side projections for graph sets, asset graphs, assets,
  bindings, workorders, jobs, and roles
- keep authoritative-versus-derived boundaries explicit

### Phase 2 - UI Shell And Panel Refactor

- preserve the published shell, inspector, board, and graph-workspace visual
  language
- replace train/station surfaces with `Home`, `Graphs`, `Runtime`, and
  `Continuations`
- rework the visual map around graph sets, typed assets, and workorders
- keep panel ownership strict so facts have one primary home

### Phase 3 - odd_method Builder Integration

- bind the builder page to current `odd_method` product/design surfaces
- add graph-function and work-vector inspection once those publication surfaces
  stabilize
- support cross-links from runtime objects back to builder/domain truth

### Phase 4 - Richer Observability, Provenance, And Governance

- add full provenance timeline and causal navigation
- add closure dossiers and policy explanation surfaces
- add evidence lanes and proof-gap visualization
- add saved operator lenses and regulated-environment supervisory bundles

## Bottom Line

`odd_manager` should not be a cleaned-up legacy manager shell.

It should be a new control-plane product that:

- takes GTL/ABG truth seriously
- treats `odd_method` as the builder/domain line
- owns and preserves its published operator visual language
- keeps UI summaries subordinate to authoritative runtime and declaration truth
- provides industrial observability, provenance, governance, and closure
  explanation for OODD systems

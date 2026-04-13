# odd_manager Dashboard Design

**Status**: Active
**Date**: 2026-04-06
**Implements**: `REQ-OM-BND-*`, `REQ-OM-ONT-*`, `REQ-OM-PROJ-*`, `REQ-OM-NAV-*`, `REQ-OM-INS-*`, `REQ-OM-WRK-*`, `REQ-OM-COL-*`, `REQ-OM-SES-*`, `REQ-OM-VER-*`, `REQ-OM-LNS-*`
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
- `specification/requirements/10-entry-lenses-and-delivery-workspaces.md`
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
- graph functions declare cumulative typed environment contracts over
  `requires`, `provides`, and `carries`
- jobs bind published callable carriers by identity
- roles declare semantic capability classes required for work
- a run realizes a job
- a graph call realizes a graph function inside a run and is explainable in
  terms of the selected workorder
- graph-call dispatch resolves the live runtime environment for the selected
  boundary rather than relying on hidden last-output piping
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
- asset types, asset families, collections, and typed asset nodes
- asset graphs and asset bindings
- named functions over asset graphs
- edge contracts, executive programs, and work-act types
- builder-facing graph-function publication rules
- cumulative environment publication rules over graph-function carriers
- ambiguity register, ambiguity policy posture, and capability-gated stop-state
  declarations
- the current ODD translation and disambiguation surfaces captured in
  `odd_method/build_tenants/common/design/ODD_SDLC_TRANSLATION.md` and
  `odd_method/docs/ODD_SDLC_DISAMBIGUATION_STRATEGY.md`

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

Within that rule, `WorkVector` is a UI/read-model view over one public
graph-function carrier and its realized internal vectors. It must not be used
as a substitute public callable or shadow runtime primitive.

## OddChat Participant Transport

### Room Truth And Participant Delivery

`OddChat` room history is the canonical mailbox for live coordination.

That means:

- topics remain the durable identity surface
- live rooms remain the operator-visible coordination surface
- sessions remain the durable execution substrate
- provider-backed participants join rooms over MCP and track receipt state
- room fan-out happens through canonical room history plus participant cursor,
  not through ambient stdin injection into every attached shell

Attached sessions still matter, but attachment alone is not equivalent to room
delivery. Attachment expresses available execution substrate and visible room
context. Joined participants express active room-delivery intent.

### Participant Model

The manager owns a participant read model with these minimum fields:

- participant id
- provider identity
- backing session id
- room id and optional topic id
- connection status
- last read cursor
- last post/read timestamps

Participants are manager-owned read-model objects over the session substrate.
They do not replace sessions as a product primitive.

### Bootstrap Versus Steady-State Transport

The product may use one-shot shell injection to bootstrap an existing session
into a provider-backed participant.

That bootstrap path is lawful only for:

- launching Codex, Claude, or another provider CLI with the right MCP config
- carrying topic, room, and session identity into the launched process

It is not the steady-state chat transport.

After launch:

- the participant joins the selected room through MCP
- room receive uses participant membership and cursor state
- room reply uses MCP room-post operations
- ordinary shell input remains ordinary shell input

### MCP Surface

The provider-facing MCP surface is room-oriented:

- `room_join`
- `room_status`
- `room_read`
- `room_wait`
- `room_send`
- `room_leave`

Low-level transport-facing IRC tools may still exist for debugging or transport
binding, but they are not the primary product model.

## Current Builder Integration Note

`odd_method` is still in build, but the manager no longer treats that as a
license to hide currently published builder truth behind placeholder state.

The live `odd_method` repo state on 2026-04-10 exposes a materially larger and
more explicit observer contract than the earlier first-slice surface.

The observable live integration surface today is:

- the `odd_method` specification stack
- the installed method standards
- `odd_method/specification/requirements/10-odd-sdlc-software-domain-buildout.md`
- `odd_method/docs/ODD_SDLC_DISAMBIGUATION_STRATEGY.md`
- `odd_method/docs/REQUIREMENTS_TRACEABILITY.md`
- `odd_method/build_tenants/common/design/ODD_SDLC_TRANSLATION.md`
- `odd_method/build_tenants/common/design/adrs/ADR-006-abg-runtime-and-odd-query-plugin-boundary.md`
- `odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/domain_model.py`
- `odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/query_contract.py`
- `odd_method/build_tenants/odd_sdlc/python/code/odd_sdlc/query.py`

The current stable builder signals visible to the manager are:

- explicit query-contract metadata and versioning
- URI-addressed assets
- declared asset types
- asset families and collections
- explicit typed-node bindings
- named function catalog entries with typed inputs and outputs
- edge contracts
- executive programs
- work-act types
- ambiguity register state, including policy action and bounded stop posture
- backing GTL graph-function identity
- a ratified query-library boundary for domain overlays

`odd_manager` should therefore treat `odd_method` integration as
spec-and-design-defined while that line is still in build, but it must also
track the published query-domain contract explicitly and surface contractual
drift as a first-class observer concern.

`odd_manager` remains forward-only in this phase. There is no pre-release
backward-compatibility obligation to preserve stale observer shapes once the
upstream builder line publishes richer lawful truth.

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
- unpublished or not-yet-ratified domain descriptions may render as explicit
  placeholders until the upstream builder line hardens
- placeholder detail must never masquerade as canonical domain publication
- once `odd_method` publishes a field in the ratified query-domain contract,
  `odd_manager` must carry it explicitly rather than collapsing it back into
  generic placeholder or summary state

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
  - query-contract metadata and versioning
  - asset views
  - asset-family views
  - collection views
  - binding views
  - function catalog views
  - edge-contract views
  - executive-program views
  - work-act-type views
  - ambiguity-register and ambiguity-entry views
  - capability posture and bounded-stop overlays
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

Published ambiguity posture, capability posture, query-contract versioning, and
builder catalog objects such as asset families, edge contracts, executive
programs, and work-act types are not optional once they exist in the upstream
contract.

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

1. `Requirements View`
   - requirement-first explorer and requirement workbench for delivery
     stakeholders
2. `Process View`
   - process-first explorer and process/build-activity workbench over the same
     underlying information model
3. `Home`
   - immediate posture over live runs, open continuations, blocking evidence,
     and recent change
4. `Graphs`
   - graph-set and asset-graph workspace over typed assets, bindings, and
     workorders
5. `Runtime`
   - runs, graph calls, frames, worker/backend resolution, runtime facts
6. `Continuations`
   - open obligations, retry/repair/review queues, causal links
7. `Evidence And Policy`
   - proof lanes, evaluations, closure posture, policy attachments
8. `Builder`
   - `odd_method` source surfaces, in-build work-vector framing, and
     graph-function integration boundary as those surfaces harden
9. `Provenance`
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

- `Requirements View` owns requirement-first exploration and the requirement
  workbench
- `Process View` owns process/build-activity exploration and the
  process-selected workbench
- `Home` owns posture, attention, and "what changed"
- `Graphs` owns graph-set topology and focus selection
- `Runtime` owns call/run/frame inspection
- `Continuations` owns open obligation management
- `Evidence And Policy` owns proof, policy, and closure explanation
- `Builder` owns domain/builder reference context
- `Provenance` owns raw event-derived narrative
- a persistent inspector owns the currently selected object's details, related
  documents, evidence, and history
- OddBoard and the local session workspace remain ubiquitous cross-page tools
  rather than page-specific authority centers

### Shared Delivery Widget Law

`Requirements View` and `Process View` are distinct entry lenses over one
shared information model.

That means:

- widgets are reusable across both pages where the underlying concern is shared
- widgets are collapsible and preserve operator context when reopened
- totals and summary badges are saved queries over shared backing records
- large record sets are shown through bounded navigators with independent
  scrolling, pagination, or virtualization rather than by pushing the rest of
  the page out of view
- when one widget controls another widget's query or focus, the dependency is
  expressed through shared framing or local grouping so the operator can see
  the hierarchy directly
- applying a total or summary badge makes the resulting query explicit at the
  affected navigator and returns operator focus there so the change is visible
  immediately
- visible objects are never dead-end text; they open richer detail or the
  authoritative underlying surface
- the first visible layer is human-readable, while raw ids and source surfaces
  remain reachable as deeper layers

The requirement-selected and process-selected workbenches may differ in entry
filter, primary selection, and surrounding summary context, but they should
reuse the same widget families wherever lawful rather than diverging into two
independent page architectures.

### Drilldown Model

The standard drilldown path is:

`GraphSet -> AssetGraph -> AssetNode -> WorkOrder -> GraphCall -> Frame -> Runtime Facts -> Continuation -> Policy/Evidence -> Closure`

A second lawful path begins from runtime urgency:

`Continuation -> causing event -> graph call/frame -> workorder -> policy attachment -> required proof lane -> closure consequence`

A third lawful path begins from requirement framing:

`Requirement -> Requirement Summary -> Design Surface -> Module / Implementation Surface -> Testcase Authority -> Test Execution -> Ticket / Comment / Risk Context`

A fourth lawful path begins from process framing:

`Build Activity / Process Focus -> Related Requirement or Work Surface -> Design / Implementation / Proof Surface -> Ticket / Comment / Risk Context`

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

### Understand Requirement Reality

The stakeholder opens `Requirements View`, filters or searches the requirement
set, selects a human-readable requirement, then inspects its summary, history,
design links, implementation surfaces, proof surfaces, ticket state, and
discussion without losing requirement framing.

### Understand Build Activity

The stakeholder opens `Process View`, starts from build activity or process
flow, then pivots through the same shared widget family to inspect linked
requirements, implementation, proof, ticket, and discussion surfaces from a
process-first posture.

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

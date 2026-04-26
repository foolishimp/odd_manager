# odd_manager Dashboard Design

**Status**: Active
**Date**: 2026-04-19
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
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/.ai-workspace/context/project_bootstrap.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/specification/requirements/10-generated-bootstrap.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/.ai-workspace/runtime/odd_sdlc-ambiguity-register.json`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/.ai-workspace/runtime/odd_sdlc-requirement-closure.json`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/specification/scenarios/20-generated-uat-testcases.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/specification/scenarios/30-generated-testcase-authority.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/specification/scenarios/40-generated-scenarios.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/build_tenants/scala_spark/design/20-generated-feature-decomp.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/build_tenants/scala_spark/design/40-generated-implementation-design.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/build_tenants/scala_spark/test_env/50-generated-run-archive.md`
- `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35/build_tenants/scala_spark/release/60-generated-release-surface.md`

## Position

`odd_manager` is a control-plane host over:
- manager-owned core GTL/ABG pages
- domain-contributed pages and actions selected through domain-contract
  compatibility
- ubiquitous workbench, board, room, and session tools attached to the same
  managed workspace

One common loader chooses the managed workspace first.
Only after that selection does the manager resolve:
- the workspace's primary project identity
- the distinct governance-package identity when present
- the compatible domain pack, landing page, labels, and shell framing

The first supported concrete pack is an observed `odd_sdlc` workspace like
`data_mapper.test35`.

This file defines the shared design law for that first pack without making
`odd_sdlc` the permanent identity of the manager.

## Loader And Identity Resolution

### Common Loader

- one common loader widget is used to select a managed workspace
- the loader does not fork into separate launchers for `odd_sdlc`,
  `odd_world_model`, or later supported `odd_*` lines
- workspace selection precedes domain landing-page resolution

### Identity Resolution

- the manager resolves primary project identity separately from governance or
  runtime package identity
- a workspace governed by `odd_sdlc` may still be primarily
  `odd_world_model`
- shell titling and the first visible domain pack come from primary identity,
  not from governance-package markers alone

### Shell Framing

- the large shell title presents the active primary identity, such as
  `Odd SDLC` or `Odd World Model`
- `Odd Manager` remains the host product and compatibility layer, not the
  first visible domain identity label once a workspace is selected
- manager-owned core pages remain cross-domain regardless of the shell title

## First Supported Domain Pack

### Compatibility Boundary

- manager contract: `odd_manager.domain-world v1`
- first source contract: `odd_sdlc.query-domain v10`

The manager resolves domain-specific tabs, labels, and actions through that
compatibility boundary.

Unsupported or partially supported contracts degrade to explicit compatibility
state while leaving core GTL/ABG pages available.

### Observed odd_sdlc Artifact Family

The first pack is defined against the artifact family that an observed
`odd_sdlc` workspace publishes today:
- generated requirement inventory
- requirement-closure register
- ambiguity register
- active workflow
- generated scenarios and testcase authority
- generated design and implementation-design surfaces
- generated test run archive and release surface
- FP ledgers, manifests, and results

These are domain overlays. They do not replace the manager's shared runtime
ontology.

## Page Ownership

### Identity-Level Domain Packs

- `odd_sdlc` is one supported domain pack
- `odd_world_model` is a separate supported domain pack at the same level
- domain pages from different packs are not flattened into one global peer tab
  row
- the selected workspace's primary identity determines which domain pack is
  loaded first

### Manager-Owned Core Pages

#### Home

Owns posture:
- what is active
- what is blocked
- what last changed
- which domain contract is active
- whether the current domain pack is compatible

Primary inputs:
- `domain_contract`
- `.ai-workspace/runtime/odd_sdlc-ambiguity-register.json`
- `.ai-workspace/runtime/active-workflow.json`
- ABG runtime summaries

#### Graph Workspace

Owns topology and selection:
- graph-set context
- graph-local focus
- asset, binding, and workorder relationships
- direct links from graph objects into runtime and domain overlays

Primary inputs:
- projected graph set
- asset graphs
- assets and bindings
- workorders and backing graph-function carriers

#### Runtime

Owns ABG-native execution truth:
- runs
- graph calls
- frames
- continuations
- event-derived runtime explanations

Primary inputs:
- ABG event truth
- ABG runtime projections

#### Evidence

Owns proof, provenance, and closure drill-down:
- closure explanation
- proof lane detail
- provenance links
- raw supporting facts

Primary inputs:
- runtime facts
- provenance links
- closure/gap overlays
- published test and release evidence where the domain pack carries them

## odd_sdlc Domain Pages

### Requirements View

This is the first supported domain page for delivery stakeholders.

It is requirement-first and binds to:
- `specification/requirements/10-generated-bootstrap.md`
- `.ai-workspace/runtime/odd_sdlc-requirement-closure.json`
- `specification/scenarios/30-generated-testcase-authority.md`
- `specification/scenarios/20-generated-uat-testcases.md`
- linked design, test, ticket, and comment surfaces

The page contains:
- a bounded requirement explorer
- a requirement workbench
- explicit traceability into design, code, proof, tests, tickets, and comments

### Process View

This is the first supported process-first domain page.

It binds to:
- `.ai-workspace/runtime/active-workflow.json`
- `.ai-workspace/fp_ledgers/*`
- `.ai-workspace/fp_manifests/*`
- `.ai-workspace/fp_results/*`
- generated design surfaces under `build_tenants/<tenant>/design/`
- generated release and test-run-archive surfaces

The page answers:
- where the constructive pipeline is now
- which edges are blocked, carried, or converged
- which generated surfaces already exist
- what evidence or capability is still missing

## odd_world_model Domain Pages

### World Model Landing

This is the first `odd_world_model` domain landing page.

It is selected when the managed workspace is primarily `odd_world_model`, even
if a separate package such as `odd_sdlc` governs the mutable project process.

The first landing page binds to:
- retained `sources/` authority
- installed `.genesis/odd_world_model/` builder surfaces
- mutable `.ai-workspace/` state
- published world-model artifacts under `published/`, `review/`, `proof/`,
  `mapping/`, `query/`, and related domain-specific folders when present

The page answers:
- what world-model domain instance is loaded
- what installed `odd_world_model` builder cut is present
- what mutable sandbox state exists for that instance
- which published semantic artifacts, projections, manifests, traces,
  treatments, covariances, and adjoints are available for inspection

### Release And Qualification Detail

Release and qualification remain part of the first `odd_sdlc` domain pack even
if they are entered from `Process View` rather than a permanently separate top
level route.

Primary inputs:
- `specification/scenarios/40-generated-scenarios.md`
- `build_tenants/<tenant>/test_env/50-generated-run-archive.md`
- `build_tenants/<tenant>/release/60-generated-release-surface.md`

## Ubiquitous Tools

These remain manager-owned and available across entry lenses:
- operator workbench
- OddBoard
- durable topics and live rooms
- session workspace

They attach to the same selected workspace truth rather than opening a second
collaboration substrate.

## Data Composition Rules

### Core GTL/ABG Inputs

- runs, graph calls, frames, continuations, and runtime facts come from ABG
- these are always available when the runtime has emitted the necessary facts

### Domain-Pack Inputs

- requirement inventory, closure, ambiguity, workflow, generated design,
  scenarios, and release/test surfaces come from the active domain pack
- these may be missing, stale, partial, or incompatible and must be rendered
  honestly

### Manager-Derived Inputs

- attention queues
- readiness or posture summaries
- collapsed totals and badges
- graph layout and minimap arrangement

These remain drillable and traceable to source objects.

## Visual System

The retained operator visual language is shared design law.

### Core Tokens

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

Typography:
- headings: `Space Grotesk`
- body and controls: `IBM Plex Sans`

### Graph Workspace Language

- large rounded field with layered paper gradients
- rounded, compact nodes rather than generic editor boxes
- thick supervisory routes whose state reads before the text does
- local overview/minimap and lightweight overlay controls

### State Semantics

- `active` uses accent emphasis
- `pending` uses muted accent
- `converged` uses `--ok`
- `gated` uses `--gate`
- `blocked` uses `--warn`

Those meanings stay consistent across route segments, nodes, chips, inspectors,
and overview surfaces.

## Degradation Rules

1. Core runtime pages remain available even when the domain contract is
   unsupported.
2. Unsupported domain contracts show explicit compatibility state rather than
   silent field dropping.
3. Missing generated `odd_sdlc` artifacts render as explicit absence or
   staleness state rather than fabricated structure.
4. Placeholder domain detail is lawful only where published identity and runtime
   links remain visible.

## Rejected Drift

Do not regress toward:
- train/station/railway framing
- `odd_method`-as-domain assumptions
- one giant builder page as unconditional global product truth
- chat-first shells that hide runtime, policy, and evidence
- dashboard summaries that cannot be expanded into authoritative objects

## Implementation Sequence

### Phase 1

- keep core GTL/ABG pages working across all compatible domains
- surface domain-contract compatibility explicitly

### Phase 2

- bind the first `odd_sdlc` pack to generated requirement, closure, scenario,
  workflow, and release/test artifact surfaces
- reclassify the current `Builder` semantics into `Requirements View` and
  `Process View`

### Phase 3

- generalize pack resolution beyond `odd_sdlc.query-domain v10`
- admit additional `odd_*` packs without changing the core shell

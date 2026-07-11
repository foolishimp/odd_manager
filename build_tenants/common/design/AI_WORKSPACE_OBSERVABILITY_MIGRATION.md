# .ai-workspace Observability Migration

**Status**: Active
**Date**: 2026-07-01
**Owns**: Single source of truth for migrating odd_manager from domain-specific
observer assumptions to a general `.ai-workspace` browser with artifact viewers.
**Implements**: `T-031`
**Derives From**:
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/GOALS.md`
- `specification/requirements/01-control-plane-boundary.md`
- `specification/requirements/03-read-model-and-projection.md`
- `specification/requirements/10-entry-lenses-and-delivery-workspaces.md`
- `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

## Position

The live lane makes `.ai-workspace/` and admitted run carriers the
project-owned observation surface
that `odd_manager` can browse, inventory, and explain. Capabilities are enabled
by viewers over discovered artifacts. A project may expose many observation
features, a few features, or none yet. The manager must still provide a
cohesive project view.

`odd_sdlc` remains historical learning only. Its runtime, adapter, and
privileged Process Navigator projection are retired.

`odd_glc` run proofs are the current reference because they exercise versioned
GTL/ABG runtime truth, proof manifests, test-run archives, event ledgers, and
product overlay meaning without a domain-specific manager adapter.

Final solution invariant:
The same browser and viewer mechanism must work for `odd_glc`, ordinary
Projects, and future `odd_*` products. Specialization comes from the features
and artifacts present under `.ai-workspace/`, not from hardcoded project-line
identity. As `.ai-workspace` gains new feature families, `odd_manager` may add
new widgets by registering new feature detectors, artifact classifiers, and
viewers. The core Project observation model must not fork for each domain.

## UX Realization Boundary

The `.ai-workspace` browser and artifact viewers are governed UX surfaces under
`UX_METHOD.md`.

ADR-002 governs placement. AI Workspace inventories feature availability and
routes to canonical functions; it is not a rival collection navigator. The
Sidecar activity bar and flyout own Tickets and Comments collection hierarchy,
sorting, refresh, and selection. Selected objects render in the canonical
viewer workspace. Artifact rows remain only where no stronger canonical
navigator or specialized viewer exists.

Consequence:
The UX renders typed observation state and emits typed messages. It does not
own filesystem scanning, artifact classification, runtime truth, continuation,
or product-truth mutation.

TEA surface:

| Element | Migration meaning |
| --- | --- |
| `State` | Selected Project, loaded observation inventory, selected feature, selected artifact, selected viewer capability, validation/result state, and view-local expansion/filter state. |
| `Msg` | Load inventory, inventory loaded, inventory failed, select feature, select artifact, select viewer, open raw artifact, refresh inventory, and view-local filter/expand actions. |
| `Update` | Pure transition from `Msg` and `State` to next `State` plus declared `Cmd`. |
| `Cmd` | Fetch observation inventory, fetch raw artifact, fetch viewer payload, and refresh Project registry through admitted server endpoints. |
| `Sub` | Optional server/event subscription only if later design admits live observation updates. |
| Effect membrane | Server API calls and browser integration handlers that interpret declared `Cmd` values and return success/failure `Msg`. |

Runtime validation boundary:
The server observation service validates file presence, JSON, JSONL, and
artifact shape before a specialized viewer is enabled. The browser may render
the returned state. It must not promote a raw file into proof, event, ledger,
catalog, or overlay truth inside view code.

Msg-replay proof target:
At minimum, browser UI closure requires replay proofs for loading inventory,
selecting a feature, selecting an artifact, falling back to raw view, and
rendering incomplete/error states. Product-truth-changing messages are out of
scope for the read-only browser unless a later ticket admits a carrier.

## Ownership

| Layer | Owner | Rule |
| --- | --- | --- |
| Filesystem project root | Project | Owns source, specification, `.ai-workspace`, build tenants, tests, and proof artifacts. |
| `.ai-workspace` observation surface | Project | Publishes project-local context, tickets, comments, runtime, events, ledgers, catalogs, run archives, proofs, and overlays where available. |
| ABG/GTL runtime truth | ABG/GTL | Owns event truth, registry admission, graph-function selection, graph-call opening, traversal, payloads, evidence, frames, continuations, ledgers, and catalogs. |
| Product/domain overlay | Domain product | Adds meaning over ABG/GTL truth without redefining runtime law. |
| odd_manager projection | odd_manager | Inventories artifacts, routes viewers, renders current state, and preserves source traceability. It does not create a rival runtime. |

## Observable Project Definition

A Project is observable when `odd_manager` can determine a project root and
inspect whether `.ai-workspace/` exists.

No single `.ai-workspace` subfeature is mandatory. Each feature has one of
these states:

| State | Meaning |
| --- | --- |
| `present` | Feature exists and can be read enough to route at least one viewer. |
| `missing` | Feature is absent. This is not an error for the Project as a whole. |
| `incomplete` | Feature exists but lacks required files, parseable payloads, or linked evidence for a stronger viewer. |
| `unsupported` | Feature exists but uses an unknown shape or incompatible version. |
| `error` | Feature exists but cannot be read because of filesystem, parse, or validation failure. |

The generic Project view remains available in every state.

## Feature Inventory

The inventory service must detect these `.ai-workspace` features without
requiring domain-specific code first:

| Feature | Typical path | First viewer |
| --- | --- | --- |
| Bootstrap/context | `.ai-workspace/context/` | Context document viewer |
| Tickets | `.ai-workspace/tickets/` | Canonical Tickets activity provider and ticket viewer |
| Comments | `.ai-workspace/comments/` | Canonical Comments activity provider and commentary viewer |
| Runtime state | `.ai-workspace/runtime/` | Runtime artifact browser |
| ABG events | `.ai-workspace/events/` or event paths referenced by proof JSON | Event log viewer |
| System ledger/catalog | `.ai-workspace/runtime/`, `.ai-workspace/ledgers/`, `.ai-workspace/catalogs/`, or referenced artifact paths | ABG system viewer |
| Run archives | `.ai-workspace/runtime/**/operator-runs/`, `test_runs/`, run manifests | Run archive viewer |
| Proof manifests | `**/*manifest*.json`, proof JSON paths, pinned fixtures | Proof manifest viewer |
| Test outputs | `test_runs/`, `test/fixtures/`, package test summaries | Test-run viewer |
| Domain overlays | product-specific overlay manifests, query outputs, registry refs | Domain overlay viewer |

Path names are evidence hints, not law. A viewer must validate artifact shape
before claiming a stronger interpretation.

## Feature-Specialized Widgets

Widgets are enabled by feature contracts, not by project names.

Each widget declares:

- feature ids it consumes;
- artifact kinds it can render;
- required payload fields for full support;
- optional payload fields for enriched support;
- missing/incomplete/unsupported behavior;
- source refs it must preserve;
- whether it is core, ABG/GTL system, or domain-overlay interpretation.

Examples:

| Widget | Feature basis | Applies to |
| --- | --- | --- |
| Ticket lane/list/detail | `.ai-workspace/tickets/` | any Project with tickets |
| Comment board/list/detail | `.ai-workspace/comments/` | any project with comments |
| Event log viewer | GTL/ABG event JSONL | any ABG-backed Project |
| Proof manifest viewer | proof manifest/artifact JSON | any Project with admitted proof carriers |
| Test-run viewer | `test_runs/` summaries and run manifests | any Project with test-run carriers |
| Run Inspector | proof, traversal, event, and assurance carriers | any Project that publishes admitted GTL/ABG run truth |
| Domain overlay viewer | product overlay artifacts | any Project with a declared overlay |

Equal feature, equal widget: Projects publishing the same admitted carrier use
the same viewer. A domain overlay adds meaning only after the generic proof or
run is already visible.

## Component Design

### C-001 Project Observability Inventory

Purpose:
Detect `.ai-workspace` features and candidate artifact paths for the selected
Project.

Proposed carrier:
- `build_tenants/react_vite/src/server/ai-workspace-observation-service.mjs`
- `build_tenants/react_vite/src/contracts/ai-workspace-observation.ts`
- `build_tenants/react_vite/runtime/tests/test_ai_workspace_observation_service.mjs`

Inputs:
- Project root
- Optional discovery budget
- Optional enabled feature filters

Outputs:
- project root and normalized `.ai-workspace` root
- feature states
- artifact candidates
- viewer capabilities
- diagnostics with source paths and parse errors

Design rules:
- Never require a domain pack before inventory.
- Never treat missing features as whole-project failure.
- Preserve absolute source paths internally and relative project paths in UI payloads.
- Bound recursive scans.
- Avoid scanning `node_modules`, `.git`, build outputs, and large generated trees
  unless they are explicit artifact roots such as `test_runs/`.

Audit checklist:
- [ ] Detects a Project with no `.ai-workspace` and returns `missing`, not failure.
- [ ] Detects `.ai-workspace/context`, `tickets`, `comments`, `runtime`, and `events` independently.
- [ ] Detects odd_glc proof fixtures under `test/fixtures` and `test_runs`.
- [ ] Emits explicit `present`, `missing`, `incomplete`, `unsupported`, or `error` state per feature.
- [ ] Includes source refs for every claimed feature.
- [ ] Has bounded traversal tests.

### C-002 Artifact Kind Registry

Purpose:
Classify discovered files into artifact kinds before UI routing.

Proposed artifact kinds:
- `context_document`
- `ticket`
- `comment`
- `runtime_json`
- `event_log_jsonl`
- `system_ledger`
- `system_catalog`
- `proof_manifest`
- `proof_artifact`
- `test_run_summary`
- `domain_overlay`
- `raw_file`

Design rules:
- Classification is evidence-based.
- Filename patterns may propose a kind.
- Payload shape must confirm a stronger kind.
- Unknown files stay visible as `raw_file`.

Audit checklist:
- [ ] JSON parse failure degrades to raw/error state.
- [ ] JSONL event logs are validated line by line with bounded error reporting.
- [ ] odd_glc live proof JSON is classified as `proof_artifact`.
- [ ] odd_glc aggregate live manifest is classified as `proof_manifest`.
- [ ] Sandbox summaries are classified as `test_run_summary`.
- [ ] Unknown files remain browseable.

### C-003 Viewer Capability Router

Purpose:
Map artifact kinds and feature states to viewer capabilities.

Viewer capabilities:
- `browse.raw`
- `context.read`
- `tickets.inspect`
- `comments.inspect`
- `runtime.inspect`
- `events.inspect`
- `abg.system.inspect`
- `proof.inspect`
- `test_run.inspect`
- `domain_overlay.inspect`

Design rules:
- Capabilities are additive.
- One Project can have many independent viewers.
- No capability requires all other capabilities.
- Domain viewers are layered over generic viewers.

Audit checklist:
- [ ] A tickets-only project gets ticket viewer capability.
- [ ] An events-only project gets event viewer capability.
- [ ] A proof-manifest project gets proof viewer capability without tickets.
- [ ] odd_glc gets proof, test-run, event, and domain-overlay candidates when artifacts exist.
- [ ] Unsupported domain overlay does not suppress generic proof/event viewers.

### C-004 .ai-workspace Browser UI

Purpose:
Present `.ai-workspace` as the first-class observation root for the selected
Project.

Proposed UI shape:
- feature inventory summary
- capability chips
- artifact tree grouped by feature
- viewer pane selected by artifact kind
- source path and raw fallback always available

Design rules:
- The browser is a Project workbench, not a domain-specific page.
- It must work for odd_manager, abiogenesis, odd_sdlc, odd_glc, and unknown
  projects.
- Missing features are visible, not hidden.
- Raw file viewing stays available.

Audit checklist:
- [ ] Selecting a Project with `.ai-workspace` shows the observation root.
- [ ] Selecting a Project without `.ai-workspace` shows a coherent empty state.
- [ ] Feature chips distinguish present/missing/incomplete/unsupported/error.
- [ ] Artifact groups can open raw and specialized viewers.
- [ ] The UI does not say odd_glc is an odd_sdlc replacement.

### C-005 Generic Event Log Viewer

Purpose:
Read ABG/GTL event logs independently of domain pack support.

Inputs:
- event log JSONL path
- optional proof artifact that references an event log path

Outputs:
- event count
- event kinds
- source event refs
- selected registry entries where present
- graph-call refs where present
- vector closure summary where present
- parse diagnostics

Design rules:
- Event truth is ABG/GTL-owned.
- The viewer may summarize but must keep raw lines reachable.
- Unknown event kinds remain visible.

Audit checklist:
- [ ] Parses odd_glc live proof referenced event logs.
- [ ] Surfaces `registry_entry_admitted`.
- [ ] Surfaces `graph_function_selected`.
- [ ] Surfaces `graph_call_opened`.
- [ ] Surfaces `vector_closed`.
- [ ] Shows unknown event kinds without failure.
- [ ] Keeps raw event file reachable.

### C-006 Proof Manifest Viewer

Purpose:
Summarize proof manifests and proof artifacts without domain-specific code.

Inputs:
- manifest JSON
- proof artifact JSON
- linked event log path when present
- linked artifact paths when present

Outputs:
- proof kind
- scenario or run identity
- status or convergence state
- duration
- digests
- linked event logs
- linked artifacts
- required runtime truth

Design rules:
- Digest and linked artifact values are evidence, not decoration.
- Missing linked files produce incomplete state.
- Domain interpretation is optional and layered.

Audit checklist:
- [ ] Reads odd_glc aggregate live manifest.
- [ ] Reads all five odd_glc Hello World proof artifacts.
- [ ] Verifies linked event log path existence when local.
- [ ] Reports event log digest from manifest/proof.
- [ ] Shows required runtime truth.
- [ ] Reports incomplete if referenced paths are missing.

### C-007 Test Run Viewer

Purpose:
Summarize test-run artifacts and sandbox summaries.

Inputs:
- `test_runs/` directory
- `sandbox-summary.json`
- package test output summaries where present

Outputs:
- scenario ids
- run ids
- timestamps
- pass/fail/skip state where present
- linked files
- proof input refs

Design rules:
- Test-run viewer is not a runtime authority.
- It reports test evidence and links to proof/runtime viewers where available.

Audit checklist:
- [ ] Groups odd_glc `hello_world_sandbox_parity` by scenario.
- [ ] Opens latest sandbox summary per scenario.
- [ ] Preserves older runs as history.
- [ ] Does not convert sandbox execution into ABG event truth.

### C-008 Generic Run Inspector

Purpose:
Render versioned, source-attributed GTL/ABG run facts as a manager-owned core
projection.

Inputs:
- Project observation topology
- proof and identity carriers
- event ledgers and proof-declared digests
- vector artifacts and typed assurance assets

Outputs:
- overview, graph, traversal, functions, and assets
- diagnostics, assurance, events, stages, transcripts, and artifacts
- source references and explicit event-ledger digest state

Design rules:
- This viewer is cross-domain.
- It must not depend on a domain query adapter or substrate CLI.
- Unknown event kinds remain visible and large ledgers remain server-bounded.

Audit checklist:
- [x] Works on live odd_glc proof, event, traversal, and assurance artifacts.
- [x] Reports missing run truth honestly without disabling the Project.
- [x] Keeps source refs reachable.
- [x] Verifies the event ledger against the proof-declared SHA-256 digest.

### C-009 Domain Overlay Viewer

Purpose:
Layer product/domain meaning over generic artifacts.

First odd_glc overlay inputs:
- lifecycle slot map refs
- software-build overlay refs
- graph-function refs
- scenario ids
- proof role refs
- lifecycle readiness labels

Design rules:
- Domain overlays do not redefine ABG event truth.
- Unsupported overlays degrade to raw or generic proof view.
- odd_glc overlay support must not become an odd_sdlc clone.

Audit checklist:
- [ ] Shows odd_glc software-build overlay identity.
- [ ] Shows selected graph-function ref from proof/event truth.
- [ ] Labels scenario identities without changing runtime facts.
- [ ] Does not claim odd_glc owns graph-call opening or event emission.

### C-010 Run Inspector Integration

Purpose:
Expose process-first run operations from the generic Project topology.

Target:
- run projection starts from selected Project identity and discovered carriers
- generated workspaces remain subordinate to Project identity
- the typed projection is cross-domain and runtime-validated at client ingress
- domain overlays are optional interpretation over admitted refs
- unsupported run carriers do not suppress generic Project browsing

Audit checklist:
- [x] Run Inspector renders generic GTL/ABG proof state without install validation.
- [x] Live odd_glc data-mapper runs expose operational and assurance sections.
- [x] Unsupported Projects retain the generic Project browser.
- [x] New shells can target admitted run workspaces under their owning Project.

## Historical Migration Walk Through

The phase plan below records the 2026-07-01 migration hypothesis. The
2026-07-10 Project Observation Topology Reframe supersedes adapter-preservation
and Process Navigator steps in this historical plan.

### Phase 0 - Baseline and containment

Goal:
Record what exists today and prevent accidental scope expansion.

Work:
- Snapshot current odd_sdlc-specific Process Navigator assumptions.
- Identify the current Project Browser and SurfaceInspector file paths.
- Register odd_glc as a Project only as observation evidence, not as a new
  manager identity law.

Exit:
- T-031 cites this design.
- No local odd_sdlc runtime is restored to odd_manager.

### Phase 1 - Inventory service

Goal:
Create the server-side `.ai-workspace` feature inventory.

Work:
- Add inventory service and contract.
- Add tests for empty, partial, odd_manager, odd_sdlc, and odd_glc-like
  fixtures.
- Emit feature states and artifact candidates.

Exit:
- Runtime tests prove feature detection without domain adapters.

### Phase 2 - Artifact classification and capability routing

Goal:
Route discovered artifacts to viewers.

Work:
- Add artifact kind classifiers.
- Add viewer capability routing.
- Preserve raw fallback.

Exit:
- Tests prove independent capability enablement.

### Phase 3 - Browser UI

Goal:
Make `.ai-workspace` a first-class Project observation root.

Work:
- Add feature inventory summary to Sidecar/Project Browser or successor pane.
- Group artifacts by feature.
- Open specialized viewers from artifact rows.

Exit:
- UI replay tests cover present/missing/incomplete states.

### Phase 4 - Generic proof and event viewers

Goal:
Make odd_glc Hello World proof evidence legible without odd_glc-specific UI
first.

Work:
- Add proof manifest viewer.
- Add event log viewer.
- Add test-run viewer.
- Link proof artifacts to event log summaries where local paths exist.

Exit:
- odd_glc aggregate manifest and live proof JSON fixtures render through
  generic viewers.

### Phase 5 - ABG system projection

Goal:
Expose ABG 4.2 system facts as core manager-owned projection.

Work:
- Extract registry entries, graph-function selections, node-type entries,
  graph-call openings, vector closures, payload/evidence facts, and convergence
  state from event/proof artifacts.
- Keep raw event refs traceable.

Exit:
- odd_glc Hello World live proofs render ABG system truth without odd_sdlc.

### Phase 6 - Domain overlay layering

Goal:
Add product meaning after generic truth is visible.

Work:
- Add odd_glc overlay interpretation for software-build lifecycle refs.
- Keep odd_sdlc as compatibility adapter.
- Add unsupported-domain state for unknown overlays.

Exit:
- odd_glc labels enrich the generic proof/event view without redefining runtime
  ownership.

### Phase 7 - Process Navigator migration

Goal:
Move process-first view from domain-specific assumption to generic inventory
plus optional adapters.

Work:
- Feed Process Navigator or successor from the `.ai-workspace` inventory.
- Make ABG system facts the first process projection layer.
- Move odd_sdlc-specific projections behind adapter boundaries.

Exit:
- Process Navigator can show generic ABG/proof state for odd_glc and keep
  existing odd_sdlc adapter behavior where still supported.

### Phase 8 - Cleanup and publication

Goal:
Close migration without leaving two competing observation models.

Work:
- Update design and ticket evidence.
- Remove stale assumptions that require odd_sdlc install validation for generic
  ABG observation.
- Keep compatibility tests for odd_sdlc adapter until it is intentionally
  retired or repriced.

Exit:
- T-031 can close under its closure law.

## Global Audit Checklist

Authority:
- [ ] `.ai-workspace` is the observation root.
- [ ] Missing features are explicit states, not whole-project failure.
- [ ] ABG/GTL runtime truth remains separate from product overlays.
- [ ] odd_manager does not write runtime truth.
- [ ] No local odd_sdlc runtime install is restored to odd_manager.

Inventory:
- [ ] Empty project fixture.
- [ ] Project with `.ai-workspace` only.
- [ ] Project with tickets/comments only.
- [ ] Project with events only.
- [ ] Project with proof manifest only.
- [ ] Project with odd_glc Hello World proof artifacts.
- [ ] Project with odd_sdlc adapter artifacts.

Viewers:
- [ ] Raw fallback for every artifact.
- [ ] Ticket viewer remains functional.
- [ ] Comment viewer remains functional.
- [ ] Event viewer handles JSONL and parse errors.
- [ ] Proof viewer handles manifests, proof JSON, missing links, and digests.
- [ ] Test-run viewer handles multiple historical runs.
- [ ] ABG system viewer handles registry, selection, graph call, vector closure,
  payload/evidence, and convergence facts.
- [ ] Domain overlay viewer cannot override ABG facts.

UI:
- [ ] Project Browser can register odd_glc.
- [ ] `.ai-workspace` feature summary appears for selected Project.
- [ ] Present/missing/incomplete/unsupported/error states are visible.
- [ ] Specialized viewers are reachable from artifact rows.
- [ ] Raw source path is always reachable.

Regression:
- [ ] Existing odd_sdlc Process Navigator tests remain meaningful or are
  intentionally repriced.
- [ ] Unsupported projects remain selectable and browseable.
- [ ] `npm run test:runtime:node` passes.
- [ ] `npm run build` passes or known build warnings are documented.
- [ ] Browser smoke proof covers the new `.ai-workspace` browser path.

odd_glc proof:
- [ ] Aggregate live manifest is detected.
- [ ] Five Hello World live proof artifacts are detected.
- [ ] Event logs linked by proof artifacts are readable where present.
- [ ] Registry entries are surfaced.
- [ ] Graph-function selections are surfaced.
- [ ] Graph-call openings are surfaced.
- [ ] Vector closures are surfaced.
- [ ] Scenario ids and software-build overlay refs are shown as overlay meaning.

## Historical Design Module Self-Review - 2026-07-01

Status at the time:
This migration was design-method governed but not yet design-method closed.
S-001 through S-005 are closed. S-006 has a first generic artifact-inspection
slice. S-007 through S-010 remain open. The current implementation is therefore
a lawful intermediate state, not a final replacement for existing odd_sdlc
Process Navigator behavior.

Smallest lawful re-entry point:
`design_reframe`. The work changes the realization structure of project
observation while preserving the product requirement that odd_manager remains a
read-only manager-owned observation/control plane.

### Independent Authoritative Carrier Set

| Carrier | File | Authority role | Promotion reason |
| --- | --- | --- | --- |
| `AiWorkspaceObservation` | `src/contracts/ai-workspace-observation.ts` | Admitted read-only inventory contract for Project observability. | This is the public boundary between server classification and UX state. |
| `AiWorkspaceFeatureRecord` | `src/contracts/ai-workspace-observation.ts` | Subordinate feature-state carrier inside the observation contract. | Exported so projections and tests can type feature summaries without reconstructing payload shape. |
| `AiWorkspaceArtifactRecord` | `src/contracts/ai-workspace-observation.ts` | Subordinate artifact carrier inside the observation contract. | Exported because artifact routing, raw fallback, and specialized viewer eligibility all depend on this shape. |
| `AiWorkspaceObservationDiagnostic` | `src/contracts/ai-workspace-observation.ts` | Scan-budget and truncation diagnostics for the observation contract. | Keeps scan limits and incomplete states explicit rather than view-local. |
| `.ai-workspace` observation service | `src/server/ai-workspace-observation-service.mjs` | Effect-edge projector from filesystem artifacts into the observation contract. | Owns filesystem traversal, JSON/JSONL validation, classifier evidence, and fail-closed raw fallback. |
| `asAiWorkspaceObservation` | `src/features/sidecar/ai-workspace-observation-validation.ts` | Browser ingress validator for the server contract. | Collapses the out-of-process API payload before it enters UX state. |
| `AiWorkspaceBrowserSummary` | `src/features/sidecar/ai-workspace-browser.ts` | Pure browser summary projection over the admitted observation. | Prevents `SidecarPanel` from owning feature order, grouping, or stale-project checks. |
| `AiWorkspaceArtifactInspection` | `src/features/sidecar/ai-workspace-artifact-inspection.ts` | Pure viewer projection over an already-classified artifact and opened raw surface content. | Provides bounded proof/event/test/system summaries without promoting raw files into authority. |

No extra runtime authority is introduced. ABG/GTL still owns runtime truth.
odd_manager owns only observation inventory, projection, viewer routing, and
read-only interpretation.

### Structural Carrier Diagram

```mermaid
flowchart LR
  ProjectRoot[Project root] --> WorkspaceFiles[.ai-workspace and artifact files]
  WorkspaceFiles --> Service[ai-workspace observation service]
  Service --> Contract[AiWorkspaceObservation]
  Contract --> ClientValidator[asAiWorkspaceObservation]
  ClientValidator --> SidecarState[SidecarState.aiWorkspaceObservation]
  SidecarState --> BrowserSummary[AiWorkspaceBrowserSummary]
  BrowserSummary --> ProjectBrowser[Project Browser summary and artifact rows]
  ProjectBrowser --> SurfaceOpen[viewer/open surface]
  SurfaceOpen --> SurfaceAPI[/api/surface raw file]
  Contract --> ArtifactMatch[classified artifact lookup]
  SurfaceAPI --> ArtifactInspection[AiWorkspaceArtifactInspection]
  ArtifactMatch --> ArtifactInspection
  ArtifactInspection --> InspectionPanel[generic artifact inspection panel]
  SurfaceAPI --> RawDocument[DocumentViewer raw fallback]
```

Authority seam:
The service is the only classifier. The browser validator admits or rejects the
service contract. The artifact inspection panel can summarize only when an open
raw surface matches a server-classified `AiWorkspaceArtifactRecord`. It does not
upgrade an arbitrary file into a proof, event, ledger, catalog, or overlay.

### UX Method Self-Review

| UX element | Current implementation | Status |
| --- | --- | --- |
| `State` | `SidecarState.aiWorkspaceObservation`, selection, viewer tabs, document viewer state, local surface loading state. | Partial. Observation inventory is reducer-owned; open-file content remains in `SurfaceInspector` local state by existing sidecar pattern. |
| `Msg` | `load/request`, `load/start`, `load/done`, `select`, `viewer/open`, document zoom/reset/fit messages. | Partial. Inventory and viewer-open messages are typed; artifact-inspection selection is currently implicit in opening a surface. |
| `Update` | `reduceSidecarState` and `updateSidecarState` keep observation load and stale-result behavior pure. | Covered for inventory load and stale-load behavior. |
| `Cmd` | `load` command fetches `/api/ai-workspace/observation`; `viewer/open` routes to the existing surface viewer. | Partial. Surface content fetch remains a component effect instead of a reducer-declared command. |
| Effect membrane | Server API endpoint plus `interpretSidecarCommand`; `SurfaceInspector` fetches raw surfaces. | Adequate for this slice, but surface fetch should be repriced if S-006 expands into richer linked-artifact traversal. |
| Runtime validation | Server validates file candidates; browser validates the observation API payload before state admission. | Covered for inventory. Surface file content is raw input to bounded viewer projections only after server classification. |
| Msg replay | `test_sidecar_msg_replay.mjs` covers stale observation loads and current observation admission. | Partial. Needs replay proof for explicit artifact/viewer selection before S-006 closure. |

UX compliance fixes applied during self-review:
- Added browser-side admission validation for `AiWorkspaceObservation` so an
  out-of-process payload cannot enter reducer state by shallow cast.
- Bounded JSON artifact inspection by byte limit.
- Bounded JSONL artifact inspection by inspected non-empty line count and
  explicit truncation diagnostics.
- Added a hidden feature-group count in the compact Project Browser summary so
  bounded display does not silently hide available observation groups.

### Lifecycle Confirmation

| Lifecycle point | Current answer |
| --- | --- |
| Build | React/Vite tenant builds the observation contract, server service, reducers, projections, and sidecar UI. |
| Assurance | Runtime tests cover service classification, browser summary projection, browser ingress validation, artifact inspection, and sidecar Msg replay. |
| Release | No release cut claimed. This remains active T-031 work. |
| Deploy | Local dev server/browser smoke only. No packaged deployment change claimed. |
| Live | odd_glc live proof artifacts were observed through the generic Project Browser path during browser smoke. |
| Telemetry | Current diagnostics are scan and parse diagnostics. Live observation subscriptions remain out of scope until explicitly admitted. |
| Retirement | At this review point, legacy local odd_sdlc runtime remained removed while adapter retirement was still pending. Superseded by the 2026-07-10 reframe below. |

### Non-Closure Gaps At 2026-07-01

- S-006 does not yet provide linked-artifact traversal from proof artifacts to
  event logs or manifests.
- S-007 ABG system viewer is not implemented. Registry entries,
  graph-function selections, graph-call openings, vector closures, and
  convergence facts are not yet separately projected.
- S-008 domain overlay layering is not implemented beyond generic fact display
  of overlay refs present in proof JSON.
- S-009 Process Navigator still has odd_sdlc adapter assumptions. It has not
  been migrated to start from the generic `.ai-workspace` inventory.
- S-010 cleanup/publication remains pending.

## Project Observation Topology Reframe - 2026-07-10

The selected Project is the observation boundary. A generated run workspace is
not a second Project merely because runtime files live below a timestamped run
root. The manager discovers and relates those roots through one admitted,
read-only topology:

```text
ProjectObservationTopology
  = ProjectIdentity
  + ProjectAiWorkspaceRoot
  + RunRoot[]
  + RunWorkspaceRoot[]
  + ProofCarrier[]
  + EventCarrier[]
  + ArtifactCarrier[]
```

`ProjectIdentity` is read from published product or install carriers. Repository
basename and hard-coded product lists are not identity authority. A run is
admitted only when a bounded proof or identity carrier establishes its shape.

The generic operational projection is `AbgRunObservation`. It starts from a
selected topology run and exposes these independently inspectable sections:

| Section | Runtime meaning |
| --- | --- |
| Overview | Run identity, liveness, substrate pin, graph/overlay/startup refs, event and vector totals. |
| Traversal | Frames, vectors, attempts, continuation/retry state, requirement lineage, and lazy vector evidence. |
| Functions | Published graph-function selection and call activity. |
| Catalog | Runtime registry admissions and rejections, node-type and graph-function entries, declaration/template metadata, construction-action catalog refs, variants, and source event indexes. |
| Assets | Materialized outputs with producing vector/stage and source artifact. |
| Assurance | Evidence/admission counts, closures, requirements, test results, depth proof, and mutation outcomes. |
| Events | Bounded event timeline and complete event-kind counts; unknown kinds remain visible. |
| Stages | Per-vector stage/process status, timing, attempts, and target type. |
| Transcripts | Bounded startup and process output with its source carrier. |
| Artifacts | Proof, identity, event, test, depth, mutation, and vector-carrier references. |
| Runtime target | Existing matching shell or a new Project-owned shell rooted at the admitted run workspace. |

The projection never recreates `odd_sdlc` process carriers. Domain overlays may
label generic refs and stages after the core projection is admitted; they do not
own run state, traversal, evidence, assurance, continuation, or event truth.
Catalog entries are decoded only from bounded JSON carried by admitted ABG
events. The manager does not import or execute code from the observed Project.

### UX Runtime Model

```text
State = selected Project + discovered runs + selected run + selected section
        + traversal summary/detail cache + refresh status
Msg   = load | refresh | select run | select section | select vector
Cmd   = load topology/run projection | load traversal | load vector detail
Sub   = bounded refresh while a Run Inspector tab is active
```

Project change clears all run-scoped state before new effects are admitted.
Every asynchronous result carries the Project root and selected run id; stale
results are ignored. Refresh invalidation includes proof, identity, event, and
vector-artifact directory signatures rather than proof mtime alone.

### Recovery Rule

The retired Process Navigator implementation is deletion evidence, not a source
dependency. Capability recovery is complete only when its generic operational
meanings remain available through `AbgRunObservation`, runtime validation,
message replay, focused service tests, and browser proof. Reintroducing an
`odd_sdlc` adapter does not satisfy this design.

## Non-Goals

- Do not build an odd_glc-specific replacement for odd_sdlc Process View.
- Do not make odd_glc the manager identity.
- Do not require all Projects to expose ABG runtime truth.
- Do not treat test-run sandbox output as ABG event truth.
- Do not hide raw files behind specialized viewers.
- Do not restore a retired domain adapter as a shortcut to generic run
  observation.

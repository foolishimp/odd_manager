---
id: T-031
title: Establish a general .ai-workspace browser with odd_glc proof viewers
type: feature
ticket_category: observation_contract
status: active
review_status: pending
goal: establish-abg-4-2-system-observation-contract
build_tenant: react_vite
owner: unassigned
change_intent: >-
  Turn what was learned from odd_sdlc observation into a general-purpose
  .ai-workspace browser whose capabilities are enabled by viewers over
  discovered artifacts, with odd_glc Hello World proof artifacts as the first
  non-odd_sdlc proof target.
change_class: design_reframe
re_entry_point: design
affected_boundary: >-
  specification/PRODUCT.md, specification/GOALS.md,
  specification/requirements/01-control-plane-boundary.md,
  specification/requirements/03-read-model-and-projection.md,
  specification/requirements/10-entry-lenses-and-delivery-workspaces.md,
  build_tenants/common/design/AI_WORKSPACE_OBSERVABILITY_MIGRATION.md,
  build_tenants/common/design/ODD_MANAGER_DASHBOARD.md,
  build_tenants/react_vite/src/contracts/ai-workspace-observation.ts,
  build_tenants/react_vite/src/server/ai-workspace-observation-service.mjs,
  build_tenants/react_vite/src/server/project-asset-surface-service.mjs,
  build_tenants/react_vite/src/server/sidecar-process-projection.mjs,
  build_tenants/react_vite/src/server/index.mjs,
  build_tenants/react_vite/src/contracts/process.ts,
  build_tenants/react_vite/src/features/sidecar/ai-workspace-browser.ts,
  build_tenants/react_vite/src/features/sidecar/ai-workspace-artifact-inspection.ts,
  build_tenants/react_vite/src/features/sidecar/ai-workspace-observation-validation.ts,
  build_tenants/react_vite/src/features/sidecar/sidecar-state.ts,
  build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx,
  build_tenants/react_vite/src/app/styles.css,
  build_tenants/react_vite/runtime/tests/test_ai_workspace_browser_projection.mjs,
  build_tenants/react_vite/runtime/tests/test_ai_workspace_artifact_inspection.mjs,
  build_tenants/react_vite/runtime/tests/test_ai_workspace_observation_validation.mjs,
  build_tenants/react_vite/runtime/tests/test_ai_workspace_observation_service.mjs,
  build_tenants/react_vite/runtime/tests/test_sidecar_process_projection.mjs,
  build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
priority: high
created_at: 2026-07-01
updated_at: 2026-07-01
governance_scope: STDO Method, ODD Method, ABG 4.2 system observation
intake_source: >-
  Operator test: use odd_manager to observe the odd_glc Hello World tests and
  make odd_glc a first-class citizen of odd_manager.
depends_on:
  - G-001
  - G-002
target_truth: >-
  odd_manager provides a cohesive project view by browsing .ai-workspace as the
  project-owned observation surface. Capabilities are enabled by artifact
  viewers for the features actually present under that folder. odd_glc is not a
  replacement for odd_sdlc and does not require an odd_glc-specific manager
  clone; its Hello World proof artifacts are the first proof that the generic
  .ai-workspace browser can observe ABG/GTL system evidence and product overlay
  meaning outside the odd_sdlc adapter.
final_solution_invariant: >-
  The final solution must work equally well for odd_sdlc, odd_glc, and future
  odd_* products because capabilities are specialized by .ai-workspace features
  and artifact shapes, not by hardcoded project-line identity. New widgets may
  be added freely as new .ai-workspace feature families appear, provided each
  widget declares its feature inputs, artifact kinds, source refs, and
  incomplete/unsupported behavior.
observation_principle: >-
  A Project becomes observable through project-owned .ai-workspace surfaces.
  Those surfaces may be complete, partial, or absent depending on the state of
  the Project. odd_manager must compose a coherent project view from whatever
  observation features are present rather than requiring every Project to expose
  a full domain pack, full ABG runtime ledger, or full proof archive.
current_gap: >-
  Project discovery can currently find /Users/jim/src/apps/odd_glc and the file
  browser can inspect odd_glc proof JSON and manifests after registration, but
  the manager does not yet expose a general .ai-workspace feature inventory or
  route discovered artifacts to specialized viewers. The existing Process
  Navigator remains shaped by odd_sdlc.query-domain,
  .ai-workspace/runtime/odd_sdlc/operator-runs, and odd_sdlc TypeScript install
  validation rather than by generic feature detection over project-owned
  .ai-workspace artifacts.
closure_law: >-
  Close only when the manager has a general .ai-workspace browser with
  capability viewers selected from discovered artifacts, and odd_glc Hello World
  evidence is observable through that generic path. Do not close by creating an
  odd_glc replacement for odd_sdlc, relabeling odd_sdlc projection code, or
  requiring a workspace-local odd_sdlc runtime install.
proof_surface:
  - build_tenants/common/design/AI_WORKSPACE_OBSERVABILITY_MIGRATION.md
  - /Users/jim/src/apps/odd_glc/specification/PRODUCT.md
  - /Users/jim/src/apps/odd_glc/build_tenants/odd_glc/typescript/test/proof_inputs/glc-software-build-overlay-live-manifest.json
  - /Users/jim/src/apps/odd_glc/build_tenants/odd_glc/typescript/test_runs/glc_software_build_overlay_live/*/*/odd-glc-software-build-overlay-live-proof.json
  - /Users/jim/src/apps/odd_glc/build_tenants/odd_glc/typescript/test_runs/hello_world_sandbox_parity/*/*/sandbox-summary.json
  - build_tenants/react_vite/src/contracts/ai-workspace-observation.ts
  - build_tenants/react_vite/src/server/ai-workspace-observation-service.mjs
  - build_tenants/react_vite/src/server/index.mjs
  - build_tenants/react_vite/src/features/sidecar/ai-workspace-browser.ts
  - build_tenants/react_vite/src/features/sidecar/ai-workspace-artifact-inspection.ts
  - build_tenants/react_vite/src/features/sidecar/ai-workspace-observation-validation.ts
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_ai_workspace_browser_projection.mjs
  - build_tenants/react_vite/runtime/tests/test_ai_workspace_artifact_inspection.mjs
  - build_tenants/react_vite/runtime/tests/test_ai_workspace_observation_validation.mjs
  - build_tenants/react_vite/runtime/tests/test_ai_workspace_observation_service.mjs
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/src/server/project-asset-surface-service.mjs
  - build_tenants/react_vite/src/server/sidecar-process-projection.mjs
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/runtime/tests/test_sidecar_process_projection.mjs
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
acceptance_criteria:
  - odd_manager defines and tests a feature-detected .ai-workspace project observability model, with explicit present/missing/incomplete states for context, tickets, comments, runtime, events, ledgers, catalogs, proof manifests, test runs, and domain overlays.
  - The same feature detector, artifact classifier, and viewer routing mechanism serves odd_sdlc, odd_glc, and unsupported or future odd_* projects.
  - The browser exposes .ai-workspace as a first-class Project observation root, not just as raw filesystem folders.
  - Artifact viewers are capability-enabled from detected files and directories, so a Project can gain ticket, comment, event-log, runtime, proof-manifest, test-run, catalog, or domain-overlay views independently.
  - New .ai-workspace feature families can add widgets without forking the core Project observation model.
  - Project discovery and registration keep odd_glc selectable and browseable without requiring odd_glc to become a manager-specific replacement for odd_sdlc.
  - The maintained Project registry can include odd_glc without requiring .genesis/odd_sdlc or .ai-workspace/runtime/odd_sdlc-* surfaces in the odd_manager workspace.
  - Selecting odd_glc keeps generic Project/file browsing available and exposes odd_glc proof files as ordinary surfaces.
  - Process Navigator or its successor is fed by the generic .ai-workspace artifact inventory before any domain-specific adapter is applied.
  - A generic ABG 4.2 proof/event viewer can read odd_glc Hello World live proof artifacts.
  - The projection surfaces registry entries, node-type entries, graph-function selections, graph-call openings, vector closures, payload/evidence facts, event-log digests, selected graph-function refs, and convergence state from ABG-emitted truth.
  - odd_glc lifecycle overlay labels and software-build overlay refs appear as domain/product interpretation, while ABG remains the owner of runtime events, selection, graph-call opening, traversal, evidence admission, folds, residuals, continuation, and re-entry.
  - Missing or incompatible odd_glc proof surfaces render an explicit unsupported/incomplete state rather than falling back to odd_sdlc assumptions.
  - Tests cover odd_glc supported projection, ordinary unsupported project selection, and preservation of existing odd_sdlc Process Navigator behavior while that adapter remains supported.
non_closure_conditions:
  - The work creates an odd_glc-specific replacement lane instead of a general .ai-workspace browser.
  - The work leaves odd_sdlc on a privileged observation path that cannot be explained as feature-specific .ai-workspace viewers.
  - odd_glc support is implemented by copying or renaming odd_sdlc query-domain assumptions.
  - Process Navigator still requires odd_sdlc.query-domain or an odd_sdlc TypeScript install before rendering ABG system truth.
  - odd_glc is only browseable as files and has no first-class runtime/proof projection.
  - odd_manager treats odd_glc lifecycle overlays as ABG runtime authority.
  - The manager workspace regains a local odd_sdlc runtime install as part of this work.
---

# T-031: General .ai-workspace Browser With odd_glc Proof Viewers

## Triage

Smallest lawful re-entry point: design.

The product direction is already present in current goals and product truth:
ABG/GTL system truth is the manager-owned observation core, and domain-specific
surfaces are admitted through domain/product packs. The new lane is not to
create odd_glc replacements for odd_sdlc views. It is to generalize what was
learned from odd_sdlc into a .ai-workspace browser whose viewers are enabled by
the artifacts actually present in the selected Project.

## Current Reality

odd_manager can discover `/Users/jim/src/apps/odd_glc` from the apps workspace.
The Project Browser can register that path and browse proof surfaces. The
current odd_glc tree has observer-friendly artifacts for the software-build
Hello World ladder:

- aggregate live manifest;
- per-scenario live proof JSON;
- ABG event-log paths and digests;
- sandbox parity summaries.

That is enough for file-level observation. It is not enough for cohesive
project observation because the manager has no general feature inventory or
artifact-viewer routing over `.ai-workspace/`.

The governing observation surface is `.ai-workspace/`. A Project may expose
some, all, or none of the expected subfeatures:

- context and bootstrap notes;
- tickets and comments;
- runtime state;
- ABG event logs;
- system ledgers and catalogs;
- run archives and test outputs;
- proof manifests and pinned fixtures;
- domain or product overlays.

odd_manager should detect those features and report their state. Missing
features are not an error by themselves. They become an explicit unsupported,
not-yet-observable, or incomplete state for the relevant lens while the generic
Project view remains available.

Viewer capability should be additive. A Project with only tickets and comments
gets ticket/comment viewers. A Project with event logs gets event viewers. A
Project with proof manifests gets proof viewers. A Project with domain overlays
gets domain interpretation viewers. No single feature is mandatory for the
Project to remain observable.

The current Process Navigator implementation is still tied to odd_sdlc:

- contract names are `odd_sdlc.query-domain` and `odd_sdlc.catalog`;
- operator-run root is `.ai-workspace/runtime/odd_sdlc/operator-runs`;
- TypeScript install validation expects odd_sdlc projection and manifest
  shapes;
- workspace profile activation only admits odd_sdlc and odd_world_model as
  active domain packs.

## Target Shape

Add a general .ai-workspace observation path with layered viewers:

1. Project observation inventory:
   detected .ai-workspace subfeatures, artifact kinds, freshness, completeness,
   and viewer availability.
2. Manager-owned ABG 4.2 system projection:
   registry entries, graph-function selections, node-type facts,
   graph-call openings, vector closures, payload/evidence facts, event logs,
   proof digests, convergence, and artifact refs.
3. odd_glc product interpretation:
   lifecycle slot map refs, software-build overlay refs, lifecycle node-type
   labels, scenario identities, proof role refs, and lifecycle readiness labels.

Higher layers must not redefine lower layers.

## Execution Plan

Execution is sliced so the generic observation model exists before any
Process Navigator migration or domain overlay work.

| Slice | Priority | Depends on | Status | Work | Closure check |
| --- | --- | --- | --- | --- | --- |
| S-001 Authority capture | P0 | none | completed | Keep this ticket and `build_tenants/common/design/AI_WORKSPACE_OBSERVABILITY_MIGRATION.md` as the migration source of truth. Add the execution plan and UX-method boundary. | Ticket cites plan, design cites T-031, and no odd_glc-specific manager lane is introduced. |
| S-002 Read-only observation inventory | P0 | S-001 | completed | Add `.ai-workspace` observation contract and server service that detects feature states, artifact candidates, viewer capabilities, and diagnostics. | Missing, partial, and odd_glc-like fixtures return explicit feature states without requiring domain adapters. |
| S-003 API boundary | P0 | S-002 | completed | Expose a read-only observation endpoint for the selected Project. | UI can consume inventory state without file reads or viewer-local classification. |
| S-004 Artifact classification | P0 | S-002 | completed | Classify context, tickets, comments, runtime JSON, event JSONL, ledgers, catalogs, proof manifests, proof artifacts, test-run summaries, overlays, and raw files. | Unknown and malformed files remain browseable as raw/error artifacts. |
| S-005 Browser UI | P1 | S-003, S-004 | completed | Add `.ai-workspace` feature summary, artifact groups, capability indicators, and raw/specialized viewer entry points. | The Project Browser works for odd_sdlc, odd_glc, odd_manager, and unsupported projects through the same mechanism. |
| S-006 Generic proof/event/test viewers | P1 | S-004, S-005 | in_progress | Implement proof manifest, proof artifact, event log, and test-run viewers over classified artifacts. | odd_glc Hello World proofs render as generic proof/test/event evidence first. |
| S-007 ABG system viewer | P1 | S-004, S-006 | pending | Extract ABG 4.2 system facts from events/proofs and keep source refs reachable. | ABG truth renders without `odd_sdlc.query-domain` or local odd_sdlc install validation. |
| S-008 Domain overlay layering | P2 | S-006, S-007 | pending | Add optional odd_glc and odd_sdlc overlay interpretation above generic proof/system facts. | Overlay labels enrich generic truth without redefining ABG ownership. |
| S-009 Process Navigator migration | P2 | S-005, S-007, S-008 | pending | Feed Process Navigator or successor from the generic inventory before domain adapters. | odd_sdlc remains compatible as adapter; odd_glc proof evidence appears through generic inventory. |
| S-010 Cleanup and closure | P3 | S-005 through S-009 | pending | Remove stale privileged assumptions or capture residual pressure in follow-up tickets. | T-031 non-closure conditions are false or explicitly repriced. |

UX execution rule:
Viewer UI slices must adopt `UX_METHOD.md`: typed state, typed messages, pure
update, declared command/effect membrane, runtime validation before UX state,
and Msg-replay proof for product-meaningful interactions. The UX layer must not
become the hidden constructive carrier for observation truth.

## First Proof Target

Use the existing odd_glc Hello World ladder as the first test fixture:

- `SCN-GLC-HELLO-WORLD-CLI-BASIC`;
- `SCN-GLC-HELLO-WORLD-JS-TENANT-TEST`;
- `SCN-GLC-HELLO-WORLD-RUST-CLI`;
- `SCN-GLC-HELLO-WORLD-RUST-SERVICE`;
- `SCN-GLC-HELLO-WORLD-PARALLEL-JS`.

The proof should show odd_manager can observe those runs through the generic
.ai-workspace browser as ABG-started software-build overlay traversals, not
merely open the proof files and not create an odd_glc-specific clone of the
odd_sdlc process view.

## Execution Record

2026-07-01:
- Completed S-001 through S-003 and started S-004.
- Added the migration execution plan to this ticket and the UX-method boundary
  to `AI_WORKSPACE_OBSERVABILITY_MIGRATION.md`.
- Added `build_tenants/react_vite/src/contracts/ai-workspace-observation.ts`.
- Added `build_tenants/react_vite/src/server/ai-workspace-observation-service.mjs`
  with bounded read-only inventory, feature states, artifact candidates,
  viewer capability routing, JSON/JSONL validation, and raw/error fallback.
- Added read-only API endpoint `GET /api/ai-workspace/observation`.
- Added `build_tenants/react_vite/runtime/tests/test_ai_workspace_observation_service.mjs`.
- Focused proof:
  `node --test runtime/tests/test_ai_workspace_observation_service.mjs` passed
  4/4.
- Regression proof:
  `npm run test:runtime:node` passed 173/173.
- Build proof:
  `npm run build` passed with existing chunk-size warnings only.
- Diff hygiene:
  `git diff --check` passed for the T-031 touched files.
- Live odd_glc inventory smoke:
  scanning `/Users/jim/src/apps/odd_glc` found present context, tickets,
  comments, events, proofs, test-run, and domain-overlay candidates; 15
  `proof_artifact`, 26 `proof_manifest`, and 142 `test_run_summary` artifacts
  were classified without truncation at `maxArtifacts: 2500`.
- Added P0-P3 priority and dependency ordering to the execution plan.
- Completed S-004 classifier hardening:
  event JSONL, ledger JSON/JSONL, catalog JSON/JSONL, domain overlay JSON,
  unknown raw files, and malformed JSON fallback now have focused regression
  coverage.
- S-004 proof:
  `node --test runtime/tests/test_ai_workspace_observation_service.mjs` passed
  6/6.
- S-004 regression proof:
  `npm run test:runtime:node` passed 175/175.
- Build proof:
  `npm run build` passed with existing chunk-size warnings only.
- Started S-005 with state-first UI integration as the next dependency edge.
- S-005 partial implementation:
  threaded `AiWorkspaceObservation` through Sidecar reducer-owned state,
  added runtime validation in the load command interpreter, and rendered a
  compact `.ai-workspace` feature/capability summary in Project Browser for
  the active Project.
- S-005 replay proof:
  `test_sidecar_msg_replay.mjs` now proves stale load results cannot overwrite
  the active Project's observation inventory and current load results admit the
  matching Project observation.
- S-005 focused proof:
  `node --test runtime/tests/test_sidecar_msg_replay.mjs runtime/tests/test_ai_workspace_observation_service.mjs`
  passed 68/68.
- S-005 regression proof:
  `npm run test:runtime:node` passed 175/175.
- S-005 build proof:
  `npm run build` passed with existing chunk-size warnings only.
- S-005 refactor slice:
  extracted `.ai-workspace` browser projection logic into
  `src/features/sidecar/ai-workspace-browser.ts`, leaving `SidecarPanel` to
  render projection output rather than own feature ordering, stale-project
  checks, or artifact grouping.
- Added artifact-group projection to the Project Browser summary so the active
  Project shows grouped `.ai-workspace` evidence categories before specialized
  viewers exist.
- Added `runtime/tests/test_ai_workspace_browser_projection.mjs`.
- Refactor focused proof:
  `node --test runtime/tests/test_ai_workspace_browser_projection.mjs runtime/tests/test_sidecar_msg_replay.mjs runtime/tests/test_ai_workspace_observation_service.mjs`
  passed 70/70.
- Refactor regression proof:
  `npm run test:runtime:node` passed 177/177.
- Refactor build proof:
  `npm run build` passed with existing chunk-size warnings only.
- S-005 artifact-row entry slice:
  added bounded artifact rows under each `.ai-workspace` feature group, compact
  artifact labels, primary capability labels, and an `Open` path through the
  existing Project Browser surface selection flow. This proves the browser can
  route discovered artifacts to the existing raw surface viewer without adding
  project-local runtime authority.
- S-005 completed:
  specialized proof/event/test rendering is intentionally tracked as S-006;
  S-005 closes the browser feature summary, artifact grouping, capability
  indicators, and raw artifact entry point.
- Artifact-row focused proof:
  `node --test runtime/tests/test_ai_workspace_browser_projection.mjs runtime/tests/test_sidecar_msg_replay.mjs runtime/tests/test_ai_workspace_observation_service.mjs`
  passed 71/71.
- Artifact-row regression proof:
  `npm run test:runtime:node` passed 178/178.
- Artifact-row build proof:
  `npm run build` passed with existing chunk-size warnings only.
- Artifact-row diff hygiene:
  `git diff --check` passed.
- S-006 first implementation slice:
  added `src/features/sidecar/ai-workspace-artifact-inspection.ts` as a pure
  generic artifact viewer projection over observation-classified artifacts and
  file content. It supports proof manifests, proof artifacts, event JSONL,
  test-run summaries, system ledgers, and system catalogs without odd_glc or
  odd_sdlc-specific parsing.
- Wired `SurfaceInspector` to render a compact `.ai-workspace` artifact
  inspection panel above the raw document when the active Project observation
  inventory classifies the open file.
- Added event-kind summaries for JSONL logs, selected top-level facts for JSON
  proof/test/system artifacts, parse diagnostics, top-level key summaries, and
  explicit raw/non-authoritative fallback for unsupported artifact kinds.
- Added `runtime/tests/test_ai_workspace_artifact_inspection.mjs`.
- Browser smoke caught and fixed an S-005/S-006 integration defect:
  artifact rows initially selected the surface but did not open a viewer tab,
  and the first fix placed the handler outside `SelectionFlyout` scope. The
  final handler now lives inside `SelectionFlyout`, calls the existing
  `onSurfaceSelect` path-history flow, and dispatches `viewer/open` for the
  artifact row only.
- Browser smoke over live `odd_glc`:
  registered and activated `/Users/jim/src/apps/odd_glc`; the Project Browser
  rendered the `.ai-workspace` summary with 8 present features, 1059 artifacts,
  and 16 bounded artifact rows across visible feature groups.
- Browser proof-artifact smoke:
  opened a `proof_artifact` row for
  `odd-glc-software-build-overlay-live-proof.json`; the generic inspection
  panel rendered `SCN-GLC-HELLO-WORLD-CLI-BASIC`,
  `graph-function://odd_glc/software-build/bootstrap-worksite`, graph ref,
  overlay ref, startup config ref, runtime binding path, event-log sha, duration,
  and artifact-count facts above the raw JSON document.
- S-006 focused proof:
  `node --test runtime/tests/test_ai_workspace_artifact_inspection.mjs runtime/tests/test_ai_workspace_browser_projection.mjs runtime/tests/test_sidecar_msg_replay.mjs runtime/tests/test_ai_workspace_observation_service.mjs`
  passed 75/75.
- S-006 regression proof:
  `npm run test:runtime:node` passed 182/182.
- S-006 build proof:
  `npm run build` passed with existing chunk-size warnings only.
- S-006 diff hygiene:
  `git diff --check` passed.
- Design Module and UX Method self-review slice:
  reviewed the T-031 implementation against
  `DESIGN_MODULE_METHOD.md`, `UX_METHOD.md`, and
  `AI_WORKSPACE_OBSERVABILITY_MIGRATION.md`.
- Added the design-method self-review, independent carrier set, structural
  carrier diagram, UX TEA mapping, lifecycle confirmation, and current
  non-closure gaps to `AI_WORKSPACE_OBSERVABILITY_MIGRATION.md`.
- Fixed a UX ingress defect by extracting
  `src/features/sidecar/ai-workspace-observation-validation.ts`; the browser
  now validates the observation API payload before it can enter reducer-owned
  state.
- Fixed a browser-projection risk by bounding generic JSON artifact inspection
  by byte length and JSONL inspection by non-empty line count, with explicit
  diagnostics when inspection is truncated.
- Fixed a compact Project Browser visibility gap by rendering the count of
  hidden `.ai-workspace` artifact feature groups instead of silently omitting
  groups beyond the bounded display.
- Added
  `runtime/tests/test_ai_workspace_observation_validation.mjs` and expanded
  `runtime/tests/test_ai_workspace_artifact_inspection.mjs` for the new
  bounded/admission behavior.
- Self-review focused proof:
  `node --test runtime/tests/test_ai_workspace_observation_validation.mjs runtime/tests/test_ai_workspace_artifact_inspection.mjs runtime/tests/test_ai_workspace_browser_projection.mjs runtime/tests/test_sidecar_msg_replay.mjs runtime/tests/test_ai_workspace_observation_service.mjs`
  passed 81/81.
- Self-review regression proof:
  `npm run test:runtime:node` passed 188/188.
- Self-review build proof:
  `npm run build` passed with existing chunk-size warnings only.
- Self-review diff hygiene:
  `git diff --check` passed.
- Self-review API smoke:
  `GET /api/ai-workspace/observation` for `/Users/jim/src/apps/odd_glc`
  returned 8 present feature families, 1059 artifacts, 20 proof artifacts, 196
  test-run summaries, and generic capabilities including proof, test-run,
  event, and domain-overlay inspection.
- Self-review browser smoke:
  selected the Projects rail for active `/Users/jim/src/apps/odd_glc`; the
  `.ai-workspace` summary rendered 16 visible artifact rows and `+2 feature
  groups`, then a `proof_artifact` row opened the generic artifact inspection
  panel showing `SCN-GLC-HELLO-WORLD` evidence and
  `graph-function://odd_glc/software-build/bootstrap-worksite`.
- Closure status remains active:
  S-006 is still in progress because linked proof-to-event traversal is not
  implemented; S-007 through S-010 remain pending.

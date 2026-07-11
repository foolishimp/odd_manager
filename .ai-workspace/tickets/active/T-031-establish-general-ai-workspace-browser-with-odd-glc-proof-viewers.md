---
id: T-031
title: Establish a general .ai-workspace browser with odd_glc proof viewers
type: feature
ticket_category: observation_contract
status: active
review_status: ready_for_operator_review
proof_status: verified
goal: establish-current-abg-system-observation-contract
build_tenant: react_vite
owner: codex
change_intent: >-
  Turn what was learned from odd_sdlc observation into a general-purpose
  .ai-workspace browser whose capabilities are enabled by viewers over
  discovered artifacts, with odd_glc Hello World proof artifacts as the first
  non-odd_sdlc proof target.
change_class: design_reframe
re_entry_point: design
affected_boundary: >-
  specification product, goals, domain model, projection/navigation/lens
  requirements; AI Workspace observation and Sidecar design; Project identity,
  observation topology, AI Workspace inventory, traversal, AbgRunObservation,
  Sidecar reducer/UI, runtime targeting, and runtime/browser proof lanes
priority: high
created_at: 2026-07-01
updated_at: 2026-07-12T00:03:57+10:00
governance_scope: STDO Method, ODD Method, STDO-UX Method, current GTL/ABG observation
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
  clone; its data-mapper run artifacts prove that the generic observation lane
  can expose current GTL/ABG system evidence and product overlay meaning
  without a domain adapter.
final_solution_invariant: >-
  The final solution must work equally well for odd_glc, ordinary Projects,
  and future odd_* products because capabilities are specialized by published
  identity, .ai-workspace features, and artifact shapes, not by hardcoded
  project-line identity. New widgets may be added as new feature families
  appear, provided each declares its inputs, artifact kinds, source refs, and
  incomplete/unsupported behavior.
observation_principle: >-
  A Project becomes observable through project-owned .ai-workspace surfaces.
  Those surfaces may be complete, partial, or absent depending on the state of
  the Project. odd_manager must compose a coherent project view from whatever
  observation features are present rather than requiring every Project to expose
  a full domain pack, full ABG runtime ledger, or full proof archive.
current_state: >-
  The manager discovers Project-owned run topology, publishes a bounded generic
  AI Workspace inventory, and exposes Run Inspector sections over admitted
  odd_glc data-mapper runs. Large event carriers are indexed without whole-file
  browser parsing and their SHA-256 digest is verified against proof truth. The
  ABG Catalog projects registry admission/rejection and construction-action
  catalog events without importing observed runtime code. The odd_sdlc Process
  Navigator carrier is retired. The common loader admits exact registered
  Project roots from `?project=` and synchronizes active Project context back
  to the URL.
closure_law: >-
  Close only when the manager has a general .ai-workspace browser with
  capability viewers selected from discovered artifacts, and odd_glc data-mapper
  evidence is observable through that generic path. Do not close by creating an
  odd_glc replacement for odd_sdlc, relabeling odd_sdlc projection code, or
  requiring a workspace-local odd_sdlc runtime install.
proof_surface:
  - build_tenants/common/design/AI_WORKSPACE_OBSERVABILITY_MIGRATION.md
  - build_tenants/react_vite/src/contracts/ai-workspace-observation.ts
  - build_tenants/react_vite/src/contracts/abg-run-observation.ts
  - build_tenants/react_vite/src/contracts/traversal.ts
  - build_tenants/react_vite/src/server/ai-workspace-observation-service.mjs
  - build_tenants/react_vite/src/server/project-observation-topology-service.mjs
  - build_tenants/react_vite/src/server/abg-run-observation-service.mjs
  - build_tenants/react_vite/src/server/traversal-projection-service.mjs
  - build_tenants/react_vite/src/server/workspace-identity-service.mjs
  - build_tenants/react_vite/src/server/index.mjs
  - build_tenants/react_vite/src/app/App.tsx
  - build_tenants/react_vite/src/lib/projectDeepLink.ts
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/runtime/tests/test_ai_workspace_observation_service.mjs
  - build_tenants/react_vite/runtime/tests/test_abg_run_observation.mjs
  - build_tenants/react_vite/runtime/tests/test_abg_run_observation_validation.mjs
  - build_tenants/react_vite/runtime/tests/test_project_deep_link.mjs
  - build_tenants/react_vite/runtime/tests/test_traversal_projection.mjs
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts
  - /Users/jim/src/apps/odd_glc/build_tenants/odd_glc/typescript/test_runs/glc_software_build_overlay_live/data-mapper-full/
acceptance_criteria:
  - odd_manager defines and tests a feature-detected .ai-workspace project observability model, with explicit present/missing/incomplete states for context, tickets, comments, runtime, events, ledgers, catalogs, proof manifests, test runs, and domain overlays.
  - The same feature detector, artifact classifier, and viewer routing mechanism serves odd_glc, unsupported Projects, and future odd_* products.
  - The browser exposes .ai-workspace as a first-class Project observation root, not just as raw filesystem folders.
  - Artifact viewers are capability-enabled from detected files and directories, so a Project can gain ticket, comment, event-log, runtime, proof-manifest, test-run, catalog, or domain-overlay views independently.
  - New .ai-workspace feature families can add widgets without forking the core Project observation model.
  - Project discovery and registration keep odd_glc selectable and browseable without requiring odd_glc to become a manager-specific replacement for odd_sdlc.
  - The maintained Project registry can include odd_glc without requiring .genesis/odd_sdlc or .ai-workspace/runtime/odd_sdlc-* surfaces in the odd_manager workspace.
  - Selecting odd_glc keeps generic Project/file browsing available and exposes odd_glc proof files as ordinary surfaces.
  - Process Navigator or its successor is fed by the generic .ai-workspace artifact inventory before any domain-specific adapter is applied.
  - A generic versioned GTL/ABG viewer reads odd_glc live proof, traversal, event, assurance, transcript, and artifact carriers.
  - The projection surfaces registry entries, node-type entries, graph-function selections, graph-call openings, vector closures, payload/evidence facts, event-log digests, selected graph-function refs, and convergence state from ABG-emitted truth.
  - odd_glc lifecycle overlay labels and software-build overlay refs appear as domain/product interpretation, while ABG remains the owner of runtime events, selection, graph-call opening, traversal, evidence admission, folds, residuals, continuation, and re-entry.
  - Missing or incompatible odd_glc proof surfaces render an explicit unsupported/incomplete state rather than falling back to odd_sdlc assumptions.
  - Tests cover odd_glc supported projection, ordinary unsupported Project selection, Project/run stale-result guards, large event-carrier handling, runtime targeting, and responsive browser behavior.
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

## Operator UX Refinement - 2026-07-11

The AI Workspace inventory remains valid observation truth, but its first
viewer placement duplicated weaker ticket and comment navigation. The Sidecar
already preserves lane/author hierarchy, name/time sorting, refresh, and source
selection through one shared folder navigator.

ADR-002 therefore fixes the shell boundary without repricing requirements:

- the left activity bar selects collection navigators;
- Tickets, Comments, Specification, and Build Tenants are peer providers;
- user favorites contain only non-canonical Project paths;
- provider selections open canonical tabs in the right viewer workspace;
- AI Workspace reports feature availability and routes Tickets/Comments to
  their providers instead of rendering flat rival artifact lists.

This is a `design_reframe` within T-031. The observation service, feature
classification, source refs, and Run Inspector truth remain unchanged.

## Initial Reality - 2026-07-01

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
2. Manager-owned, versioned GTL/ABG run projection:
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
| S-005 Browser UI | P1 | S-003, S-004 | completed | Add `.ai-workspace` feature summary, artifact groups, capability indicators, and raw/specialized viewer entry points. | The Project Browser works for odd_glc, odd_manager, and unsupported Projects through the same mechanism. |
| S-006 Generic proof/event/test viewers | P1 | S-004, S-005 | completed | Implement bounded proof, event, test, and artifact inspection. | Large JSONL carriers remain indexed and source-linked without whole-file browser parsing. |
| S-007 Generic run viewer | P1 | S-004, S-006 | completed | Project current GTL/ABG run, graph, function, asset, event, stage, transcript, and assurance facts with source refs. | Live odd_glc data-mapper truth renders without a domain query adapter. |
| S-008 Overlay layering | P2 | S-006, S-007 | completed | Preserve graph, overlay, startup, scenario, and product refs above generic runtime truth without basename classification. | Product refs enrich admitted core truth and false `software-build` path overlays are absent. |
| S-009 Process surface recovery | P2 | S-005, S-007, S-008 | completed | Retire Process Navigator and recover its generic operational meanings through Run Inspector plus lazy Traversal. | Live reference runs expose all recovered sections, run selection, stale guards, and runtime targeting. |
| S-010 Cleanup and closure | P3 | S-005 through S-009 | completed | Remove dead carriers/CSS, repair authority, make tests hermetic, and verify runtime/build/type/browser lanes. | Non-closure conditions are false; operator review remains the final ticket transition gate. |
| S-011 ABG catalog projection | P2 | S-007, S-009 | completed | Add a bounded Run Inspector Catalog over admitted/rejected runtime registry events and construction-action catalog refs. | Live odd_glc truth renders 48 unique entries from 192 admissions with kind/search filtering and source-event lineage; fixtures prove rejection, variant, and construction-catalog handling. |
| S-012 Registered Project deep links | P2 | S-005, S-009 | completed | Admit `?project=<absolute-local-root>` through the maintained Project registry, open a non-empty landing surface, and synchronize selected Project context back to the URL. | A link to `/Users/jim/src/apps/odd_glc` overrides prior context and opens AI Workspace; `view=run-inspector` opens the data-mapper run directly; unknown paths are not registered. |

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

Extension 2026-07-10 (owner-declared): the primary reference view is now the
odd_glc data-mapper run — `SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT` on ABIogenesis
4.6.0-rc.1, run root
`odd_glc/build_tenants/odd_glc/typescript/test_runs/glc_software_build_overlay_live/data-mapper-full/<TIMESTAMP>Z_pid<PID>/`.
It is richer than the Hello World ladder (8 typed CDME requirements,
requirement-lineage canary, depth-proof map, mutation outcomes, 28 vectors
with retries, ~124 MB event ledger) and runs on the current substrate. New
runs appear as timestamped siblings; the Hello World ladder remains a valid
secondary fixture.

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
- Closure status at that review remained active:
  S-006 is still in progress because linked proof-to-event traversal is not
  implemented; S-007 through S-010 remain pending.

2026-07-10 (carrier: SPRINT-2026-07-10-abg46-observation-reprice; operator
rulings D1 abgSystem cut with the lane, D2 odd_world_model arms retired,
D3 registry purged to minimal set):

Retirement wave (W0) — sections pruned, ~12,600 lines net:
- DELETED `src/server/sidecar-process-projection.mjs` (4,519 lines): the
  odd_sdlc-privileged lane — `odd_sdlc.query-domain`/catalog contracts,
  `odd-sdlc-ts` CLI shell-outs, TS install validation, operator-runs and
  traced-evidence readers, workspaceRun family, liveAnalysis family
  (hello_world/data_mapper profiles), TS-event process records/maps, and
  the abgSystem thread (D1: cut, rebuilt properly on the generic lane).
- DELETED `src/contracts/process.ts` (2,012 lines): SidecarProcess*,
  SidecarSdlc*, SidecarLiveAnalysis*, Traced*, SidecarAbg* families and
  guards.
- DELETED tests `test_sidecar_process_projection.mjs` (1,382),
  `test_sidecar_process_navigator_msg_replay.mjs` (530), e2e
  `odd-manager-process-navigator.spec.ts` (178).
- DELETED empty feature dirs `world-model/`, `graphs/`, `requirements/`,
  `process/`.
- PRUNED `SidecarPanel.tsx` 7,898→4,461: Process Navigator component tree
  (~3,437 lines), its rail command, viewer branch, validator, batch fetch.
- PRUNED `sidecar-state.ts`: `process` selection kind, `process/*` Msg
  family, reducer cases, graph-mode and live-collapse UI cells.
- PRUNED `src/server/index.mjs`: `/api/sidecar/process` route; odd_sdlc AND
  odd_world_model arms out of identity/profiling mechanisms (mechanisms
  kept); `detectOddType` returns 'unknown'; `OddType` collapsed to
  `'unknown' | string`; `active_domain_pack` to `string | null`.
- PRUNED 128 dead `.sidecar-process-*` CSS rules; msg-replay and smoke
  lanes trimmed (harnesses kept); MCP fixture odd_type de-sdlc'd.
- Registry: 10 entries deregistered (7 dead roots, 3 stale odd_sdlc-era);
  remaining: odd_manager, abiogenesis, odd_glc, the data-mapper instance.
- Proofs: build green; tsc zero new errors vs HEAD; runtime 166/166; e2e
  27 passed / 4 failed, all 4 baselined pre-existing at HEAD (documented
  in the sprint); live: retired route 404, shell clean over the instance.

Restore wave — successor views on the generic lane:
- W7 Traversal View (S-009 successor): `contracts/traversal.ts`,
  `server/traversal-projection-service.mjs` (bounded summary from the run
  proof, ~19 KB to client; lazy per-vector detail from artifact JSONs;
  never reads events.jsonl; per-runRoot+mtime cache), routes
  `/api/ai-workspace/traversal[/vector]`, runtime-validated ingress,
  `traversal/*` Msg family with FIFO detail cache (8), TraversalInspector
  (vector chain with frame markers, attempts, lineage strip, detail pane).
  Proven live over the data-mapper run: ready, 28 vectors, 31 frames,
  current v27, substrate 4.6.0-rc.1, 34 unknown kinds surfaced. Runtime
  183/183.
- W8 DrillView + Tickets Board: `DrillView.tsx` shared master-detail
  primitive (horizontal lanes of cards, detail below; declared future
  drills: overlays, graph functions, graph types from admitted run
  projections); first instantiation Tickets Board over the existing
  TicketRecord surface (lanes active/backlog/completed, STDO frontmatter
  grid + markdown body detail). Proven live over odd_manager: 106 cards.
  Runtime 189/189.
- W9 AI Workspace tab: the S-005 observation summary promoted from the
  Project Browser flyout to a first-class viewer tab (rail symbol A,
  expanded artifact groups); flyout reduced to an "open as tab" line only
  (owner direction); stale-root guarded, honest empty states. Proven live
  over the reference instance (3/11 features, 67 artifacts). Runtime
  193/193, build green.

Residual pressure (open, carried by the sprint):
- events feature fails closed on the 124 MB ledger (`jsonl_too_large`) —
  W4 streaming/summary-first ingestion with eventLogSha256 verification.
- run-root typed assets (proof JSON, sandbox-identity,
  test-execution-result, depth-proof-map, mutation-outcomes) not yet
  classified by the observation scanner (W3); `.abiogenesis/` substrate
  version detection absent (W2).
- tickets/comments rails render raw ENOENT over workspaces without those
  dirs (W5); observation endpoint requires explicit `?workspaceRoot=`.
- e2e suite mutates the live project registry and its fixture root still
  points at `ai_sdlc_examples/.../data_mapper.test35`; move to the odd_glc
  reference run and isolate the registry.
- spec surfaces still name "ABG 4.2" (W1 requirement_reprice pending).

2026-07-10 recovery and closure implementation:

- Repriced product, domain, projection, navigation, process-lens, and Sidecar
  design authority to the versioned Project/run topology and generic Run
  Inspector. `ODD_MANAGER_DASHBOARD.md` is explicit superseded history.
- Added published workspace identity, bounded Project run discovery,
  `AbgRunObservation`, strict client admission, and Project/run stale-result
  guards.
- Recovered the deleted operational meanings as Overview, Graph, Traversal,
  Functions, Catalog, Assets, Diagnostics, Assurance, Events, Stages,
  Transcripts, and Artifacts, with run selection and refresh.
- Restored runtime operations by allowing a Project-owned shell to target an
  admitted run workspace without changing Project identity.
- Corrected large-ledger handling: JSONL inventory remains present and bounded;
  Run Inspector verifies the full event carrier incrementally against the
  proof-declared SHA-256 digest and publishes verified/mismatch state.
- Removed false path-label domain overlays, scanner caps that hid current run
  assets, stale run state across Project switches, non-hermetic RC1 tests, and
  approximately 1,200 lines of unused retired live-view CSS.
- Superseded B-079 because its odd_sdlc-specific target is no longer lawful.
- Added focused runtime, Msg-replay, and Playwright proof over live odd_glc
  data-mapper runs, including narrow-viewport containment.

Final proof before operator review (2026-07-11):

- Live Project observation selected the latest converged data-mapper run from
  3 admitted run carriers and reported abiogenesis 4.6.0-rc.2, 4,840 events
  across 40 kinds, 28 closed vectors, 46 assets, 28 stages, 27 transcripts,
  8/8 requirements reached, 22 passing tests, 48 depth-proof rows, and 16/16
  mutation kills.
- Its ABG Catalog reports 48 unique runtime entries from 192 admission events:
  47 node types and one graph function. Every live entry preserves its four
  source event indexes; the selected run reports no rejected, unparsed, or
  truncated catalog records.
- `?project=/Users/jim/src/apps/odd_glc` now activates the already registered
  odd_glc Project before Sidecar mounts. Relative, duplicate, and unregistered
  paths fail visibly and do not mutate the Project collection; active Project
  changes replace the URL parameter while preserving unrelated URL state. A
  Project-only link opens AI Workspace instead of an empty canvas, while
  `view=run-inspector` opens the latest admitted data-mapper run directly.
- The selected 133,430,175-byte run ledger verified against its declared
  SHA-256. The unrelated Project ledger is visible as `not_declared`, not
  falsely compared against the selected run proof.
- `npm run test:runtime:node`: 215/215 passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with the existing Vite large-chunk warning.
- `npx playwright test`: 36/36 passed against isolated manager state.
- `git diff --check`: passed.

- The operator Project registry remained byte-identical to its pre-browser-run
  snapshot, and test-created shell sessions were removed without touching the
  two pre-existing operator sessions.
- No lint dependency or lint command exists in this pre-release tenant. That
  tooling gap is accepted debt for this wave; TypeScript is the declared
  static gate, and lint introduction is a separate tooling re-entry.

Post-review navigation compression (2026-07-11):

- Ratified common ADR-002: the left activity bar selects navigators and the
  right viewer workspace owns tabs; tabs may activate providers or open other
  tabs without creating rival collection navigation.
- Promoted Specification and Build Tenants from default favorites to peer
  providers beside Tickets and Comments. Existing canonical-root favorites are
  removed during profile admission; nested and unrelated favorites remain.
- AI Workspace retains feature inventory truth but routes Tickets and Comments
  to their canonical navigators and omits their flat artifact groups.
- Added desktop/mobile browser proof for `T/C/S/B`, hierarchy, name/time sort,
  provider-to-tab behavior, AI Workspace handoff, and compact layout overlap.
- Final lanes: runtime/replay 263/263, TypeScript passed, production build
  passed, Playwright 44/44 in 4.4 minutes, and `git diff --check` passed.
- Review record:
  `.ai-workspace/comments/codex/20260711T193710Z_REVIEW_sidecar-navigation-and-ai-workspace-compression.md`.

## Prime Active Role 2026-07-11

T-031 is the one active owner for observation, Run Inspector, AI Workspace,
and the current navigator/viewer UX review. It subsumes the current meaning of
the retired B-076, B-078, T-027, and T-028 carriers without restoring the old
Project selector or odd_sdlc Process Navigator. The browser-native PDF adapter
is accepted as current DocumentViewer truth; richer PDF page controls require
fresh intake.

The remaining review question is product/UX fitness of the integrated
observation and navigation experience, not missing implementation proof.

## Prime-Set First-Use UX Iteration 2026-07-11

The integrated review found three local compression defects and corrected them
without introducing another navigator, viewer, or state owner:

- the Project Workbench identity strip no longer repeats capability
  availability as a bare `READY`; admitted capability contributions remain the
  one availability truth and are now projected in the phase controls;
- a fresh or reset Sidecar profile starts with the terminal dock collapsed,
  while an explicitly saved expanded profile remains durable and terminal
  commands still open the dock;
- Active, Backlog, and Completed navigator counts derive from the canonical
  `TicketRecord.lane` collection before filesystem folders are expanded;
  expansion still uses the shared folder navigator and ticket viewer.

The Sidecar design now also states the current deep-link contract explicitly:
a Project-only link opens Project Workbench, while `view=ai-workspace`,
`view=run-inspector`, and `view=ticket-board` select supporting carriers. This
supersedes the historical Project-only AI Workspace behavior recorded in the
earlier proof narrative.

Final proof for this iteration:

- `npm run test:runtime:node`: 266 tests, 262 passed, 4 environment-dependent
  screen tests skipped, 0 failed;
- `npx tsc --noEmit`: passed;
- `npm run build`: passed with the existing Vite large-chunk warning;
- `npx playwright test`: 44/44 passed in 4.4 minutes;
- `git diff --check`: passed.

## Integrated Workbench Availability Compression 2026-07-11

The next UX review removed the separate six-row capability-status sidebar from
Project Workbench. Review, Tune, Build, and Assure now project their admitted
capability availability directly in the phase controls through the shared
availability-state renderer. The active capability still owns the full reason
and source references, and Run Observation still owns its supporting status.

The compact phase skin renders contract `ready` as `available` so capability
admission is not represented as phase or Project completion. Unavailable phase
states retain the exact source reason as a tooltip. The active workspace now
uses the full Workbench width, and all four phase statuses remain contained in
the first 390px mobile viewport. No observation, navigator, reducer, command,
or carrier ownership changed.

Final proof for this iteration:

- focused host boundary: 10/10 passed;
- focused deep-link/mobile browser proof: 2/2 passed;
- focused failed-workflow rerun after removing duplicate child test hooks: 2/2
  passed;
- `npm run test:runtime:node`: 266/266 passed;
- `npx tsc --noEmit`: passed;
- `npm run build`: passed with the existing Vite large-chunk warning;
- `npx playwright test`: 44/44 passed in 4.5 minutes;
- live desktop/mobile review: no overflow or console errors;
- `git diff --check`: passed.

Review record:
`.ai-workspace/comments/codex/20260711T124719Z_REVIEW_project-workbench-phase-availability-compression.md`.

## Portfolio Attention Navigation Iteration 2026-07-11

The widened Review workspace exposed one remaining navigation ambiguity: every
source-attributed attention item used the generic action `Open source`, even
though the admitted command routed revision/specification pressure to Tune,
build pressure to Build, and assurance/evidence pressure to Assure.

Build Portfolio now projects `Open Tune`, `Open Build`, or `Open Assure` from
the same total attention-target selector used by the reducer to populate
`targetCapabilityId`. Unknown future source kinds route to Assure, where they
remain visible without creating a positive closure claim. The view has no
second route table.

Desktop and 390px review confirm all three actions fit their rows and route to
the named phase without console errors. Final proof: focused host/selector
11/11; focused browser 1/1; runtime/replay 267/267; TypeScript passed;
production build passed with the existing chunk warning; Playwright 45/45 in
4.9 minutes; and `git diff --check` passed.

Review record:
`.ai-workspace/comments/codex/20260711T130156Z_REVIEW_portfolio-attention-target-compression.md`.

## Tune Attention Source Preservation 2026-07-12

`Open Tune` previously selected the correct capability but dropped the
source-attributed attention reference at the host boundary. The host now sends
that admitted `sourceRef` through the existing `proposal/context-attached` Msg
after the target Project Context is admitted. Specification Proposal applies
the same bounded, deduplicated attachment law used by manual Attach and renders
the source in the removable context list.

Project changes now clear prompt/refinement drafts, the attachment draft, and
attached refs before loading the new Project's proposal history. Same-Project
revision refresh retains explicit context. This prevents cross-Project
candidate-state leakage while preserving deliberate work through revision
refresh.

Final proof: focused proposal replay 6/6; focused Tune/Build/Assure browser
route 1/1; runtime/replay 268/268; TypeScript passed; production build passed
with the existing chunk warning; Playwright 45/45 in 4.6 minutes; desktop and
390px live Tune review showed the exact `git://` source with no overflow or
console errors; and `git diff --check` passed.

Review record:
`.ai-workspace/comments/codex/20260711T140357Z_REVIEW_review-to-tune-attention-context-handoff.md`.

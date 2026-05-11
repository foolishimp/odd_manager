---
id: B-074
title: Induct TypeScript Process Navigator into Sidecar object viewer
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Move the Process Navigator into the new Sidecar UX as an object-viewer workspace surface selected from the right rail, backed only by the odd_sdlc TypeScript graph-function event/query format.
change_class: product_reprice
re_entry_point: product
affected_boundary: specification/PRODUCT.md, specification/requirements/10-entry-lenses-and-delivery-workspaces.md, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/process/ProcessWorkspace.tsx, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/server/index.mjs, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-04-29
build_tenant: react_vite
dependencies:
  - B-065 completed
  - B-073 completed
  - T-002 legacy_completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar object viewer and right-rail workspace selection
intake_source: Operator direction to induct Process Navigator into the new UX, place it in the object viewer workspace, select it from the right toolbar alongside shell workspace controls, keep only the Process Navigator with its three views, support only the TypeScript odd_sdlc graph-function event format, and preserve non-ODD Project registration for generic file/code inspection and future bootstrap.
target_truth: Sidecar presents a compact Process Navigator surface inside the object viewer workspace. It is selected from the right rail, uses the same split/tab workspace grammar as other object-viewer panes, exposes exactly three process views, and reads only the TypeScript odd_sdlc/ABG event and query surfaces.
superseded_truth: Process View and Kanban View exist as broader standalone page surfaces over the older manager world projection, with Python-era SDLC assumptions and expanded process saved-view/filter sets.
source_evidence:
  - /Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test56.ts
  - /Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test56.ts/.ai-workspace/events/events.jsonl
  - /Users/jim/src/apps/odd_sdlc/build_tenants/typescript
  - /Users/jim/src/apps/odd_sdlc/build_tenants/typescript/code/src/projection/query_domain.ts
  - /Users/jim/src/apps/odd_sdlc/build_tenants/typescript/design/ODD_SDLC_TYPESCRIPT_GAP_TRIAGE_HOMEOSTATIC_LOOP.md
closure_law: This ticket closes only when product/design truth reprices Process Navigator into Sidecar, implementation provides a right-rail selectable Process Navigator object-viewer surface, the old Python SDLC process format is not accepted by the new surface, and tests prove the three-view TS-only navigator against the data_mapper.test56.ts event/query shape.
evaluation_criteria:
  - `PRODUCT.md` records that the live Sidecar process surface is TS-only and object-viewer based during the forward-only pre-release line
  - process-entry requirements are updated so legacy standalone Process/Kanban page assumptions do not outrank the Sidecar process surface
  - Sidecar design records a right-rail `Process Navigator` command and object-viewer workspace carrier
  - the right rail exposes `Process Navigator` as a compact command near the shell workspace command, with accessible label and sweep-out detail
  - selecting `Process Navigator` opens or focuses an object-viewer pane rather than opening a separate top-level page
  - the Process Navigator exposes exactly three operator views: `Active Work`, `Blocked / Waiting`, and `Ready for Handoff`
  - legacy extra process saved views such as `Observed SDLC Surfaces`, `Recent Failures`, `Recent Activity`, and `Tests / Qualification` do not appear in the Sidecar Process Navigator
  - the process data adapter reads TypeScript odd_sdlc/ABG event records including `graph_call_opened`, `frame_opened`, `vector_traversal_planned`, `vector_evaluated`, `vector_closed`, and `assessed`
  - the process data adapter uses the TypeScript query-domain contract `odd_sdlc.query-domain` `ts-v1`
  - Python SDLC event/projection shapes are rejected or ignored with an explicit unsupported-format state
  - non-ODD or unknown-identity Projects remain admissible for generic Sidecar browsing while the Process Navigator shows unsupported-contract state
  - data from `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test56.ts` renders as the primary fixture/proof
  - UI state for selected process view, selected graph call/frame/vector, and selected pane remains reducer-owned
  - no traversal, continuation, or gap-selection authority is implemented in the manager; the manager only projects ABG/odd_sdlc TS truth
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - specification/PRODUCT.md
  - specification/requirements/10-entry-lenses-and-delivery-workspaces.md
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/process/ProcessWorkspace.tsx
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/server/index.mjs
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - the old standalone Process View is merely restyled without becoming a Sidecar object-viewer surface
  - Process Navigator remains a second page competing with Sidecar object panes
  - Python SDLC projection or event compatibility remains an implicit fallback
  - more than three process views are exposed in the new Sidecar Process Navigator
  - manager code chooses traversal, continuation, next edge, or gap closure instead of projecting TS runtime truth
  - the right rail grows horizontal labels or breaks the compact rail grammar established by B-065
---

## SPEC_METHOD Triage

This is a product reprice.

The product still needs a process-first lens, but the delivery surface changes.
The current truth is no longer a broad standalone Process/Kanban page over
Python-era SDLC projections. The live direction is a Sidecar object-viewer
surface backed by the TypeScript odd_sdlc tenant and ABG event truth.

Lawful re-entry point: Product.

## STDO-UX Execution Contract

The Process Navigator is a view over TS runtime/query truth, not a runtime
driver.

- `State`: selected process view, selected process object, selected graph call,
  selected frame/vector, and object-viewer pane identity.
- `Msg`: select process navigator, select process view, select graph call,
  select frame/vector, open/focus object-viewer pane.
- `Update`: pure reducer over Sidecar state.
- `Cmd`: read TS process projection from the managed Project only.
- `View`: compact right-rail command plus object-viewer pane rendering.

No UI handler may write ABG events, select traversal, close gaps, or infer
continuation authority.

## Target Process Views

The Sidecar Process Navigator exposes exactly three operator views:

- `Active Work`
- `Blocked / Waiting`
- `Ready for Handoff`

These replace the broader legacy saved-view set from `T-002`.

## TypeScript Event Boundary

The supported evidence boundary is the TypeScript odd_sdlc tenant:

- tenant source: `/Users/jim/src/apps/odd_sdlc/build_tenants/typescript`
- fixture run: `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test56.ts`
- event log: `.ai-workspace/events/events.jsonl`
- query contract: `odd_sdlc.query-domain` `ts-v1`

The first event families to project are:

- `graph_call_opened`
- `frame_opened`
- `vector_traversal_planned`
- `vector_evaluated`
- `vector_closed`
- `assessed`

## Implementation Plan

1. Update product/requirements/design to state the Sidecar TS-only Process
   Navigator target.
2. Add a typed TS process projection adapter for the `data_mapper.test56.ts`
   event/query shape.
3. Add Sidecar state/messages for Process Navigator selection and object-viewer
   pane focus.
4. Add the right-rail Process Navigator command beside the workspace chrome
   commands.
5. Render the three-view Process Navigator in the object viewer workspace using
   the existing Sidecar tab/split grammar.
6. Retire or isolate legacy standalone Process/Kanban assumptions so they do
   not drive the Sidecar path.
7. Add runtime replay tests and browser tests proving TS-only ingestion,
   three-view rendering, right-rail selection, and object-viewer placement.

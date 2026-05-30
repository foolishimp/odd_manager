---
id: T-030
title: Delete legacy screens and make Sidecar the only UX_METHOD surface truth
type: chore
ticket_category: tech_debt_cleanup
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove the pre-Sidecar workspace-route screens and leftover reference surfaces now that Sidecar is feature-rich enough to be the single STDO-UX-governed operator workbench.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/routes/WorkspaceRoute.tsx, build_tenants/react_vite/src/features/{home,runtime,builder,process,requirements,oddboard,oddterm,graphs,world-model,inspector}, build_tenants/react_vite/src/lib/presentation.ts, build_tenants/react_vite/src/lib/types.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests, build_tenants/react_vite/tests/e2e
priority: high
triaged_at: 2026-05-30
created_at: 2026-05-30
updated_at: 2026-05-30
build_tenant: react_vite
dependencies:
  - last-legacy-screens tag a04e309cbcce11f3aac7be2d80099f3358440e8f
  - T-029 superseded
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar workbench as the only workspace-route operator surface
intake_source: Operator direction on 2026-05-30 after checkpoint tag `last-legacy-screens`: old screens were kept only as reference; Sidecar is now feature-rich enough to delete the legacy screens and make the Sidecar UX method implementation the only surface truth.
target_truth: The React tenant has one workspace-route operator workbench: Sidecar. Legacy route screens and ambient widgets are no longer compiled, routed, hidden, or retained as reference code in the live source tree. Historical reference remains available only through the `last-legacy-screens` tag.
superseded_truth: Home, Requirements, Process, Runtime, Builder, Graphs, World Model, Inspector, OddBoard, and OddTerm legacy screens remain in the live source tree beside Sidecar as reference or fallback surfaces.
closure_law: This ticket closes only when legacy screens are deleted from the live source tree, route and navigation truth cannot select them, Sidecar design records sole surface authority, unused legacy CSS/tests/API adapters are removed or explicitly retained as shared non-screen primitives, and focused runtime plus browser proof passes.
evaluation_criteria:
  - `WorkspaceRoute` mounts Sidecar as the only workspace-route workbench
  - primary navigation no longer exposes legacy `PageId` entries for requirements, process, runtime, builder, home, graphs, world-model, inspector, oddboard, or oddterm screens
  - legacy screen modules are deleted rather than hidden with CSS or left as inactive imports
  - any retained code is renamed or relocated as a shared primitive consumed by Sidecar, with no route-level screen identity
  - ambient `OddBoardWidget` and `OddTermWorkspaceWidget` are removed as independent workspace-route widgets
  - stale ManagerWorld-driven screen projections that existed only for deleted screens are removed from FE contracts and tests
  - Sidecar remains the canonical Projects, Tickets, Comments, Process Navigator, document viewer, board/chat, and terminal session workspace
  - design module records Sidecar as the sole STDO-UX surface truth for the React tenant
  - runtime Msg-replay tests cover the surviving Sidecar reducer and do not assert legacy screen behavior
  - Playwright coverage opens the app, lands in Sidecar, and exercises process, document, Project Browser, and terminal recovery paths
  - `npm run build` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/routes/WorkspaceRoute.tsx
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/lib/types.ts
  - build_tenants/react_vite/src/server/workspace-surface-service.mjs
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - node --test runtime/tests/test_sidecar_msg_replay.mjs runtime/tests/test_workspace_surface_service.mjs
  - npm run test:runtime:node
  - npx playwright test tests/e2e/odd-manager-smoke.spec.ts -g "sidecar is the only route-level manager surface|project selection from sidecar Projects surface promotes active context|sidecar document viewer renders Mermaid, highlighted source, HTML, and PDF surfaces|sidecar terminal panes open tabs and split groups|sidecar process navigator N0 opens as a TypeScript-only object viewer tab"
non_closure_conditions:
  - legacy screens remain in the source tree as "reference" code after the deletion wave
  - route entries remain but redirect or render empty placeholders
  - CSS hides legacy widgets instead of deleting the route/component path
  - Sidecar becomes a wrapper around legacy screens rather than owning the UX method state/Msg/Update/Cmd surface
  - duplicate runtime/process/document/session truth remains available through old ManagerWorld screens
  - deletion removes a capability from Sidecar without replacing it in the Sidecar UX method surface
---

# T-030: Delete Legacy Screens And Make Sidecar UX Authority

## SPEC_METHOD Triage

First missing layer: realization.

The product and requirement direction now points at Sidecar as the live
operator workbench. The old screens were intentionally retained as reference
while Sidecar matured. That reference period ended at checkpoint tag
`last-legacy-screens`.

Lawful re-entry point: Realization.

The cleanup is deletion-first. Any capability that still matters must already
exist in Sidecar or be moved into Sidecar as a shared primitive before the old
screen is removed. The live source tree must not keep alternate route-level
truth surfaces for the same operator facts.

## STDO-UX Execution Contract

- `State`: Sidecar state remains the only product-meaningful UX state for the
  workspace workbench.
- `Msg`: new or retained operator actions must enter through Sidecar messages.
- `Update`: no legacy component-local state machine may remain as product
  behavior.
- `Cmd`: side effects stay behind the Sidecar effect membrane and typed server
  routes.
- `View`: legacy screen code is deleted; Sidecar view projections are the only
  route-level workspace workbench projections.

## Deletion Inventory

Delete or absorb:

- `src/features/home/HomePanel.tsx`
- `src/features/runtime/RuntimePanel.tsx`
- `src/features/builder/BuilderPanel.tsx`
- `src/features/process/ProcessWorkspace.tsx`
- `src/features/requirements/RequirementsWorkspace.tsx`
- `src/features/oddboard/OddBoardWidget.tsx`
- `src/features/oddterm/OddTermPanel.tsx`
- `src/features/oddterm/OddTermWorkspaceWidget.tsx`
- `src/features/graphs/GraphWorkspace.tsx`
- `src/features/world-model/WorldModelPanel.tsx`
- `src/features/inspector/InspectorPanel.tsx`

Retain only non-screen primitives that Sidecar actually imports after the
deletion. Retained primitives must not preserve an independent legacy screen
identity.

## Baseline

Historical reference is preserved by git, specifically:

- commit `a04e309cbcce11f3aac7be2d80099f3358440e8f`
- tag `last-legacy-screens`

## Closure Evidence

- `WorkspaceRoute` mounts `SidecarPanel` directly as the sole workspace-route
  workbench. It has no `selectedPage`, `ManagerWorld`, graph-selection, legacy
  panel, ambient OddBoard, or ambient OddTerm props.
- `App` owns only theme and active Project root selection. It no longer loads a
  ManagerWorld projection, dispatches legacy commands, or closes backend PTYs on
  Project root changes.
- `AppShell` renders compact Sidecar chrome only: active Project identity,
  theme controls, and one selected Sidecar affordance. No shell-owned workspace
  selector or multi-page legacy navigation remains.
- Legacy route vocabulary and ManagerWorld-driven FE contracts were removed
  from frontend types and tests. The unused `presentation.ts` route vocabulary
  module was deleted.
- Deleted route screens and ambient widgets:
  `HomePanel`, `RuntimePanel`, `BuilderPanel`, `ProcessWorkspace`,
  `RequirementsWorkspace`, `OddBoardWidget`, `OddTermPanel`,
  `OddTermWorkspaceWidget`, `GraphWorkspace`, `WorldModelPanel`,
  `InspectorPanel`, `ProjectSelector`, `FolderBrowser`, `MarkdownDocument`,
  `WidgetFrame`, `api.ts`, `graph.ts`, and `situation.ts`.
- Removed legacy server adapters that existed only for deleted screens:
  `/api/world`, `/api/commands/run`, `/api/session-service`,
  `/api/session-service/run/approve`, and `/api/session-service/run/reject`.
  `/api/surface` and `/api/surface/raw` remain as shared Sidecar document
  surface primitives. The old ManagerWorld projection-builder helpers were
  removed, and the surviving document-surface support now lives in
  `workspace-surface-service.mjs`.
- Removed deleted-screen CSS selectors for the old home summary, surface
  browser, route graph, world controls, process builder, requirements page,
  inspector, evidence, navigator widget, and legacy route layouts.
- The Sidecar design module records T-030 sole-route authority and removes the
  former `MarkdownDocument` compatibility/migration boundary. Historical
  reference remains only at `last-legacy-screens`.

## Verification

- `npm run build` passed after the final dead-code prune.
- `node --test runtime/tests/test_sidecar_msg_replay.mjs runtime/tests/test_workspace_surface_service.mjs` passed: 63 tests.
- `npm run test:runtime:node` passed after the final dead-code prune: 167 tests.
- Focused Playwright proof passed: 5 tests covering sole Sidecar route,
  Sidecar Projects context promotion, Mermaid/code/HTML/PDF document viewer,
  terminal split tabs, and TypeScript process object viewer.

---
id: B-034
title: Compress Sidecar info-browser splitter chrome
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Apply the B-033 compact density rule to the Sidecar info-browser viewer splitter so the split selector does not consume a separate visual layer above the viewer tabs.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
completed_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-033
dependencies:
  - B-033 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route info-browser canvas and viewer split selector
intake_source: Operator review of the B-033 Sidecar screen: terminal chrome is improving, but the info-browser split selector still consumes its own visible row and should be compressed like the terminal control.
target_truth: Sidecar info-browser split selection is a compact canvas-header control over the existing viewer workspace state. The viewer body starts with tabs/content rather than a separate splitter toolbar row.
superseded_truth: Sidecar info-browser renders a separate viewer toolbar row containing only the split selector before the tab strip.
closure_law: This ticket closes only when the design module defines the info-browser splitter density rule, viewer split behavior remains reducer-owned through the existing `viewer/split` message, the separate viewer-toolbar row is removed, executable assertions cover the markup/CSS invariant, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - UX_METHOD remains sole UX realization authority for this production surface
  - no new product command effects or subscriptions are introduced
  - viewer split selection still dispatches existing `viewer/split` messages
  - the split selector is rendered in compact canvas/header chrome
  - `ViewerWorkspace` no longer owns a separate `sidecar-viewer-toolbar` row
  - viewer tabs remain the first row inside the viewer workspace
  - executable assertions cover the compact splitter invariant
  - Playwright proof covers the info-browser splitter height/chrome depth
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - view-local state is introduced for viewer split or active group behavior
  - split behavior bypasses the existing Sidecar reducer message path
  - density is achieved by hiding split controls or making them inaccessible
  - browser proof does not measure actual info-browser splitter chrome
---

## SPEC_METHOD Triage

This is a design reframe over the existing Sidecar UX realization. The
product-level capability boundary remains unchanged. The request reprices where
the existing viewer split control is projected so the info-browser canvas gives
space back to the viewer tabs and content.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: existing Sidecar viewer workspace state remains authoritative for
  split, active group, and tabs
- `Msg`: existing `viewer/split` messages remain the control path
- `Update`: no reducer change is expected
- `Cmd`: no command effect is introduced for density work
- `Sub`: no external subscription is introduced
- `View`: splitter density is a pure projection over existing state

## Implementation Plan

1. Add the info-browser splitter density rule to the Sidecar design module.
2. Move the viewer split selector from a separate viewer toolbar row into the
   compact canvas header.
3. Keep the selector bound to the existing `viewer/split` message.
4. Remove or neutralize the obsolete viewer-toolbar row styling.
5. Add executable markup/CSS assertions for the compact splitter invariant.
6. Add browser proof for splitter height and viewer chrome depth.
7. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Closed under STDO-UX as a design reframe. The implementation moves existing
viewer split selection into compact canvas chrome without adding product command
effects, subscriptions, reducer changes, or view-owned semantic state.

Realization:

- `build_tenants/react_vite/design/widgets/sidecar-session-workspace.md`
  defines the B-034 info-browser splitter density rule.
- `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx` renders
  `ViewerLayoutToggle` in the Sidecar canvas header and keeps it bound to the
  existing `viewer/split` message.
- `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx` removes the
  separate `sidecar-viewer-toolbar` row from `ViewerWorkspace`.
- `build_tenants/react_vite/src/app/styles.css` makes the canvas header a
  compact title/control strip and makes the viewer workspace start directly at
  the viewer group/tab surface.
- `build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs` asserts
  the source-level invariant that splitter projection is canvas chrome, not a
  viewer-toolbar row.
- `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` asserts the
  compact splitter is visible in the canvas header, the obsolete toolbar row is
  absent, and the chrome before viewer tabs stays within budget.

Verification:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed.
- `npm run test:e2e` passed with 14 Playwright tests.

Residual:

- The top-level ODD Manager header still has remaining global density work.
  This ticket is scoped only to the info-browser splitter layer.

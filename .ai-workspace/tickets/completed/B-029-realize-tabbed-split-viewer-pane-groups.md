---
id: B-029
title: Realize tabbed split viewer pane groups
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Continue B-026 by turning the Sidecar center canvas into reducer-owned tabbed viewer groups with split pane support.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-026
dependencies:
  - B-026 active
  - B-028 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route center viewer canvas
intake_source: B-026 Option A workbench reframe requires tabbed/splittable viewer panes after the explorer provider registry exists. Current Sidecar canvas renders one selected-object inspector and has no viewer tab carrier.
target_truth: Sidecar center canvas is a typed viewer workspace. Viewer tabs and groups are reducer-owned state, tabs store object identity rather than copied product records, selection opens or activates a viewer tab, and the canvas can switch between single, vertical split, and horizontal split viewer group layouts without command effects.
superseded_truth: Sidecar center canvas renders only the current selection as one inspector, so multiple viewed objects and split viewer groups are not represented in replayable Sidecar state.
closure_law: This ticket closes only when `ViewerTab` and `ViewerGroup` carriers exist, selection opens tabs through reducer state, tab select/close/split/focus replay with no Cmd effects, rendered tabs use accessible tablist semantics, browser proof covers open/select/split/close behavior, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - `SidecarViewerWorkspace`, `SidecarViewerGroup`, and `SidecarViewerTab` exist as typed carriers
  - viewer tabs store kind and object id, not copied project/ticket/comment/session records
  - selecting a project, ticket, comment, or session opens or activates a tab in the active viewer group
  - tab select updates reducer-owned active tab and Sidecar selection
  - tab close updates reducer-owned groups and active selection deterministically
  - viewer split mode supports single, split vertical, and split horizontal
  - viewer split/focus/select/close/open messages emit no `SidecarCmd`
  - viewer tab bars expose tablist/tab semantics and close controls have accessible names
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - viewer tab state is view-local React state
  - tabs duplicate product record bodies instead of storing object identity
  - split layout exists only as CSS without reducer-owned state
  - tab selection or split emits command effects
  - closing a tab leaves selection or active group in an impossible state
  - browser proof does not exercise tab open/select/split/close
---

## SPEC_METHOD Triage

This is a substantive change because it changes the Sidecar center canvas
realization from a single selected-object projection to typed viewer tab and
split group carriers.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Intended scope: third implementation slice of B-026 only. This ticket does not
introduce terminal tab groups, layout persistence, editor framework adoption,
or a VS Code extension.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

Downstream span:

- design surface: `sidecar-session-workspace.md` B-026/B-029 rules
- code: Sidecar reducer, Sidecar canvas projection, and Sidecar CSS
- evidence: Msg-replay tests, Playwright e2e browser proof, build proof

Release scope: within the current Sidecar UX work wave. No Goals, Intent,
Product, or Requirements repricing is required because the operator control
plane purpose and Sidecar capability boundary remain stable.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: viewer tabs, groups, active group, active tab, and split mode live in
  `SidecarState.ui`
- `Msg`: viewer open, select, close, split, and focus actions are typed
  Sidecar messages
- `Update`: viewer transitions are pure reducer logic
- `Cmd`: viewer layout and tab actions emit no commands
- `Sub`: no new subscriptions are introduced in this slice
- `View`: viewer tabs and panes are pure projections over current state

Viewer tabs are identity carriers. They must not become a copied product-truth
store. Project, ticket, comment, and session details remain derived from the
admitted records already in Sidecar state.

## Implementation Plan

1. Add `SidecarViewerWorkspace`, `SidecarViewerGroup`, and `SidecarViewerTab`
   carriers.
2. Add messages for open, select, close, split, and focus viewer group.
3. Open or activate viewer tabs from existing `select` messages.
4. Render the center canvas as viewer groups with accessible tab bars.
5. Reuse current inspector projections inside viewer group bodies.
6. Add Msg-replay proof for viewer open/select/close/split behavior.
7. Add Playwright proof for tabbed/split viewer behavior.

## Closure Evidence

- `SidecarViewerWorkspace`, `SidecarViewerGroup`, and `SidecarViewerTab` now
  define the center-canvas viewer carrier.
- Viewer tabs store only object identity: kind and object id.
- Existing project, ticket, comment, and session inspectors render as
  projections over current admitted state inside viewer tab bodies.
- Existing `select` messages now open or activate a viewer tab in the active
  viewer group.
- Viewer messages now cover open, select tab, close tab, split, and focus
  group.
- Viewer open/select/close/split/focus messages emit no `SidecarCmd`.
- Viewer split supports single, vertical split, and horizontal split layouts.
- Viewer tab bars expose tablist/tab semantics, and close controls carry
  accessible names.
- Browser proof covers opening two viewer tabs, switching to split viewer
  groups, and closing a viewer tab.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 95 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 9 Playwright tests.

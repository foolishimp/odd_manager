---
id: B-040
title: Add Sidecar VS Code-style multi-pane split and resize
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Add compact pane split controls and draggable split boundaries so wide-monitor Sidecar viewer and terminal workspaces can grow beyond the current two-pane fixed split.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-28
completed_at: 2026-04-28
build_tenant: react_vite
source_ticket: B-039
dependencies:
  - B-039 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: production Sidecar viewer and terminal pane workspaces
intake_source: Operator screenshot and correction: VS Code top-right split control plus draggable split boundary is the target interaction for wide-monitor multi-window work.
target_truth: Sidecar viewer and terminal workspaces can add vertical panes from a compact split control, resize adjacent panes by dragging the split boundary, and keep tab targeting per pane.
superseded_truth: Sidecar viewer and terminal workspaces only expose fixed single, vertical-two-pane, and horizontal-two-pane layouts with equal widths.
closure_law: This ticket closes only when viewer and terminal workspaces support adding vertical panes beyond two, adjacent split boundaries are draggable and keyboard-adjustable, pane ratios live in reducer-owned state and persist in layout profiles, executable replay proof covers split growth and ratio adjustment, browser proof covers multi-pane width adjustment, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - UX_METHOD command grammar keeps split controls compact and pane-local
  - viewer workspace supports adding vertical panes up to the bounded maximum
  - terminal workspace supports adding vertical panes up to the bounded maximum
  - viewer and terminal split ratios are reducer-owned state, not hidden DOM state
  - split boundaries are draggable and keyboard-adjustable
  - existing single, split vertical, split horizontal, pane targeting, and tab behavior continue to work
  - layout profile validation accepts and normalizes split ratios
  - executable replay proof covers multi-pane growth and ratio updates with no Cmd effects
  - Playwright proof covers adding panes and resizing a split boundary
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - multi-pane count is tracked only in component-local DOM state
  - pane widths are adjusted by ad hoc inline DOM mutation outside reducer state
  - split controls consume substantial vertical workspace
  - the change breaks existing two-pane split and targeting behavior
---

## SPEC_METHOD Triage

This is a design reframe over the Sidecar pane workspace model. The product
capability remains the Sidecar workbench, but the realization model changes
from a fixed two-pane split to bounded multi-pane vertical split with persistent
ratios.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: pane group order and split ratios are explicit state
- `Msg`: split-add and split-resize messages are pure UI messages
- `Update`: reducer owns pane growth, ratio normalization, focus, and profile
  validation
- `Cmd`: no product command effect is introduced
- `Sub`: no external subscription is introduced
- `View`: compact split controls and split handles project reducer state

## Implementation Plan

1. Add the multi-pane split and ratio rule to the Sidecar design module.
2. Extend viewer and terminal workspace state with bounded group ids and ratios.
3. Add reducer messages for vertical pane add and adjacent split-ratio resize.
4. Render compact add-split controls beside existing layout controls.
5. Render draggable/keyboard split handles between adjacent vertical panes.
6. Persist and validate ratios in layout profile state.
7. Add replay assertions and Playwright proof.
8. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Closed at `20260428T000300Z`.

Implemented:

- Added the B-040 multi-pane split and resize rule to the Sidecar design module.
- Extended viewer and terminal workspace state with bounded pane ids and split ratios.
- Added reducer-owned messages for vertical pane add, adjacent boundary resize, and ratio reset.
- Added compact `|+` add-pane controls beside existing `Single`, `Split V`, and `Split H` controls.
- Added draggable and keyboard-adjustable split handles between adjacent panes.
- Preserved existing single, two-pane vertical, two-pane horizontal, tab targeting, and empty-pane targeting behavior.
- Added layout profile validation and normalization for split ratios.
- Added runtime replay proof for viewer and terminal `1 -> 2 -> 3` pane growth plus ratio adjustment with no command effects.
- Added Playwright proof for adding third viewer and terminal panes, dragging split boundaries, and observing adjacent width changes.

Verification:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 113 Node tests, 7 Python tests.
- `npm run test:e2e -- --grep "sidecar panes add vertical splits and resize adjacent widths"` passed.
- `npm run test:e2e` passed: 18 Playwright tests.

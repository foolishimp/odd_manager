---
id: B-027
title: Realize Sidecar workbench layout state and resize primitive
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Start B-026 by implementing the first STDO-UX governed workbench primitive: reducer-owned region sizing with pointer and keyboard resize controls for the Sidecar explorer, context rail, and terminal dock.
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
  - B-025 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route layout controls
intake_source: B-026 Option A workbench reframe requires the smallest implementation slice that proves Sidecar layout can become a typed, replayable workbench carrier before explorer providers, viewer groups, or terminal groups are added.
target_truth: Sidecar has a typed workbench layout carrier in reducer state. Explorer width, context rail width, and terminal dock height are controlled by replayable Sidecar messages and rendered through CSS variables. Pointer and keyboard resize controls are accessible separators and emit no command effects.
superseded_truth: Sidecar layout dimensions are fixed in CSS, so region sizing is not represented in Sidecar State/Msg and cannot be replayed or persisted.
closure_law: This ticket closes only when layout sizing is represented in Sidecar State/Msg, pointer and keyboard resize controls update that state without Cmd effects, the CSS layout consumes the state through explicit variables, Msg-replay tests prove resize behavior, Playwright proves the browser handles are usable, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - `SidecarWorkbenchLayout` exists as an irreducible layout carrier
  - resize messages are declared in `SidecarMsg`
  - resize reducer updates are pure and emit no `SidecarCmd`
  - explorer width, context rail width, and bottom dock height are clamped in reducer logic
  - pointer resize uses host interop only to emit typed messages
  - keyboard resize is available on all resize handles
  - resize handles expose separator semantics, orientation, labels, and value state
  - CSS consumes layout state through Sidecar-owned variables
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
  - region sizes remain fixed only in CSS
  - resize state is hidden in view-local React state, refs, closures, or DOM mutation
  - resize emits command effects
  - pointer resize lacks keyboard equivalent behavior
  - resize handles lack accessible separator roles or value state
  - browser proof does not exercise the resize behavior
---

## SPEC_METHOD Triage

This is a substantive change because it changes the Sidecar realization
structure from fixed CSS sizing to a typed workbench layout carrier.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Intended scope: first implementation slice of B-026 only. This ticket does not
introduce explorer provider registry, viewer tab groups, terminal tab groups,
layout persistence, VS Code adoption, Theia adoption, Monaco adoption, or a VS
Code extension.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

Downstream span:

- design surface: `sidecar-session-workspace.md` B-026 rule
- code: Sidecar reducer, Sidecar panel projection, and Sidecar CSS
- evidence: Msg-replay tests, Playwright e2e browser proof, build proof

Release scope: within the current Sidecar UX work wave. No Goals, Intent,
Product, or Requirements repricing is required because the operator control
plane purpose and Sidecar capability boundary remain stable.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: `SidecarWorkbenchLayout` lives in `SidecarState.ui`
- `Msg`: resize actions are explicit `SidecarMsg` variants
- `Update`: resize logic is pure reducer code
- `Cmd`: resize actions emit no commands
- `Sub`: no new subscriptions are introduced in this slice
- `View`: resize handles are pure projections of state plus event-to-message
  emission

Pointer capture and pointer movement are host interop only. They must not own
semantic layout continuation. The current layout state must be reconstructable
from the Msg log.

## Implementation Plan

1. Add `SidecarWorkbenchLayout`, resize target types, limits, defaults, and
   pure clamp/update helpers to `sidecar-state.ts`.
2. Add resize messages for pointer start, pointer preview, pointer commit,
   keyboard delta, and reset.
3. Render Sidecar workbench CSS variables from state in `SidecarPanel.tsx`.
4. Add accessible separator controls for explorer width, context rail width,
   and terminal dock height.
5. Update CSS to consume Sidecar-owned layout variables.
6. Add Msg-replay tests proving resize state changes and no Cmd effects.
7. Add Playwright proof for keyboard and pointer resize behavior.

## Closure Evidence

- `SidecarWorkbenchLayout` now carries explorer width, context rail width,
  bottom dock height, and active resize gesture state.
- Resize actions are declared as `SidecarMsg` variants:
  `ui/resize-start`, `ui/resize-preview`, `ui/resize-commit`,
  `ui/resize-by`, and `ui/resize-reset`.
- Resize reducer logic is pure, clamps values in reducer code, and emits no
  `SidecarCmd`.
- Sidecar renders layout state through CSS variables:
  `--sidecar-explorer-width`, `--sidecar-context-rail-width`, and
  `--sidecar-bottom-dock-height`.
- Explorer, context rail, and terminal dock resize controls expose separator
  semantics, orientation, accessible names, and value state.
- Keyboard resize is available through arrow keys, with `Shift+Arrow` for
  larger steps and `Home` for reset.
- Pointer resize updates state by dispatching typed messages; pointer capture
  is used only as host interop.
- Playwright collaboration terminal test was corrected to click the visible
  xterm host instead of the off-viewport helper textarea.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 92 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 7 Playwright tests.

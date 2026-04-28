---
id: B-036
title: Make terminal dock resize collapse and restore
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Allow bottom-dock drag down to collapse the terminal dock and allow the reverse drag up from the collapsed strip to restore it.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
completed_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-035
dependencies:
  - B-027 completed
  - B-035 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar bottom dock resize/collapse behavior
intake_source: Operator correction during B-035: bottom-dock drag down has been limited, but it should be allowed to drag down to the point it acts as close behavior, and vice versa.
target_truth: The bottom-dock resize handle has a reducer-owned collapse threshold. Dragging the dock below that threshold collapses the terminal dock. The collapsed terminal strip keeps a resize handle; dragging up restores the terminal dock.
superseded_truth: Bottom-dock resize clamps before reaching a close/collapse behavior, and the collapsed strip can only be restored by a button click.
closure_law: This ticket closes only when the design module defines drag-collapse/restore law, the reducer owns the threshold transitions, the collapsed strip exposes a drag restore handle, executable replay proof covers both directions, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - UX_METHOD remains sole UX realization authority for this production surface
  - drag down below threshold sets `shellCollapsed: true`
  - drag up from the collapsed strip sets `shellCollapsed: false`
  - threshold behavior is reducer-owned and replayable
  - no DOM-only collapse state is introduced
  - collapsed strip still exposes the bottom-dock resize handle
  - Playwright proof covers pointer drag collapse and restore
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
  - collapse/restore is implemented through view-local pointer memory
  - dragging down still hard-stops before collapse threshold
  - collapsed strip cannot be restored by drag
  - keyboard resize behavior contradicts pointer resize behavior
---

## SPEC_METHOD Triage

This is a design reframe over the existing Sidecar resize primitive. The
product capability remains the same: the operator controls workspace real
estate. The realization must make collapse/restore a first-class reducer-owned
resize outcome.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: dock height, active resize gesture, and collapsed state remain in
  reducer-owned Sidecar state
- `Msg`: existing resize messages carry pointer/keyboard intent
- `Update`: threshold crossing sets collapse/restore state
- `Cmd`: no command effect is introduced
- `Sub`: no external subscription is introduced
- `View`: collapsed and expanded dock handles are projections of reducer state

## Implementation Plan

1. Add bottom-dock drag-collapse/restore law to the Sidecar design module.
2. Lower bottom-dock resize clamping enough to permit threshold crossing.
3. Make resize commit/by-key transitions collapse below threshold and restore
   above threshold.
4. Keep a bottom-dock resize handle visible in collapsed state.
5. Add replay assertions for drag-collapse and drag-restore.
6. Add browser proof for pointer collapse and restore.
7. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Closed under STDO-UX as a design reframe. The implementation makes terminal
dock collapse and restore a reducer-owned resize outcome, not a DOM-only
gesture.

Realization:

- `build_tenants/react_vite/design/widgets/sidecar-session-workspace.md`
  defines the B-036 bottom-dock drag-collapse and restore rule.
- `build_tenants/react_vite/src/features/sidecar/sidecar-state.ts` lowers the
  bottom-dock resize floor enough to cross a collapse threshold and applies
  reducer-owned collapse/restore thresholds on resize commit and keyboard
  resize.
- `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx` keeps the
  bottom-dock resize handle visible in collapsed state.
- `build_tenants/react_vite/src/app/styles.css` allows the bottom dock grid row
  to shrink to threshold scale before collapse.
- `build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs` proves
  bottom-dock drag-collapse and drag-restore by replay.
- `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` proves pointer
  drag down collapses the dock and pointer drag up restores it.

Verification:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed.
- `npm run test:e2e` passed with 16 Playwright tests.

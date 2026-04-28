---
id: B-035
title: Make Sidecar split-pane targeting explicit
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make viewer and terminal split panes targetable even when empty, and ensure toolbar selection/spawn actions apply to the active pane rather than an implicit global selection.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
completed_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-034
dependencies:
  - B-034 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar split viewer and split terminal targeting behavior
intake_source: Operator review of the B-034 Sidecar screen: split viewport capability is solid, but empty split panes cannot be cleanly selected and targeted; terminal selection/spawn behavior is ambiguous; action-result text can overwrite viewer tabs.
target_truth: Each viewer or terminal group is an explicit target, including when empty. Clicking or focusing a group sets the active group. Selecting a flyout row opens it in the active viewer group. Selecting a shell or spawning a shell opens it in the active terminal group. Action-result chrome is compact and cannot overwrite tab labels.
superseded_truth: Empty split panes appear as viewports but are not dependable targets. Terminal toolbar selection reads global active session state, so an empty secondary pane can still show the primary session and cannot receive that session without a different change. Spawned shell placement is implicit. Action-result feedback can visually collide with viewer tabs.
closure_law: This ticket closes only when split-pane targeting is explicit in design, reducer replay proves target-group behavior without hidden effects, the view exposes empty panes as selectable targets, terminal selection/spawn target the active group, action-result chrome cannot overlap tabs, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - UX_METHOD remains sole UX realization authority for this production surface
  - empty viewer groups dispatch existing `viewer/focus-group` before flyout selection
  - empty terminal groups dispatch existing `terminal/focus-group` before shell selection/spawn
  - terminal selector value is derived from the active terminal group, not global `activeSessionId`
  - session spawn command carries the target terminal group and opens the spawned session there
  - no new untyped view-local targeting state is introduced
  - action-result feedback is compact and cannot overwrite viewer tab labels
  - executable replay proof covers group targeting and spawned session placement
  - Playwright proof covers empty-pane targeting in viewer and terminal split layouts
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
  - targeting depends on DOM state not represented by reducer state
  - spawn placement is implicit or recovered from action-result text
  - terminal selection still uses global active session as the control value
  - empty panes remain unreachable by pointer or keyboard focus
  - action-result text can overlap tab labels
---

## SPEC_METHOD Triage

This is a design reframe over the Sidecar split-pane realization. The product
capability does not change; the implementation must make the already admitted
split groups explicit targets under the existing TEA message/reducer model.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: active viewer group and active terminal group remain reducer-owned
- `Msg`: existing focus/select messages remain the targeting path, with spawn
  request carrying an explicit terminal group target
- `Update`: reducer records the target group and spawned session placement
- `Cmd`: spawn command carries the target group as correlation, not hidden DOM
  state
- `Sub`: no new external subscription is introduced
- `View`: empty panes are pure projections of reducer-owned target state

## Implementation Plan

1. Add split-pane targeting law to the Sidecar design module.
2. Make viewer and terminal groups pointer/keyboard targetable even when empty.
3. Derive terminal selector value from the active terminal group.
4. Carry terminal group target through session spawn request, command, and
   spawn-result reducer message.
5. Move action-result feedback into compact header chrome and truncate safely.
6. Add replay assertions for target group, selection, and spawn placement.
7. Add browser proof for empty-pane targeting.
8. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Closed under STDO-UX as a design reframe. The implementation makes split groups
explicit reducer-owned targets and keeps targeting replayable through Sidecar
messages.

Realization:

- `build_tenants/react_vite/design/widgets/sidecar-session-workspace.md`
  defines the B-035 split-pane targeting rule.
- `build_tenants/react_vite/src/features/sidecar/sidecar-state.ts` carries
  spawn target group through `session/spawn/request`, `session.spawn`, and
  `session/spawn/done`.
- `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx` makes
  viewer and terminal groups pointer/keyboard targetable, derives terminal
  selection from the active terminal group, and opens spawned sessions in the
  active target group.
- `build_tenants/react_vite/src/app/styles.css` marks active split groups and
  truncates action-result feedback so it cannot overwrite tabs.
- `build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs` proves
  empty viewer and terminal group targeting and spawned-session placement by
  replay.
- `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` proves empty
  viewer and terminal split panes can be targeted in browser.

Verification:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed.
- `npm run test:e2e` passed with 16 Playwright tests.

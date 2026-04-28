---
id: B-042
title: Remove redundant Sidecar Split V control
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove the redundant visible Split V mode button now that vertical pane creation is owned by the add-pane control.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T00:32:56+1000
build_tenant: react_vite
source_ticket: B-040
dependencies:
  - B-040 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: production Sidecar viewer and terminal split controls
intake_source: Operator correction: Split V is redundant now.
target_truth: Sidecar exposes one visible vertical pane affordance per split surface: the add-pane control. Internal `split-vertical` state remains because it owns multi-pane geometry and persisted layout compatibility.
superseded_truth: Sidecar exposes both a Split V mode button and an add vertical pane action for the same operator intent.
closure_law: This ticket closes only when the visible Split V buttons are removed from viewer and terminal toolbars, vertical pane creation still works through the add-pane buttons, runtime proof rejects visible Split V labels, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `realization_refactor` and realization re-entry
  - UX_METHOD control grammar has no duplicate vertical split command
  - `split-vertical` remains supported as internal state and persisted layout input
  - viewer vertical pane creation remains available through Add vertical viewer pane
  - terminal vertical pane creation remains available through Add vertical terminal pane
  - executable replay proof rejects visible `Split V` toolbar labels
  - Playwright proof uses add-pane controls instead of removed Split V controls
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - visible Split V toolbar labels remain
  - add-pane buttons no longer create vertical panes
  - persisted `split-vertical` layouts are rejected
---

## SPEC_METHOD Triage

This is a realization refactor over existing Sidecar split controls. B-040
made vertical multi-pane creation explicit through add-pane controls. The old
Split V mode button now duplicates that intent.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `realization_refactor`.

Lawful re-entry point: Realization.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: keep existing `split-vertical` state
- `Msg`: keep existing vertical split messages
- `Update`: no semantic reducer change
- `Cmd`: no command effect
- `Sub`: no subscription
- `View`: remove duplicate Split V buttons and keep add-pane controls

## Implementation Plan

1. Remove `Split V` from the visible viewer and terminal layout mode buttons.
2. Keep `|+` add-pane controls as the only visible vertical split affordance.
3. Update Playwright tests to target add-pane controls.
4. Add runtime source proof that visible Split V labels are absent.
5. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

- Removed the visible `Split V` mode button from viewer and terminal split
  controls.
- Kept internal `split-vertical` state and persisted-layout compatibility.
- Kept vertical pane creation available through `Add vertical viewer pane` and
  `Add vertical terminal pane`.
- Added runtime source proof that visible Split V labels are absent while
  add-pane controls remain present.
- Updated Playwright flows to use add-pane controls instead of retired Split V
  buttons.
- `npm run test:sidecar-wave` passed from `build_tenants/react_vite`
  with 114 Node tests and 7 Python tests.
- `npm run build` passed from `build_tenants/react_vite`.
- Focused Playwright proof passed: 4 tests.
- Full `npm run test:e2e` passed: 19 tests.

---
id: B-041
title: Make Sidecar horizontal terminal split use maximum height
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove the residual fixed-height cap from horizontal terminal splits so Split H consumes the maximum height assigned by the terminal dock.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
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
ux_surface_scope: production Sidecar terminal horizontal split
intake_source: Operator correction: the horizontal split should resize to the maximum available height.
target_truth: Terminal Split H assigns rows from reducer-owned pane ratios and each terminal host fills the maximum height of its assigned row.
superseded_truth: Terminal Split H uses a residual fixed clamp on terminal host height, preventing the horizontal panes from using their full assigned height.
closure_law: This ticket closes only when the horizontal terminal split host fills its row height, runtime CSS proof rejects the capped clamp behavior, Playwright proof measures host height against the assigned group body, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `realization_refactor` and realization re-entry
  - UX_METHOD density law is preserved
  - no product state, message, command, or subscription semantics change
  - horizontal terminal group body, terminal shell, and terminal host consume assigned row height
  - horizontal terminal split no longer has a fixed host-height clamp in the bottom dock
  - executable CSS proof covers max-height Split H behavior
  - Playwright proof covers Split H host height matching its assigned body height
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - horizontal terminal hosts remain capped by `clamp(..., 26rem)`
  - horizontal panes leave unused vertical dock space
  - the fix changes Sidecar reducer semantics
---

## SPEC_METHOD Triage

This is a realization refactor over the Sidecar terminal horizontal split
projection. B-040 already made split ratios reducer-owned. This defect is a
CSS carry-over: horizontal terminal hosts still use a fixed height cap instead
of filling the pane row assigned by the split layout.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `realization_refactor`.

Lawful re-entry point: Realization.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: no new state
- `Msg`: no new message
- `Update`: no reducer change
- `Cmd`: no command effect
- `Sub`: no subscription
- `View`: CSS projection lets Split H terminal panes consume assigned height

## Implementation Plan

1. Remove the fixed horizontal terminal host clamp for bottom-dock Split H.
2. Make horizontal terminal group bodies, terminal shells, placeholders, and
   hosts fill the assigned grid row height.
3. Add runtime CSS proof for max-height horizontal split behavior.
4. Add Playwright proof that Split H host height matches the assigned pane body.
5. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

- Removed the bottom-dock Split H terminal host clamp and replaced it with
  assigned-row fill-height behavior.
- Added runtime CSS proof that horizontal terminal hosts use `height: 100%`
  and no longer carry the old `clamp(18rem, 32vh, 26rem)` cap.
- Added Playwright geometry proof:
  `sidecar horizontal terminal split uses maximum assigned height`.
- `npm run test:sidecar-wave` passed from `build_tenants/react_vite`
  with 114 Node tests and 7 Python tests.
- `npm run build` passed from `build_tenants/react_vite`.
- Focused Playwright proof passed: 4 tests.
- Full `npm run test:e2e` passed: 19 tests.

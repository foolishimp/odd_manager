---
id: B-044
title: Make terminal Split H grid consume expanded dock height
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Fix the remaining terminal Split H compression where terminal groups stop near the toolbar while the expanded dock leaves unused space below.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T01:24:41+1000
build_tenant: react_vite
source_ticket: B-043
dependencies:
  - B-043 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: production Sidecar terminal horizontal split
intake_source: Operator screenshot: Split H expands the dock but terminal windows remain compressed at the top.
target_truth: Terminal Split H group grid consumes the expanded terminal dock height; both stacked terminal panes occupy the available workspace instead of leaving unused space below.
superseded_truth: Terminal Split H expands the dock but the terminal group grid can remain content-sized near the toolbar.
closure_law: This ticket closes only when terminal workspace grid has explicit one-row height ownership, runtime CSS proof covers that ownership, Playwright proof checks the terminal groups reach the bottom of the workspace, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `realization_refactor` and realization re-entry
  - UX_METHOD large-canvas law is preserved
  - no state, message, command, or subscription semantics change
  - terminal workspace declares a `minmax(0, 1fr)` row for terminal groups
  - terminal groups fill and clip inside the terminal workspace
  - Playwright proof rejects unused vertical space below Split H terminal groups
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
  - terminal groups remain compressed near the toolbar
  - expanded terminal dock leaves unused space below the terminal groups
---

## SPEC_METHOD Triage

This is a realization refactor over the Sidecar terminal Split H projection.
B-043 expanded the dock when Split H is selected. The remaining defect is in
the internal terminal grid: the workspace child can sit in an implicit
content-sized grid row, so the group stack does not consume the expanded dock.

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
- `View`: CSS projection makes terminal Split H consume expanded dock height

## Implementation Plan

1. Give terminal workspace an explicit `minmax(0, 1fr)` grid row.
2. Make terminal groups clip and fill that row.
3. Strengthen runtime CSS proof.
4. Strengthen Playwright geometry proof to ensure the terminal groups reach
   the bottom of the terminal workspace.
5. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

- Made the Sidecar workbench and workbench panel own viewport-height directly,
  instead of relying only on a parent-scoped selector.
- Made the terminal bottom dock a definite-height grid container.
- Added an explicit `minmax(0, 1fr)` row to terminal workspace.
- Made terminal groups fill and clip inside that workspace.
- Strengthened runtime CSS proof for workbench height, bottom dock height, and
  terminal workspace row ownership.
- Strengthened Playwright proof:
  `sidecar horizontal terminal split uses maximum assigned height` now rejects
  tiny terminal panes and verifies the group stack fills the terminal
  workspace.
- `npm run test:sidecar-wave` passed from `build_tenants/react_vite`
  with 115 Node tests and 7 Python tests.
- Focused Playwright proof passed: 1 test.
- `npm run build` passed from `build_tenants/react_vite`.
- Full `npm run test:e2e` passed: 20 tests.

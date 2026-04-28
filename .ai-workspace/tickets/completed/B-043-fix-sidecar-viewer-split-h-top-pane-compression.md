---
id: B-043
title: Fix Sidecar Split H top pane compression
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make Split H rows consume their full available height and expand the terminal dock when stacked terminal panes need more vertical space.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T01:06:37+1000
build_tenant: react_vite
source_ticket: B-041
dependencies:
  - B-040 completed
  - B-041 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: production Sidecar viewer and terminal horizontal split
intake_source: Operator correction: Split H is not working; it compressed the top window.
target_truth: Viewer Split H owns the full canvas height, terminal Split H expands the terminal dock to stacked-pane height, and top/bottom panes receive balanced row height unless the user drags the split.
superseded_truth: Split H can size from content or a small persisted dock height, causing the top pane to compress instead of filling its assigned row.
closure_law: This ticket closes only when viewer Split H has explicit fill-height CSS, terminal Split H expands the dock height, runtime proof covers both contracts, Playwright proof measures top and bottom viewer rows plus terminal dock height, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `realization_refactor` and realization re-entry
  - UX_METHOD canvas law is preserved: workspace area owns complexity, controls stay compact
  - no message, command, or subscription semantics change
  - viewer workspace and viewer groups consume the canvas row height
  - horizontal viewer groups and bodies consume their assigned row height
  - terminal Split H raises a small dock to horizontal split height
  - Playwright proof rejects a compressed top Split H pane
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - top viewer Split H pane remains visibly compressed
  - viewer Split H depends on content height rather than canvas height
  - terminal Split H leaves the dock at a compressed persisted height
  - the fix adds commands or subscriptions
---

## SPEC_METHOD Triage

This is a realization refactor over Sidecar Split H projection. The terminal
host already fills its assigned row after B-041, but the terminal dock can
still be too short for stacked panes. The viewer Split H path also lacked
equivalent explicit height ownership, allowing CSS content sizing to compress
the top window.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `realization_refactor`.

Lawful re-entry point: Realization.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: existing workbench layout may expand when terminal Split H is selected
- `Msg`: no new message
- `Update`: terminal Split H raises bottom dock height without a command
- `Cmd`: no command effect
- `Sub`: no subscription
- `View`: CSS projection makes viewer Split H rows fill assigned height

## Implementation Plan

1. Make viewer workspace and group grid explicitly consume available height.
2. Make horizontal viewer group, body, inspector, and empty-state nodes fill
   their assigned row height.
3. Expand the bottom dock when terminal Split H is selected.
4. Add runtime proof for viewer Split H height ownership and terminal dock
   expansion.
5. Add Playwright proof that top and bottom Split H viewer rows are balanced
   and terminal Split H has enough dock height.
6. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

- Added explicit fill-height ownership for viewer workspace, viewer groups,
  horizontal viewer panes, viewer bodies, inspectors, and empty states.
- Added reducer-owned terminal Split H dock expansion using the existing
  workbench layout surface and no command effect.
- Added replay proof:
  `terminal horizontal split expands dock height without Cmd effects`.
- Added CSS proof for viewer Split H height ownership.
- Added Playwright proof:
  `sidecar horizontal viewer split keeps top and bottom panes balanced`.
- Strengthened terminal Playwright proof:
  `sidecar horizontal terminal split uses maximum assigned height` now also
  verifies expanded dock height.
- `npm run test:sidecar-wave` passed from `build_tenants/react_vite`
  with 115 Node tests and 7 Python tests.
- `npm run build` passed from `build_tenants/react_vite`.
- Focused Playwright Split H proof passed: 2 tests.
- Full `npm run test:e2e` passed: 20 tests.

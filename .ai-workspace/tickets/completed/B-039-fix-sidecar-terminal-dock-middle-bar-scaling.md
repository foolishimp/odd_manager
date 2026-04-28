---
id: B-039
title: Fix Sidecar terminal dock middle bar scaling
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Prevent the terminal dock control strip from expanding into a large middle band when the dock has extra vertical space or split panes are active.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
completed_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-037
dependencies:
  - B-037 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: production Sidecar terminal dock layout
intake_source: Operator screenshot showing the terminal dock middle control bar scaling into a broad blank band.
target_truth: The terminal dock keeps control chrome compact at the top of the dock. Extra vertical space belongs to the terminal workspace panes, not to the toolbar or interstitial band.
superseded_truth: The terminal dock relies on implicit grid rows, allowing the toolbar/control band to stretch when the dock row is taller than its content.
closure_law: This ticket closes only when the terminal dock declares explicit grid rows, the terminal workspace consumes the flexible height, browser proof covers split terminal panes and compact toolbar placement, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `realization_refactor` and realization re-entry
  - UX_METHOD density law is preserved by keeping persistent terminal chrome compact
  - no product state, message, command, or subscription semantics change
  - terminal dock explicit rows prevent implicit row stretching
  - terminal workspace and groups consume the flexible dock height
  - Playwright proof asserts compact toolbar height and small toolbar-to-tabs gap in split mode
  - executable runtime proof asserts the CSS row contract
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
  - terminal toolbar can vertically center inside a large blank dock band
  - split terminal panes make the control strip consume terminal workspace height
  - the fix changes sidecar reducer/update/command semantics
---

## SPEC_METHOD Triage

This is a realization refactor over Sidecar terminal dock layout. The product
capability and design direction do not change. The defect is a CSS realization
gap: implicit grid rows allocate spare vertical space to chrome instead of to
the terminal workspace.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `realization_refactor`.

Lawful re-entry point: Realization.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: no new product state
- `Msg`: no new operator message
- `Update`: no reducer change
- `Cmd`: no command effect
- `Sub`: no subscription
- `View`: CSS layout rows are tightened so existing view state scales lawfully

## Implementation Plan

1. Give the bottom dock explicit rows for resize handle and terminal shell layout.
2. Give the terminal shell layout explicit rows for compact toolbar and flexible workspace.
3. Make terminal workspace/groups consume flexible height without stretching toolbar chrome.
4. Add runtime CSS assertions for the row contract.
5. Add/strengthen Playwright assertions for split terminal compact scaling.
6. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Closed at `20260427T232949Z`.

Implemented:

- Added explicit `auto minmax(0, 1fr)` rows to the terminal bottom dock so spare height no longer stretches implicit rows.
- Added explicit `auto minmax(0, 1fr)` rows to the terminal shell layout so the toolbar remains compact and terminal panes take flexible height.
- Made terminal workspace and terminal group containers consume the flexible height while hiding overflow.
- Strengthened runtime CSS proof for bottom dock, shell layout, and terminal workspace row contracts.
- Strengthened Playwright terminal density proof in split mode with assertions for compact toolbar height, toolbar top offset, toolbar-to-tabs gap, workspace height, and host height.
- Removed the flaky e2e close-button locator wait from empty split-pane targeting by clicking the close button through the already-located pane DOM and then asserting the pane is empty.

Verification:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 111 Node tests, 7 Python tests.
- `npm run test:e2e -- --grep "sidecar terminal chrome stays compact before the terminal host"` passed.
- `npm run test:e2e -- --grep "sidecar split panes can be explicitly targeted when empty"` passed.
- `npm run test:e2e` passed: 17 Playwright tests.

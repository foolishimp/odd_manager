---
id: B-045
title: Fix live terminal Split H row placement
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Fix the live Sidecar terminal Split H surface where the dock expands but the terminal workspace is auto-placed into a content-sized row.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T02:42:17+1000
build_tenant: react_vite
source_ticket: B-044
dependencies:
  - B-044 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: production Sidecar terminal horizontal split
intake_source: Operator screenshot from live 127.0.0.1:5174 showing document Split H fills correctly while terminal Split H remains compressed.
target_truth: The non-collapsed terminal dock gives its full height to the terminal workspace; Split H divides that workspace into two usable terminal rows.
superseded_truth: The terminal dock owns an extra empty 1fr row while the terminal workspace remains in the first auto-sized row.
closure_law: This ticket closes only when live browser geometry shows the shell layout and terminal workspace consume the expanded terminal dock height, Playwright proof rejects a compressed first-row terminal workspace, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `realization_refactor` and realization re-entry
  - UX_METHOD projection law is preserved with no new product command or hidden state
  - non-collapsed terminal dock has one fill row for `TerminalWorkspace`
  - collapsed terminal dock still renders the compact restore row
  - Split H terminal workspace height is close to dock height minus toolbar/chrome, not a content-sized row
  - Playwright proof rejects unused dock height below the shell layout
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
  - terminal workspace remains auto-sized near the toolbar
  - expanded terminal dock leaves an empty row below the terminal workspace
  - Split H panes remain too shallow to use
---

## SPEC_METHOD Triage

This is a realization refactor over the Sidecar terminal dock projection.
B-044 made the internal terminal grid fill its assigned workspace, but the
live 5174 surface showed that the workspace itself was assigned only the first
auto row of the bottom dock grid.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `realization_refactor`.

Lawful re-entry point: Realization.

## STDO-UX Execution Contract

The change must preserve the Elm Architecture process model:

- `State`: no new state
- `Msg`: no new message
- `Update`: no reducer change
- `Cmd`: no command effect
- `Sub`: no subscription
- `View`: CSS projection assigns the terminal workspace the full terminal dock row

## Implementation Plan

1. Make the non-collapsed terminal dock expose one `minmax(0, 1fr)` grid row.
2. Keep the collapsed terminal dock as a compact auto restore row.
3. Strengthen runtime CSS proof for the one-row dock ownership.
4. Strengthen Playwright geometry proof to reject an empty dock row below the shell layout.
5. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Root cause: `.sidecar-bottom-dock` declared `grid-template-rows: auto minmax(0, 1fr)`.
The only normal-flow child, `TerminalWorkspace`, was auto-placed into the first
content-sized row. The second row consumed the remaining dock height but had no
terminal workspace in it.

Implemented:

- Changed the non-collapsed terminal dock to one fill row:
  `grid-template-rows: minmax(0, 1fr)`.
- Kept the collapsed dock as a compact `auto` restore row.
- Updated runtime CSS proof so the old `auto + 1fr` dock row cannot return.
- Updated Playwright geometry proof to verify the shell layout consumes the
  expanded dock height before checking the terminal workspace and panes.

Live 5174 verification after patch:

- terminal dock height: 720px
- shell layout height: 713px
- terminal workspace height: 669px
- Split H pane heights: 326px and 326px

Verification:

- `npm run test:sidecar-wave` passed: 115 Node tests and 7 Python tests.
- `npm run build` passed.
- Focused Playwright proof passed:
  `sidecar horizontal terminal split uses maximum assigned height`.
- `npm run test:e2e` passed: 20 tests.

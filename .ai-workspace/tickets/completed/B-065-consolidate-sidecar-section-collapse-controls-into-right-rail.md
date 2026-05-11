---
id: B-065
title: Consolidate Sidecar section collapse controls into right rail
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Reclaim the full-width Sidecar section-control row by moving Info/Shell minimize and reset commands into the narrow right rail.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-04-28T17:57:31Z
activated_at: 2026-04-29
completed_at: 2026-04-28T17:57:31Z
build_tenant: react_vite
dependencies:
  - B-037 completed
  - B-063 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar workbench chrome
intake_source: Operator screenshot and direction that the minimize tab row can be consolidated and minimized buttons moved to the unused rightmost tool rail.
target_truth: Sidecar section minimize, restore, and reset commands are compact right-rail affordances with sweep-out detail. The workbench no longer renders a full-width section controls row above the canvas.
superseded_truth: `sidecar-section-controls` renders Info Browser, Shell Workspace, and Reset Layout as a full-width row, consuming vertical space that should belong to document and terminal panes.
closure_law: This ticket closes only when the Sidecar design module defines the right-rail chrome command rule, implementation removes the full-width section-control row, restore/minimize/reset remain keyboard accessible, and executable tests prove vertical space is reclaimed without losing independent section collapse behavior.
evaluation_criteria:
  - design module records section chrome consolidation under the right rail
  - `.sidecar-section-controls` no longer renders as a full-width grid row in the production Sidecar route
  - Info Browser and Shell Workspace remain independently minimizable and restorable
  - Reset Layout remains available as a compact rail command
  - rail commands expose clear accessible names and sweep-out detail on hover/focus
  - collapsed section state remains reducer-owned and replayable
  - browser proof confirms the first viewer row starts higher than before this ticket
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - section controls are hidden without a visible restore path
  - commands move into undocumented DOM-only state
  - the right rail starts displaying long horizontal labels again
  - the workbench loses independent Info/Shell collapse behavior
---

## SPEC_METHOD Triage

This is a design reframe. The product capability is unchanged: the operator can
show, hide, and reset Sidecar workspaces. The realization shape changes because
the current full-width row conflicts with the compact workbench grammar.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

State remains explicit in Sidecar UI state. Msg variants for minimize, restore,
and reset remain typed and reducer-owned. The right rail is a pure projection
and command surface over that state.

## Implementation Notes

Prefer a compact rail group for workspace chrome commands:

- Info Browser minimize/restore
- Shell Workspace minimize/restore
- Reset Layout

Use sweep-out detail for labels and state summaries. Keep the rail narrow and
symbol-first.

## Closure Evidence

Closed at `2026-04-28T17:27:23Z`.

Implemented:

- Removed the full-width `sidecar-section-controls` row from the Sidecar
  workbench.
- Moved Info Browser minimize/restore, Shell Workspace minimize/restore, and
  Reset Layout into compact right-rail command buttons.
- Kept commands keyboard-accessible with explicit labels and sweep-out detail.
- Preserved reducer-owned `ui/toggle-workspace` and `layout/profile-reset`
  messages.
- Updated CSS grid rows so the canvas/rail row starts at the top of the
  Sidecar workbench.
- Updated runtime and browser proof for right-rail section chrome.

Verification:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 118 Node tests, 7 Python tests.
- `npm run test:e2e -- --grep "sidecar sections minimize and restore independently|sidecar right context rail is narrow"` passed: 2 tests.
- `npm run test:e2e` passed: 26 tests.

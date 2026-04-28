---
id: B-050
title: Make active Project actions clear and non-spinning
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Stop active/current Project rows from presenting disabled actions as loading/spinning controls.
change_class: realization_refactor
re_entry_point: code
affected_boundary: build_tenants/react_vite/src/layout/AppShell.tsx, build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T03:10:46Z
build_tenant: react_vite
dependencies:
  - B-046 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Workspace Tool Project list actions
intake_source: Operator observed active `odd_world_model` Project row showing spinner/wait affordance on Open/Remove and being unclickable.
target_truth: Current Project rows clearly show current state. Disabled controls do not imply loading. Registry management remains usable while world projection is loading.
superseded_truth: Current Project rows show disabled Open/Remove buttons with a global wait cursor.
closure_law: This ticket closes only when current Project state is explicit, disabled controls no longer use wait cursor, and browser proof covers the row behavior.
evaluation_criteria:
  - Current Project Open action is labeled Current
  - Active/current Remove communicates why it is unavailable
  - Disabled buttons do not use wait cursor
  - Workspace Tool is not disabled only because world projection is loading
  - Playwright proof covers the non-spinning active Project row
proof_surface:
  - build_tenants/react_vite/src/layout/AppShell.tsx
  - build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:e2e
---

## SPEC_METHOD Triage

This is a realization refactor. The maintained Project registry model is
unchanged; the defect is misleading disabled-action affordance in the Workspace
Tool.

Lawful re-entry point: Code.

## STDO-UX Execution Contract

- `State`: current/active Project state is explicit UI state
- `Msg`: no new message type is needed
- `Update`: action availability derives from Project row state
- `Cmd`: no external effect changes
- `View`: disabled controls communicate unavailable state, not loading

## Closure Evidence

Changed current/active Project rows so Open becomes `Current` with an explicit
title. Remove remains unavailable for the active Project and explains that
another Project must be opened first. Disabled buttons now use `not-allowed`
instead of the wait/spinner cursor.

Workspace Tool registry management is no longer disabled merely because world
projection is loading.

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "active project row"`: 1 passed
- `npm run test:e2e -- --grep "captures requirements"`: 1 passed
- `npm run test:e2e`: 23 passed

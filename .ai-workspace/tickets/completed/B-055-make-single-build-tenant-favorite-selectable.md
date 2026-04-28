---
id: B-055
title: Make single build_tenants Sidecar favorite selectable
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Ensure a single pinned `build_tenants` favorite is visibly selectable and opens its folder pane from the rail.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T06:31:49Z
build_tenant: react_vite
dependencies:
  - B-052 completed
  - B-053 completed
  - B-054 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar pinned favorite rail selection
intake_source: Operator observed one `BT` favorite pinned; clicking it left the pin unhighlighted and appeared to do nothing.
target_truth: A pinned `build_tenants` favorite behaves like any other selectable navigator: clicking it opens the info browser, marks the rail item active, and renders the folder pane.
superseded_truth: A single `BT` favorite can appear inert or unselected.
closure_law: This ticket closes only when browser proof covers a one-favorite `build_tenants` rail state.
evaluation_criteria:
  - localStorage with only `build_tenants` as a favorite renders one `BT` rail item
  - clicking `BT` sets `aria-pressed=true`
  - clicking `BT` opens the `./build_tenants` folder pane
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor over the pinned favorite rail. The product and
UX model do not change; one pinned favorite must behave identically to a list
of favorites.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented the single-favorite activation correction:

- rail active state no longer depends on whether the info flyout is open
- a selected pinned favorite remains visibly active after the flyout is closed
- clicking the active `BT` favorite reopens the `./build_tenants` folder pane
- added browser proof for localStorage containing only the `build_tenants`
  favorite
- restored the observed workspace at the end of the new test so later tests do
  not inherit the manager workspace context

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar build tenant favorite|sidecar browse navigator"`: 2 passed
- `npm run test:e2e -- --grep "sidecar build tenant favorite|sidecar viewer panes open tabs"`: 2 passed
- `npm run test:e2e`: 26 passed

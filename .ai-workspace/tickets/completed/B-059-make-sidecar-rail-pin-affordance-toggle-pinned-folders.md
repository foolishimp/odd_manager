---
id: B-059
title: Make Sidecar rail pin affordance toggle pinned folders
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the visible `pin` affordance on pinned rail favorites perform the expected unpin action.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T12:31:00Z
build_tenant: react_vite
dependencies:
  - B-058 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar pinned folder rail favorites
intake_source: Operator clicked the visible `pin` label on the `BT` rail favorite and expected the folder to be unpinned or pinned depending on state, but nothing changed.
target_truth: A pinned folder rail favorite separates folder selection from pin state; clicking the folder opens it, while clicking the visible `pin` affordance unpins it and returns the operator to Browse/recovery.
superseded_truth: The `pin` text on a rail favorite is passive status text and cannot change pin state.
closure_law: This ticket closes only when pinned rail favorites expose an accessible unpin control, clicking it removes the favorite from the rail, Browse shows the recovery pin action, and browser verification passes.
evaluation_criteria:
  - clicking `BT` opens `./build_tenants`
  - clicking the `pin` affordance for `BT` removes the rail favorite
  - Browse exposes `Pin ./build_tenants` after rail unpin
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor over the existing pin model. Product meaning
does not change. The visible affordance must match the operator action model:
folder selection and pin-state mutation are separate commands.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented the visible rail pin toggle:

- pinned rail favorites now render as two adjacent controls
- clicking the main folder control opens the pinned folder
- clicking the compact `pin` control unpins that favorite
- unpinning a rail favorite returns the info browser to Browse so the folder
  can be recovered with `Pin ./...`
- the unpin control has a separate accessible name (`Unpin ./build_tenants`)
  to avoid colliding with the folder selection button

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar build tenant favorite|sidecar browse navigator"`: 2 passed
- `npm run test:sidecar-wave`: 115 Node tests and 7 Python tests passed
- `npm run test:e2e`: 26 passed

---
id: B-058
title: Remove info-browser shell selector and clarify folder pinning
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Keep shell selection inside the Shell Workspace and make folder pinning visibly produce a rail favorite.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T11:40:00Z
build_tenant: react_vite
dependencies:
  - B-052 completed
  - B-057 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar info-browser rail and pinned folder navigator
intake_source: Operator observed that the info-browser shell selector serves no clear purpose and that pin behavior is unclear.
target_truth: The info browser exposes Projects, Tickets, Comments, pinned folders, and Browse only; shell selection remains in the Shell Workspace. Pinning or recovering a folder immediately opens that pinned folder as the active rail favorite.
superseded_truth: Sessions appears as an info-browser selector, and adding a pin can appear to do nothing until the new rail item is manually selected.
closure_law: This ticket closes only when Sessions is absent from the info-browser rail, terminal session selection remains available in the Shell Workspace, pin actions immediately activate the pinned folder, and runtime plus browser verification pass.
evaluation_criteria:
  - no visible `Sessions` button appears in the Sidecar info-browser rail
  - shell/session selection remains available in the terminal dock
  - manual folder pinning opens the new pinned folder pane
  - recovering a folder pin opens the recovered pinned folder pane
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor over the current sidecar workbench. The product
still observes sessions, but session selection is no longer an info-browser
navigator. Pinning remains a local operator favorite mechanism over folders in
the active Project.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented the sidecar UX cleanup:

- removed `Sessions` from the info-browser provider registry and rail
- kept shell/session selection in the Shell Workspace terminal dock
- removed the unreachable Sessions flyout pane from the info browser
- changed pin/recover actions so the pinned folder becomes the active rail
  favorite immediately
- updated browser proof so pinning and recovering both assert active rail state
  and visible folder panes
- updated runtime proof so session selection still replays without making
  Sessions an info-browser provider

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar explorer provider registry omits sessions|sidecar browse navigator|sidecar viewer panes open tabs"`: 3 passed
- `npm run test:sidecar-wave`: 115 Node tests and 7 Python tests passed
- `npm run test:e2e`: 26 passed

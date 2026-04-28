---
id: B-052
title: Promote pinned folders to first-class Sidecar navigators
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Correct B-051 so pinned folders appear in the Sidecar selector at the same level as Tickets and Comments.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T05:30:57Z
build_tenant: react_vite
dependencies:
  - B-051 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar selection rail, Browse manager, and pinned folder tree panes
intake_source: Operator observed that pinning did not create a navigator peer of Tickets and Comments, and that unpinning with X made the folder disappear with no clear recovery path.
target_truth: Pinned folders are first-class Sidecar navigator entries. Browse discovers, pins, unpins, and recovers folders; it is not the only place pinned folders are usable.
superseded_truth: Pinned folders live only inside the Browse surface and disappear from the usable selector when unpinned.
closure_law: This ticket closes only when pinned folders render on the activity rail beside built-in navigators, unpin has a visible recovery path, and browser proof covers both behaviors.
evaluation_criteria:
  - Pinned folders render as selector entries at the same level as Projects, Tickets, Comments, Sessions, and Browse
  - Selecting a pinned folder opens its own tree pane directly
  - Browse remains the folder discovery and pin management surface
  - Unpinned folders can be recovered without leaving the Sidecar
  - Playwright proof covers rail-level pinned selection and recovery
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

B-051 established the reusable hierarchical navigator grammar. The observed
defect is not a product or requirement change; it is a design realization error.
Pins were modeled as Browse-local content instead of navigator entries.

Lawful re-entry point: Design, then realization.

## STDO-UX Execution Contract

- `State`: pinned folder set and active pinned folder selection live at the
  Sidecar shell level
- `Msg`: rail selection chooses either a built-in surface or one pinned folder
- `Update`: pin, unpin, and recover change the pinned navigator set only
- `Cmd`: folder expansion still uses the filesystem browse contract
- `View`: built-in navigators and pinned folders share the same selector tier

## Implementation Scope

- promote pinned folder state from Browse to the Sidecar panel
- render pinned folders on the activity rail
- keep Browse as a management surface with manual pin, default pin recovery,
  and recent unpin recovery
- open a pinned folder tree directly when its rail entry is selected
- prove the correction through the existing Sidecar Playwright suite

## Closure Evidence

Implemented the corrected navigator boundary:

- pinned folder state now lives at the Sidecar panel level
- pinned folders render on the activity rail beside Projects, Tickets,
  Comments, Sessions, and Browse
- selecting a pinned folder opens that folder's tree directly
- Browse remains the pin management surface
- Browse exposes recovery buttons for default pins and recently unpinned pins
- rail-level pin selection and unpin/recovery are covered by Playwright

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar selector groups|sidecar browse navigator"`: 2 passed
- `npm run test:e2e`: 25 passed

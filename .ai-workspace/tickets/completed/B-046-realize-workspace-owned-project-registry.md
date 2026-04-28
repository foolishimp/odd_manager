---
id: B-046
title: Realize workspace-owned Project registry
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Replace scan-derived Projects with a maintained Project registry owned by the manager workspace, and make the workspace tool add, remove, and activate Projects.
change_class: design_reframe
re_entry_point: design
affected_boundary: specification/PRODUCT.md, build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md, build_tenants/react_vite/src/contracts/project.ts, build_tenants/react_vite/src/server/project-asset-surface-service.mjs, build_tenants/react_vite/src/server/index.mjs, build_tenants/react_vite/src/lib/collaboration.ts, build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx, build_tenants/react_vite/src/layout/AppShell.tsx, build_tenants/react_vite/src/app/App.tsx, build_tenants/react_vite/runtime/tests/test_project_asset_surface.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T02:03:07Z
build_tenant: react_vite
source_ticket: T-017
dependencies:
  - T-017 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: top workspace tool, ProjectAssetSurface, Sidecar Projects provider
intake_source: Operator clarification: Projects are a maintained list that sits within the manager workspace; the workspace tool is used to add and remove Projects from that workspace.
target_truth: The manager workspace owns a durable Project registry. Browse, scan, and manual entry discover candidate filesystem roots; explicit add/remove actions mutate the Project registry; activating a Project sets the managed Project context.
superseded_truth: ProjectAssetSurface is a read-only scan of `/Users/jim/src/apps`, and the workspace selector only opens paths plus browser-local recents.
closure_law: This ticket closes only when Project registry storage sits under the manager workspace, register/unregister/set-active actions are exposed through the API and selector UX, ProjectAssetSurface lists maintained projects rather than discovered candidates, and build plus sidecar-wave plus e2e proof pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - design topology names the manager-workspace Project registry path
  - ProjectRecord distinguishes maintained registry records from discovery candidates
  - server ProjectAssetSurface reads and writes `.ai-workspace/runtime/odd_manager/projects.json`
  - workspace selector lists maintained Projects first
  - browse, scan, and manual paths add Projects to the registry instead of silently becoming durable state
  - a maintained Project can be removed unless it is the active Project
  - active Project selection persists through the registry and still drives `/api/world`
  - Sidecar Projects provider consumes the maintained registry
  - `npm run test:sidecar-wave` passes
  - `npm run build` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md
  - build_tenants/react_vite/src/contracts/project.ts
  - build_tenants/react_vite/src/server/project-asset-surface-service.mjs
  - build_tenants/react_vite/src/server/index.mjs
  - build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx
  - build_tenants/react_vite/runtime/tests/test_project_asset_surface.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run test:sidecar-wave
  - npm run build
  - npm run test:e2e
non_closure_conditions:
  - Project list remains a scan result
  - maintained Projects live only in browser localStorage
  - opening a discovered path bypasses registry mutation
  - Sidecar and the top workspace tool disagree about available Projects
---

## SPEC_METHOD Triage

This is a design reframe because it changes the ProjectAssetSurface ownership
model from scan-derived projection to maintained manager-workspace state.

Affected product boundary: `odd_manager` control-plane project, `react_vite`
build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: maintained Project records and active Project are typed state
- `Msg`: add/remove/activate are named user actions
- `Update`: UI state changes remain pure
- `Cmd`: registry mutation and world loading are explicit HTTP effects
- `Sub`: no new subscription is required
- `View`: workspace tool projects registry state and discovery candidates

## Implementation Plan

1. Update topology design to make Projects a manager-workspace registry.
2. Extend ProjectRecord and ProjectAssetSurface with registry metadata and
   register/unregister/set-active actions.
3. Add API routes for listing, registering, unregistering, and activating
   Projects.
4. Rework ProjectSelector so maintained Projects are the primary surface and
   browse/scan/manual are add flows.
5. Keep Sidecar Projects bound to `/api/projects` so it reads the same registry.
6. Add deterministic and browser proof.

## Closure Evidence

Implemented the manager-workspace Project registry at
`.ai-workspace/runtime/odd_manager/projects.json`. Project discovery now only
proposes candidates; `register`, `unregister`, and `setActive` are explicit
registry actions exposed through the API, MCP resource surface, and workspace
tool.

Verified:

- `node --test runtime/tests/test_project_asset_surface.mjs`: 6 passed
- `npm run test:sidecar-wave`: 115 Node tests and 7 Python tests passed
- `npm run build`: passed
- `npm run test:e2e`: 20 Playwright tests passed

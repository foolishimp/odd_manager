---
id: B-051
title: Realize hierarchical pinned Sidecar navigator
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the Sidecar left selector a reusable hierarchical navigator with collapsible groups, local sort controls, and pinned project folders.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T04:35:59Z
build_tenant: react_vite
dependencies:
  - B-028 completed
  - B-034 completed
  - B-048 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar selection rail and flyout navigator
intake_source: Operator request for collapsible folders, per-group time/alpha/reverse sorting, and pinned project folders such as tickets, comments, specification, and build_tenants.
target_truth: The Sidecar selector is a compact reusable navigator. Tickets and comments are preconfigured hierarchical navigators; arbitrary project folders can be pinned and unpinned as favorites.
superseded_truth: Tickets and comments are flat or hardcoded lists with no collapsed subgroup control, no local sort control, and no path for project-local folder pins.
closure_law: This ticket closes only when tickets and comments expose collapsible sortable hierarchy, pinned folders can be added and removed from the Sidecar navigator, and browser tests prove the interactions.
evaluation_criteria:
  - Tickets group by lane with collapsible active/backlog/completed groups
  - Comments group by author with collapsible author groups
  - Each group exposes time, alpha, and reverse controls on the heading line
  - A Browse navigator exposes default project folder pins and supports manual pin/unpin
  - Pinned folders can expand to show child directories through the existing filesystem browse contract
  - Playwright proof covers hierarchy controls and pinned folder behavior
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/src/server/index.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:e2e
---

## SPEC_METHOD Triage

This is a design reframe over the Sidecar selector. The Product and Project
registry model do not change. The selector realization changes from fixed
asset-list projections to a reusable navigator grammar.

Lawful re-entry point: Design, then code.

## STDO-UX Execution Contract

- `State`: active provider, group collapsed/sort state, and pinned folder set
  are explicit UI state
- `Msg`: provider selection and asset selection remain existing reducer
  messages; folder pinning is local navigator state for this slice
- `Update`: group sort/collapse and pin/unpin actions transform only navigator
  state
- `Cmd`: folder expansion calls the existing filesystem browse contract
- `View`: folders, groups, sort toggles, and asset rows share one compact tree
  grammar

## Initial Implementation Scope

Implement the reusable tree pattern over current Sidecar surfaces:

- Tickets: `tickets/(active backlog completed)`
- Comments: `comments/(codex claude gemini ...)`
- Browse: pinned project-local folders with manual absolute or relative path
  entry, child folder expansion, file rows, and Sidecar viewer opening through
  the existing surface read contract

## Closure Evidence

Implemented the Sidecar navigator as a reusable tree grammar:

- added the `Browse` provider to the Sidecar selector registry
- grouped Tickets by lane with collapsible `active`, `backlog`, and
  `completed` groups
- grouped Comments by author with the same tree controls
- added per-group `T`, `A`, and `R` controls for time sort, alpha sort, and
  reverse ordering
- added default project folder pins for `.ai-workspace/tickets`,
  `.ai-workspace/comments`, `specification`, and `build_tenants`
- added manual folder pin and unpin actions backed by local navigator state
- expanded pinned folders through the existing `/api/fs/browse` contract
- extended that browse contract with backwards-compatible `includeFiles=1`
- opened file rows in Sidecar viewer tabs through the existing `/api/surface`
  read contract

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar selector groups|sidecar browse navigator"`: 2 passed
- `npm run test:e2e`: 25 passed

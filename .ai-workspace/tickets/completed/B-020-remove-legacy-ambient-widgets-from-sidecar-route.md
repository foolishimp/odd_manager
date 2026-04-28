---
id: B-020
title: Remove legacy ambient widgets from Sidecar route only
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the Sidecar route self-contained by removing the legacy OddBoard and Local Shell Workspace widgets from that route only.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/routes/WorkspaceRoute.tsx, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-019
dependencies:
  - B-019 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator confirmed the Sidecar route is close and requested removal of the legacy OddBoard and Local Shell Workspace from the Sidecar only.
target_truth: Sidecar is a self-contained route surface. The legacy OddBoard and Local Shell Workspace remain available on other manager pages, but do not render or initialize on the Sidecar page.
superseded_truth: WorkspaceRoute renders OddBoard and Local Shell Workspace before every selected page, including Sidecar, duplicating Sidecar-owned info and shell workspaces.
closure_law: This ticket closes only when the ambient OddBoard/Local Shell pair is moved behind a non-Sidecar route boundary, the Sidecar design module records the exclusion rule, and build plus Sidecar wave verification pass.
evaluation_criteria:
  - OddBoardWidget is not rendered for selectedPage sidecar
  - OddTermWorkspaceWidget is not rendered for selectedPage sidecar
  - ambient console state polling is not initialized solely for the Sidecar page
  - non-Sidecar pages still render the ambient widget pair
  - npm run build and npm run test:sidecar-wave pass
proof_surface:
  - build_tenants/react_vite/src/routes/WorkspaceRoute.tsx
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - npm run build
  - npm run test:sidecar-wave
non_closure_conditions:
  - Sidecar route still displays ODDBOARD
  - Sidecar route still displays Local Shell Workspace
  - legacy ambient widgets are removed from all pages instead of Sidecar only
  - hiding occurs only through CSS while effects still initialize for Sidecar
---

## STDO Reading

This is a UX realization refactor over route composition. The Sidecar now owns
its info browser and shell workspace. The old ambient OddBoard and Local Shell
Workspace remain useful on the rest of the manager, but they are duplicate
workspace surfaces on the Sidecar route.

The lawful correction is route-local exclusion, not global retirement.

## Closure Evidence

- `WorkspaceRoute` now mounts `AmbientWorkspaceWidgets` only when
  `selectedPage !== "sidecar"`.
- `useOddConsoleState` moved inside `AmbientWorkspaceWidgets`, so the legacy
  ambient console polling effects do not initialize solely for the Sidecar
  route.
- Sidecar route still mounts `workspace-view workspace-view--sidecar` with
  `SidecarPanel`.
- The Sidecar design module records B-020 as a legacy ambient widget exclusion
  rule.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 85 Node tests and 7 Python tests.
- Headless Chromium probe verified:
  - before Sidecar: `#agent-console-widget=true`,
    `#terminal-workspace-widget=true`
  - after selecting Sidecar: `#agent-console-widget=false`,
    `#terminal-workspace-widget=false`,
    `.workspace-view--sidecar=true`, `.sidecar-panel=true`
  - Sidecar route and panel both measured `1376px` wide at a `1440px`
    viewport.

---
id: B-019
title: Make Sidecar route full-width under STDO-UX
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove the inherited two-column workspace route constraint so Sidecar widgets span the full available browser content width.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/routes/WorkspaceRoute.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-018
dependencies:
  - B-018 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator observed that Sidecar widgets only fill roughly 60 percent of the browser viewport after the shell workspace layout update.
target_truth: Sidecar is hosted in a full-width single-column route container. Its internal workspaces fill the available browser content width instead of inheriting the default two-column workspace grid.
superseded_truth: Sidecar is mounted in the default two-column `.workspace-view`, causing it to occupy only the first grid column while the second implicit column remains empty.
closure_law: This ticket closes only when the Sidecar route wrapper has a sidecar-specific full-width class, the default two-column workspace grid no longer constrains Sidecar width, the design module records the route width law, and build plus Sidecar wave verification pass.
evaluation_criteria:
  - Sidecar route wrapper uses a sidecar-specific full-width class
  - default two-column `.workspace-view` no longer constrains Sidecar width
  - Sidecar panels render at full content width in browser observation
  - npm run build and npm run test:sidecar-wave pass
proof_surface:
  - build_tenants/react_vite/src/routes/WorkspaceRoute.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - npm run build
  - npm run test:sidecar-wave
non_closure_conditions:
  - Sidecar route still uses the default two-column workspace grid
  - Sidecar width depends on inline route sizing instead of a named UX rule
  - shell widgets fill only the first workspace grid column
---

## STDO Reading

This is a UX realization refactor over route containment. B-018 made the shell
workspace full-width inside Sidecar, but the route shell still constrained the
whole Sidecar to the first column of the default workspace grid.

The lawful correction is to give the Sidecar route its own one-column
full-width container and record that as a design rule.

## Closure Evidence

- Sidecar route wrapper now uses `workspace-view workspace-view--sidecar`.
- `workspace-view--sidecar` declares a one-column full-width grid and stretches
  its `sidecar-panel` child to `width: 100%`.
- The Sidecar design module records B-019 as a route width rule.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 85 Node tests and 7 Python tests.
- Headless Chromium layout probe at 1440px viewport measured:
  - shell width: 1440px
  - Sidecar route width: 1376px
  - Sidecar panel width: 1376px
  - computed Sidecar route grid columns: `1376px`

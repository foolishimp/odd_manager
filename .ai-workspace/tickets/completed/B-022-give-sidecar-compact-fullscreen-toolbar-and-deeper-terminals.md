---
id: B-022
title: Give Sidecar compact full-screen toolbar and deeper terminals
type: design_reframe
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Let Sidecar reclaim the vertical space owned by the general Odd Manager hero header and make the bottom terminal dock deep enough for real shell work.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/layout/AppShell.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-021
dependencies:
  - B-021 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator accepted the workbench start and requested Sidecar take control of the full screen, replace the large top header with a compact toolbar, and make terminals much longer, roughly 25 to 50 lines.
target_truth: Sidecar runs under a compact top toolbar shell instead of the full Odd Manager hero header. The Sidecar workbench fills the reclaimed viewport height, and the bottom terminal dock supports deeper terminal output.
superseded_truth: Sidecar renders below the full general-purpose Odd Manager header and its terminal dock is too shallow for shell work.
closure_law: This ticket closes only when selectedPage sidecar uses compact top chrome, the Sidecar workbench starts near the top of the viewport, terminal host height is increased substantially, non-Sidecar pages keep the existing header, and build plus Sidecar wave verification pass.
evaluation_criteria:
  - AppShell applies compact chrome only for selectedPage sidecar
  - Sidecar top chrome is a toolbar, not the large title/summary header
  - Sidecar workbench height is based on the reclaimed viewport
  - bottom terminal dock supports a deeper line budget
  - non-Sidecar pages retain the existing header layout
  - npm run build and npm run test:sidecar-wave pass
proof_surface:
  - build_tenants/react_vite/src/layout/AppShell.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - npm run build
  - npm run test:sidecar-wave
non_closure_conditions:
  - Sidecar still starts below the large hero header
  - compact shell applies globally to all pages
  - terminal dock remains capped at the shallow previous height
  - toolbar text overlaps or wraps into a tall header at desktop width
---

## STDO Reading

This is a Sidecar route chrome reframe. The product behavior and Sidecar effect
surface stay stable.

The Sidecar route is a workbench. It should use compact toolbar chrome and own
the remaining viewport. The general Odd Manager header remains valid for the
other pages.

## Closure Evidence

- `AppShell` now applies `shell--sidecar` only when `selectedPage === "sidecar"`.
- Sidecar route chrome is compact toolbar-style CSS:
  - smaller title treatment
  - hidden long subtitle and identity pills
  - one-line scrollable nav
  - compact workspace/status/action controls
- Non-Sidecar pages retain the existing `shell` class and header layout.
- Sidecar workbench height now derives from the reclaimed viewport.
- Bottom terminal dock now receives the dominant workbench height and uses a
  compact shell manager.
- Bottom terminal host height now targets a visible 25-line floor at the
  current xterm metrics, with room to grow on taller viewports.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 86 Node tests and 7 Python tests.
- Chromium geometry probe at 1440x900 verified:
  - non-Sidecar header: 261px high, route starts at 317px
  - Sidecar header: 74px high, route starts at 97px
  - Sidecar workbench: 1416px by 806px
  - bottom dock: 612px high
  - terminal host: 378px high, approximately 25 lines
  - terminal host bottom aligns to the dock bottom
  - no console warnings or errors

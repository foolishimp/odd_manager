---
id: B-053
title: Pin Browse to bottom and compact the Sidecar selector rail
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Keep Browse as the bottom management control and tune the selector rail to a compact toolbar style.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: medium
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T05:48:05Z
build_tenant: react_vite
dependencies:
  - B-052 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar left selector rail
intake_source: Operator observed that Browse should always be at the bottom of the selector rail, and that rail typography can be compressed to read like a compact left toolbar.
target_truth: Browse is the pinned bottom management control for folder discovery and pin recovery; active navigators and pinned folders occupy the upper stack in compact toolbar styling.
superseded_truth: Browse participates in normal provider ordering above pinned folders, and selector cells consume more vertical space than a toolbar needs.
closure_law: This ticket closes only when Browse renders at the bottom of the rail, the rail is compacted, and browser proof asserts the ordering and density.
evaluation_criteria:
  - Browse is rendered in a bottom rail group
  - Projects, Tickets, Comments, Sessions, and pinned folders render in the upper rail stack
  - Browser proof asserts Browse is the last rail button in document order
  - Browser proof asserts rail cells are compact enough for toolbar use
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor over the B-052 selector implementation. The
product model and UX method do not change. Browse remains a management surface;
its rail placement and density are corrected.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented the rail placement and density correction:

- split the Sidecar selector rail into an upper navigator stack and bottom
  management zone
- kept Browse fixed in the bottom zone above the collapse toggle
- compacted rail cells to toolbar-like density
- reduced rail glyph and count typography to match the compact activity rail
  role
- added browser assertions that Browse is the last rail button and that rail
  cell typography stays compact

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar browse navigator"`: 1 passed
- `npm run test:e2e`: 25 passed

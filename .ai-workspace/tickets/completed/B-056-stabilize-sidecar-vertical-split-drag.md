---
id: B-056
title: Stabilize Sidecar vertical split drag behavior
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Ensure Sidecar vertical pane split handles track pointer movement smoothly without jumpy compounded resizing.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T07:25:00Z
build_tenant: react_vite
dependencies:
  - B-040 completed
  - B-055 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar viewer and terminal pane split handles
intake_source: Operator observed that the vertical drag bar is not tuned correctly and jumps around.
target_truth: Vertical split handles resize adjacent Sidecar panes by stable incremental pointer deltas; dragging away and back returns panes near their original widths.
superseded_truth: Split handles send start-relative movement as a repeated delta, causing compounded resize jumps during multi-step pointer motion.
closure_law: This ticket closes only when the split handle emits incremental drag deltas, viewer and terminal vertical split proof covers out-and-back movement, and build plus browser verification pass.
evaluation_criteria:
  - viewer vertical split handle expands adjacent panes smoothly
  - terminal vertical split handle expands adjacent panes smoothly
  - dragging a vertical split handle away and back leaves adjacent pane widths near their starting widths
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor over the existing split-pane workbench. Product
meaning and UX structure stay stable. The fault is local drag math: reducers
apply `deltaRatio` incrementally, while the pointer handler was producing a
start-relative delta on every move.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented stable vertical split drag behavior:

- `PaneSplitHandle` now stores the last pointer position during drag.
- pointer movement dispatches incremental `deltaRatio`, matching the reducer
  contract for `viewer/resize-boundary` and `terminal/resize-boundary`
- viewer and terminal browser proof now drags a split handle right, then back
  left, and asserts the adjacent pane widths return close to their starting
  widths

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar panes add vertical splits"`: 1 passed
- `npm run test:sidecar-wave`: 115 Node tests and 7 Python tests passed
- `npm run test:e2e -- --grep "creates a live local shell"`: 1 passed
- `npm run test:e2e`: 26 passed

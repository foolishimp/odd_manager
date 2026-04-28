---
id: B-068
title: Add zoom and pan controls to Sidecar document viewer
type: feature
ticket_category: ordinary
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Add usable zoom, pinch, pan, reset, and fit behavior for markdown, Mermaid, code, and PDF document panes.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/components, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-04-29
build_tenant: react_vite
dependencies:
  - B-066 backlog
  - B-067 backlog
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar document viewer panes
library_usage: evaluate_and_consume
governing_library_candidate: react-zoom-pan-pinch
library_rationale: Candidate library supports zoom, pan, pinch, touchpad, mouse, and normal HTML/SVG content without hand-rolling gesture math.
intake_source: Operator request for pinch or +/- zoom and two-finger panning around markdown and Mermaid documents.
target_truth: Each Sidecar document pane supports explicit zoom controls, reset, fit-to-width, and pointer/touchpad panning without adding a tall toolbar or stealing terminal workspace height.
superseded_truth: Document panes are fixed-scale scroll containers; large markdown and Mermaid surfaces cannot be inspected ergonomically.
closure_law: This ticket closes only when zoom/pan behavior is keyboard and pointer accessible, scoped to the selected document pane, replayable as UX-local state where needed, and covered by browser proof.
evaluation_criteria:
  - selected document pane exposes compact zoom out, zoom in, reset, and fit controls
  - pinch/trackpad/pointer panning works for oversized Mermaid and markdown content
  - zoom state is scoped to the pane or document tab and does not leak across unrelated panes
  - controls fit into the existing compact viewer chrome and do not introduce another full-width row
  - zoom/pan state is modeled as UX-local state where product behavior depends on it
  - disabled states are clear at min/max zoom
  - Playwright proof verifies zoom transform changes and reset restores baseline
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/src/components
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - browser zoom is the only solution
  - zoom controls appear in a new tall toolbar
  - panning traps normal page scrolling outside the active document viewport
  - library state is opaque where tests need deterministic replay
---

## SPEC_METHOD Triage

This is a realization refactor after B-066. The product capability is document
inspection. The realization adds controlled viewport navigation to the shared
document viewer.

Lawful re-entry point: Realization.

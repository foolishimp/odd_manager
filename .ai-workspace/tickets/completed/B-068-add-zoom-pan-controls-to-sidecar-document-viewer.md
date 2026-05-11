---
id: B-068
title: Add zoom and pan controls to Sidecar document viewer
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Add usable zoom, pinch, pan, reset, and fit behavior for markdown, Mermaid, and code document panes.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/components, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-05-01T00:55:00+10:00
build_tenant: react_vite
sprint: SPRINT-2026-04-30-sidecar-document-viewer
review_status: accepted_by_code_review
dependencies:
  - B-066 completed
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
target_truth: Each Sidecar markdown, Mermaid, and code document pane supports explicit zoom controls, reset, fit-to-width, and pointer/touchpad panning without adding a tall toolbar or stealing terminal workspace height.
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

## Sprint Boundary

This ticket is admitted into
`.ai-workspace/sprints/SPRINT-2026-04-30-sidecar-document-viewer.md` after the
B-066 design gate. It may use UX sprint compliance escrow for screenshots,
walkthrough notes, accessibility review, and Msg-replay updates, but zoom, pan,
fit, and reset state must remain explicit under the shared `DocumentViewer`
carrier.

## Backlog Review 2026-05-01

No shared document-viewer zoom, pan, reset, or fit state is implemented yet.
This remains consolidated under the document-viewer sprint and should follow
the B-066 carrier state model before it is closed.

## Priority Reprice 2026-05-01

This ticket is in the active focus set with B-067 and B-070. PDF zoom behavior
is no longer part of this ticket's immediate closure path; B-069 carries that
future surface.

## Closure Review 2026-05-01

Accepted. Sidecar file surfaces now render through `DocumentViewer` with
compact zoom out, zoom in, fit-width, and reset controls. Zoom/fit state is
scoped to surface viewer tabs, replayed through `sidecar-state.ts`, persisted
through layout profiles, and pruned when tabs close. Pointer drag and normal
scroll-container behavior provide local panning without hiding product-relevant
zoom state in component-only state.

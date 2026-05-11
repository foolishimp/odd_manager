---
id: B-077
title: Pin document viewer sizing controls in compact toolbar
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make Sidecar document viewer sizing controls 30% smaller, pin them to the top-right of the viewer independent of document scrolling, and carry the current surface path on the same thin toolbar.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/components/DocumentViewer.tsx, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: medium
triaged_at: 2026-05-01
created_at: 2026-05-01
updated_at: 2026-05-01
build_tenant: react_vite
review_status: implemented_and_verified
dependencies:
  - B-066 completed
  - B-068 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar document viewer panes
intake_source: Operator request to make sizing options smaller, tighter in the top-right corner, pinned independent of scrolling, and sharing a thin toolbar with the folder/path name.
target_truth: Each Sidecar document viewer pane has one compact pinned toolbar with the current surface path on the left and the sizing controls on the right. Document scroll never moves the toolbar.
closure_law: This ticket closes only when the shared DocumentViewer carrier owns the toolbar layout, the existing document viewer State/Msg zoom contract remains unchanged, and browser proof verifies toolbar path, compact control size, and pinned behavior during scroll.
evaluation_criteria:
  - sizing controls are about 70% of the previous navigator control footprint
  - sizing controls are aligned tightly at the top-right of the document viewer
  - the current surface path appears on the same toolbar and preserves the previous displayed value
  - the toolbar remains visible and position-stable while document content scrolls
  - zoom, fit, and reset behavior remain reducer-owned through existing Sidecar document messages
  - Playwright proof covers path text, compact sizing, and pinned-scroll behavior
  - `npm run build` passes
  - focused Playwright document-viewer proof passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/components/DocumentViewer.tsx
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - controls shrink but remain inside scrolling document content
  - toolbar duplicates the surface path instead of consolidating the current label
  - zoom/fit/reset semantics move out of the existing State/Msg path
  - narrow panes clip or overlap the sizing controls and path label
---

## SPEC_METHOD Triage

This is a realization refactor over the existing document viewer capability.
B-066 defines the shared carrier and B-068 defines the zoom/fit/reset state
contract. This ticket changes the projection chrome and proof, not product
truth.

Lawful re-entry point: Realization.

## STDO-UX Execution Contract

The toolbar is view projection over existing `DocumentDescriptor` and
`DocumentViewerState` facts:

- `DocumentDescriptor.relativePath` supplies the current surface path label.
- `DocumentViewerState.zoom` and `fit` continue to drive sizing controls.
- existing Sidecar `document/zoom`, `document/fit-width`, and `document/reset`
  messages remain the only state-changing paths.

No new product-truth-changing UX message is introduced.

## Closure Review 2026-05-01

Accepted under STDO-UX.

Implementation state:

- `DocumentViewer` renders one pinned compact toolbar with the surface path and
  zoom controls.
- `SurfaceInspector` no longer renders a duplicate path label above file
  viewers.
- zoom, fit, and reset still dispatch the existing Sidecar document messages.
- browser proof verifies the toolbar path, compact control width, and stable
  toolbar position after document scroll.

Follow-up refinement:

- zoom in/out now preserve the document content point at the center of the
  current viewport, so zooming into Mermaid diagrams and other observed content
  does not jump back to the top-left.
- focused Playwright proof now verifies center preservation across zoom.

Verification:

- `npm run build` passed.
- focused Playwright proof passed:
  `npx playwright test tests/e2e/odd-manager-smoke.spec.ts -g "sidecar document viewer renders Mermaid, zoom controls, and highlighted source files"`.

---
id: B-069
title: Add PDF surface viewing to Sidecar document viewer
type: feature
ticket_category: ordinary
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Allow PDF files in managed projects and pinned folders to open inside Sidecar document panes.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/server/index.mjs, build_tenants/react_vite/src/components, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: low
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-05-01T00:22:00+10:00
build_tenant: react_vite
sprint: SPRINT-2026-04-30-sidecar-document-viewer
review_status: deferred_operator_deprioritized_pdf
dependencies:
  - B-066 completed
  - B-068 backlog
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar document viewer PDF surfaces
library_usage: evaluate_and_consume
governing_library_candidate: react-pdf
library_rationale: Candidate library wraps PDF.js with React `Document` and `Page` components and is suitable for viewing existing PDFs in the browser.
intake_source: Operator request for PDF viewing in addition to markdown, Mermaid, and source code.
target_truth: PDF files can be selected from Sidecar project/folder navigation and viewed in a document pane with page navigation and shared zoom/pan behavior.
superseded_truth: Sidecar file surfaces assume text content and cannot render PDFs.
closure_law: This ticket closes only when PDF delivery is designed without base64 UI-state bloat, Vite/PDF.js worker configuration is explicit, and Sidecar can render a PDF fixture in browser proof.
evaluation_criteria:
  - design records the PDF binary/blob surface path
  - server route serves PDF content safely from the managed project root only
  - React/PDF.js worker configuration is local to the PDF viewer module and works under Vite
  - PDF pages render inside Sidecar viewer panes
  - page number, page count, loading state, and render error are explicit UI facts
  - zoom/pan behavior from B-068 applies to PDF pages
  - large PDFs do not get stored as base64 strings in reducer state
  - Playwright proof opens a PDF fixture and observes rendered page content
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/server/index.mjs
  - build_tenants/react_vite/src/components
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - PDFs open in a new browser tab instead of Sidecar
  - file routes can escape the managed project root
  - PDF content is encoded into long JSON payloads by default
  - page and load state are hidden inside an unobservable library component
---

## SPEC_METHOD Triage

This starts as a design reframe because the current surface API is text-first.
The binary delivery and viewer contract must be designed before implementation.

Lawful re-entry point: Design.

## Sprint Boundary

This ticket is coordinated by
`.ai-workspace/sprints/SPRINT-2026-04-30-sidecar-document-viewer.md`, but its
PDF route and binary delivery questions remain design-reframe work. The sprint
may batch local UX evidence after the route is designed; it cannot escrow a
file-route, Project-root containment, PDF.js worker, or binary-payload carrier
gap.

## Backlog Review 2026-05-01

No PDF route, same-origin blob/URL carrier, page state, or PDF.js worker
configuration is implemented yet. This remains a design-reframe item inside the
document-viewer sprint and cannot close through UX escrow.

## Priority Reprice 2026-05-01

PDF is intentionally deprioritized behind B-067 Mermaid, B-068 zoom/pan, and
B-070 syntax highlighting. Do not pull PDF route, binary payload, or PDF.js
worker work into the current UX sprint unless the operator reprices it back
into active scope.

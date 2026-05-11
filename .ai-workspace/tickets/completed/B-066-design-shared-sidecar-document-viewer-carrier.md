---
id: B-066
title: Design shared Sidecar document viewer carrier
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Establish a governed shared document viewer carrier for markdown, Mermaid, code, and PDF surfaces instead of expanding one-off Sidecar rendering.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/components/MarkdownDocument.tsx, build_tenants/react_vite/src/components, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/inspector/InspectorPanel.tsx, build_tenants/react_vite/src/features/requirements/RequirementsWorkspace.tsx, build_tenants/react_vite/src/routes/WorkspaceRoute.tsx
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-04-29T16:21:13Z
completed_at: 2026-04-29T16:21:13Z
build_tenant: react_vite
sprint: SPRINT-2026-04-30-sidecar-document-viewer
dependencies:
  - B-065 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar document surfaces and shared document consumers
library_usage: evaluate_and_consume
governing_library_candidates:
  - react-markdown
  - remark-gfm
  - mermaid
  - react-zoom-pan-pinch
  - react-pdf
  - shiki
library_rationale: Use mature rendering libraries for document semantics while keeping selection, zoom, pan, page, and load/error state in the typed UX state model.
intake_source: Operator request to restore old oddboard markdown/Mermaid viewing, add zoom/pan, add PDF, and add syntax highlighting using off-the-shelf libraries where possible.
target_truth: Sidecar document viewing is a shared carrier with explicit format adapters, typed viewer state, governed library choices, and reusable projection across Sidecar and other document consumers.
superseded_truth: File surfaces are rendered directly through `MarkdownDocument`, which gives partial markdown/Mermaid behavior but does not define a complete document-viewing contract.
closure_law: This ticket closes only when the design module defines the document viewer carrier, library choices are recorded with constraints, UX-local state is typed, and downstream tickets have clear implementation boundaries.
evaluation_criteria:
  - design records a `DocumentViewer` carrier and adapter model
  - markdown, mermaid, code, and PDF format responsibilities are separated
  - document selection, zoom, pan, page, load status, and render error are explicit UI facts
  - library choices include security and bundle-size notes
  - Mermaid security level is explicitly chosen and cannot remain accidental `loose` configuration
  - PDF binary/blob delivery path is specified without storing large base64 payloads in UI state
  - syntax highlighting bundle strategy is specified for the required languages
  - Sidecar, Inspector, Requirements, WorkspaceRoute, and old OddBoard consumers have a migration path
  - no implementation ticket depends on ambiguous "make docs work" scope
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md#35-b-066-shared-document-viewer-carrier-rule
  - .ai-workspace/sprints/SPRINT-2026-04-30-sidecar-document-viewer.md
  - .ai-workspace/tickets/backlog/B-067-restore-mermaid-diagram-rendering-proof-in-sidecar-docs.md
  - .ai-workspace/tickets/backlog/B-068-add-zoom-pan-controls-to-sidecar-document-viewer.md
  - .ai-workspace/tickets/backlog/B-069-add-pdf-surface-viewing-to-sidecar-document-viewer.md
  - .ai-workspace/tickets/backlog/B-070-add-syntax-highlighting-to-sidecar-code-surfaces.md
non_closure_conditions:
  - a new renderer is embedded only inside `SidecarPanel`
  - zoom or pan state is stored only in library-internal invisible state
  - PDF support is specified as base64 document state
  - Mermaid XSS/security posture is left implicit
---

## SPEC_METHOD Triage

This is a design reframe. The product already needs document inspection inside
the manager. The realization must move from component-local markdown rendering
to a shared document viewer carrier.

Lawful re-entry point: Design.

## First Pass Library Position

Keep the existing markdown stack where it is fit:

- `react-markdown`
- `remark-gfm`
- `mermaid`

Evaluate and, if confirmed, consume:

- `react-zoom-pan-pinch` for HTML/SVG document zoom, pan, pinch, reset, and fit
- `react-pdf` for PDF document/page rendering over PDF.js
- `shiki` for VS Code-like syntax highlighting with explicit language/theme bundles

## STDO-UX Execution Contract

The viewer may call rendering libraries, but UX state remains explicit:

- active document id
- document format
- active page
- zoom level
- pan position
- fit mode
- load status
- render error

These facts are not product truth. They are view state governed by UX_METHOD.

## UX Sprint Governance

B-066 was worked under
`.ai-workspace/sprints/SPRINT-2026-04-30-sidecar-document-viewer.md` as the
standalone design gate for the document viewer wave.

This ticket did not use UX compliance escrow. It closed by satisfying its own
design-reframe closure law. Downstream realization tickets may use sprint
escrow for local screenshots, walkthroughs, accessibility review, and
Msg-replay updates, but they must not hide carrier, security, binary-delivery,
or product-truth drift.

## Closure Evidence

Closed at `2026-04-29T16:21:13Z`.

Design module updated:

- added `DocumentViewer` as the shared carrier
- separated `DocumentDescriptor`, `DocumentSource`, `DocumentViewerState`,
  `DocumentViewerMsg`, `DocumentViewerAdapter`, and `DocumentRenderEffect`
- separated markdown, Mermaid, code, PDF, unknown text, and unsupported binary
  adapters
- made document format, page, zoom, pan, fit, load status, and render error
  explicit UI facts
- recorded markdown, Mermaid, zoom/pan, PDF, and syntax-highlighting library
  decisions and constraints
- selected Mermaid `securityLevel: "strict"` with `htmlLabels: false` as the
  governed default
- specified PDF delivery as same-origin URL or bounded blob reference scoped to
  the active managed Project root, not reducer-stored base64
- specified Shiki bounded language/theme bundle strategy for Python,
  TypeScript, JavaScript, JSON, YAML, Java, Scala, and Rust
- defined the consumer migration path for Sidecar, Inspector, Requirements,
  WorkspaceRoute, and legacy OddBoard surfaces
- established B-067, B-068, B-069, and B-070 as downstream implementation
  boundaries over this carrier

Validation:

- markdown integrity check passed for trailing whitespace across touched
  markdown surfaces
- no executable code tests were run because B-066 is design-only

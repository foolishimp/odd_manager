---
id: B-067
title: Restore Mermaid diagram rendering proof in Sidecar docs
type: bug
ticket_category: ordinary
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make Mermaid diagrams a proved Sidecar document-viewer capability rather than an incidental markdown component behavior.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/components/MarkdownDocument.tsx, build_tenants/react_vite/src/components, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-04-29
build_tenant: react_vite
dependencies:
  - B-066 backlog
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar markdown document panes
library_usage: consume
governing_library: mermaid
library_rationale: Mermaid is already installed and matches existing workspace documentation conventions; the missing work is sidecar integration proof, security posture, and zoom readiness.
intake_source: Operator request that old oddboard markdown rendering, including Mermaid diagrams, be restored in Sidecar document panes.
target_truth: Markdown files opened in Sidecar document panes render fenced Mermaid diagrams as visible diagrams with deterministic error fallback and theme alignment.
superseded_truth: Mermaid rendering exists inside `MarkdownDocument`, but Sidecar does not prove it for document surfaces and the viewer has no explicit diagram capability contract.
closure_law: This ticket closes only when a Mermaid fixture renders in Sidecar split viewer panes, render failures show a useful fallback, the configured security level is intentional, and automated tests cover the behavior.
evaluation_criteria:
  - markdown code fences with `mermaid` language render as SVG/diagram content in Sidecar file surfaces
  - raw Mermaid source is not shown on the success path
  - invalid Mermaid source renders a bounded error state with source fallback
  - diagram rendering follows current light/dark/dark-grey theme selection
  - Mermaid security level is taken from B-066 design and recorded in code comments or tests
  - split viewer panes can each render Mermaid without id collisions
  - Playwright proof opens a fixture markdown file through the Sidecar and observes rendered diagram output
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/src/components/MarkdownDocument.tsx
  - build_tenants/react_vite/src/components
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - Mermaid renders only in old OddBoard but not Sidecar
  - successful diagrams require manual browser refresh
  - diagrams render by injecting ungoverned unsafe HTML
  - the test only asserts raw markdown text
---

## SPEC_METHOD Triage

This is a realization refactor after B-066 defines the carrier. The desired
document capability is stable; the implementation needs to make the capability
explicit and proved in Sidecar.

Lawful re-entry point: Realization.

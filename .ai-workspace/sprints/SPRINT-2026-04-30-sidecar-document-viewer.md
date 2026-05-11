# SPRINT-2026-04-30 Sidecar Document Viewer

- id: SPRINT-2026-04-30-sidecar-document-viewer
- title: Sidecar document viewer carrier and UX iteration wave
- status: closed_focus_complete_pdf_deferred
- goal: realize-ai-workspace-topology-and-agent-interoperability
- opened_at: 2026-04-29T16:17:23Z
- updated_at: 2026-05-01T00:55:00+10:00

## Authority

- specification/GOALS.md#G-002---Publish-the-first-odd_sdlc-domain-UI-pack-boundary
- specification/GOALS.md#G-004---Materialize-the-generated-odd_sdlc-governance-surfaces-in-this-workspace
- specification/PRODUCT.md#File-Path-Memory
- specification/requirements/04-orientation-and-navigation.md#REQ-OM-NAV-011---Non-ODD-Projects-remain-admissible-for-generic-workspace-use
- specification/requirements/10-entry-lenses-and-delivery-workspaces.md#REQ-OM-LNS-004---Shared-widget-architecture-is-reusable-across-entry-lenses
- build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
- specification_methodology v1.4.0 sprint execution-control and UX compliance-escrow law

## Scope

Define and realize the shared Sidecar document viewer carrier for markdown,
Mermaid, code, and zoom/pan document surfaces. PDF remains a known future
surface but is deprioritized out of the immediate UX iteration.

## Excluded Boundaries

- no GTL/ABG runtime semantics changes
- no odd_sdlc TypeScript query-contract changes
- no new product-truth file mutation path
- no file route that can escape the active managed Project root
- no document payloads stored as long base64 strings in reducer state
- no hidden DOM-only document-viewer state where replay or closure depends on it
- no Mermaid unsafe rendering posture left implicit

## Expected Change Classes

- design_reframe for B-066
- realization_refactor for markdown, Mermaid, zoom/pan, and code highlighting implementation

## Included Tickets

- B-066: completed standalone design gate for the shared `DocumentViewer` carrier
- B-067: completed Mermaid rendering proof
- B-068: completed zoom and pan controls
- B-070: completed syntax highlighting
- B-069: deferred PDF surface viewing after the focused document UX pass

## Sprint Governance

B-066 is not UX escrow. It is the design gate that defines the carrier,
adapter boundaries, library constraints, and downstream ticket seams. It may
close only by satisfying its own design-reframe closure law.

After B-066 closes, B-067, B-068, and B-070 may use sprint compliance escrow
for local screenshots, walkthrough notes, accessibility review, and Msg-replay
proof updates while implementation iterates. B-069 is not part of the immediate
focus set; any later binary-delivery or file-route design question remains a
design-reframe item and cannot be hidden in escrow.

## Closure

- closure_trigger: timebox, changed surface volume, or operator close request
- closure_law: sprint close performs a forensic walkthrough of each changed
  document state, carrier adapter, accessibility finding, replay proof, and
  file-route boundary against the authority list above
- proof_surface: design module, ticket closure notes, screenshots or browser
  walkthrough artifacts, Msg-replay tests where state behavior changes, and
  e2e proof for supported document formats
- deferred_compliance: screenshots, accessibility review, Msg-replay updates,
  and visual polish for realization tickets only
- non_closure_conditions: carrier design remains implicit; PDF route can
  escape managed Project root; Mermaid security posture is implicit; zoom/pan
  state is hidden from replay; product-truth or runtime semantics drift is
  discovered but not repriced
- paydown_policy: local UX debt may become explicit paydown tickets; design,
  product, runtime, data-contract, carrier, or security drift must re-enter
  through standalone tickets before sprint close

## Current Review State

- `accepted`: B-066 design gate. The Sidecar design module now defines the
  shared `DocumentViewer` carrier, adapter model, explicit UI facts, library
  constraints, and downstream ticket seams.
- `accepted`: B-067 Mermaid rendering enters through `DocumentViewer` with
  strict security, deterministic ids, and e2e SVG proof.
- `accepted`: B-068 zoom, reset, fit-width, and pointer/scroll panning are
  implemented through surface-tab-scoped document viewer state.
- `deferred`: B-069 PDF surface route and adapter are not implemented and are
  intentionally deprioritized behind B-067, B-068, and B-070.
- `accepted`: B-070 syntax highlighting is implemented through Shiki and the
  shared code adapter for markdown fences and direct source files.
how 
  browser proof passed

B-069 remains backlog/deferred. PDF requires a later route/adapter decision and
was intentionally excluded from this cost-optimized UX sprint cut.

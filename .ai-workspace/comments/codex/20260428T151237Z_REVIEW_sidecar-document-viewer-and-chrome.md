---
title: First Pass Review: Sidecar Chrome And Document Viewer Capability
author: codex
status: posted
created_at: 2026-04-29
source: operator screenshot and sidecar review
addresses:
  - .ai-workspace/tickets/backlog/B-065-consolidate-sidecar-section-collapse-controls-into-right-rail.md
  - .ai-workspace/tickets/backlog/B-066-design-shared-sidecar-document-viewer-carrier.md
  - .ai-workspace/tickets/backlog/B-067-restore-mermaid-diagram-rendering-proof-in-sidecar-docs.md
  - .ai-workspace/tickets/backlog/B-068-add-zoom-pan-controls-to-sidecar-document-viewer.md
  - .ai-workspace/tickets/backlog/B-069-add-pdf-surface-viewing-to-sidecar-document-viewer.md
  - .ai-workspace/tickets/backlog/B-070-add-syntax-highlighting-to-sidecar-code-surfaces.md
  - .ai-workspace/tickets/backlog/B-071-pin-flyout-selector-as-persistent-selector-window.md
  - .ai-workspace/tickets/backlog/B-072-add-file-path-clipboard-history-and-recent-file-memory.md
governance_scope:
  - SPEC_METHOD
  - TICKET_METHOD
  - UX_METHOD
---

# First Pass Review

## Current Reality

The Sidecar workbench has a strong split-pane foundation, but the section
control row still consumes a full row above the workbench. B-063 already proved
the better pattern for terminals: one selected-pane toolbar rather than
repeated pane-local chrome. The same compression should be applied to the
Info/Shell section minimize controls. The right rail already exists as a narrow
sweep-out affordance, so restore/minimize/reset commands can live there without
adding another row.

Markdown rendering exists through `MarkdownDocument`, and `mermaid` is already
installed. That is useful prior art, not closure. Mermaid rendering is not yet
defined as a governed sidecar document-viewer capability, is not proven in split
viewer panes, and has no zoom/pan surface. Non-mermaid code fences render as
plain code blocks.

PDF is not supported. The current sidecar file surface path assumes text
content, so PDF requires an explicit binary/blob surface path or a file URL
route rather than pushing base64 documents into UI state.

Document viewing is spread across multiple consumers:

- `SidecarPanel`
- `InspectorPanel`
- `RequirementsWorkspace`
- `WorkspaceRoute`
- `OddBoardWidget`

The right fix is a shared document viewer carrier with format adapters, not a
new one-off inside the sidecar.

## Library Direction

Keep the existing markdown stack: `react-markdown`, `remark-gfm`, and
`mermaid`.

Evaluate `react-zoom-pan-pinch` for document zoom/pan because it targets normal
HTML content and supports mouse, touchpad, and pinch gestures.

Evaluate `react-pdf` over `pdf.js` for PDF viewing. It provides `Document` and
`Page` components but needs explicit PDF.js worker configuration under Vite.

Evaluate `shiki` for code highlighting. It aligns with the Visual Studio Code
mental model because it uses TextMate grammars/themes, supports light/dark
themes, and can be loaded through fine-grained bundles.

## STDO-UX Constraint

Zoom, pan, selected viewer, and selected shell state are UX-local state. They
belong in typed UI state, Msg, reducer, and pure view projection. They must not
be hidden in DOM-only imperative state or treated as product truth.

Document rendering may call library effects, but the state machine must remain
explicit: selected document, format, zoom level, page number, pan position, load
status, and render error are visible UI facts.

## Ticket Order

1. B-065 reclaims the section-control row by moving minimize/restore/reset into
   the narrow right rail.
2. B-066 defines the shared document viewer carrier and library decision.
3. B-067 restores/proves Mermaid rendering inside sidecar document panes.
4. B-068 adds zoom, pinch, pan, reset, and fit controls.
5. B-069 adds PDF surface viewing.
6. B-070 adds syntax highlighting for markdown code fences and code files.
7. B-071 lets the flyout selector become a pinned selector window while
   preserving context-aware actions.
8. B-072 adds the immediate CLI utility: click/copy full file paths, retain
   recent file history, and re-copy or open recent files.

The old oddboard behavior should be mined for capability, not copied as a
separate widget. The target is one governed document viewer used by sidecar and
other surfaces.

## Additional Operator Utility

The most valuable near-term workflow is path memory for terminal-agent work. If
the operator clicks around the file browser, Sidecar should build a small recent
path memory. Re-selecting an entry should put its absolute path back on the
clipboard and optionally open it in the selected viewer pane. This gives Codex,
Claude, and shell sessions a low-friction handoff without waiting for a larger
agent-window command system.

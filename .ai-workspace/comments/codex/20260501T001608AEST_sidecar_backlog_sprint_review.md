# Sidecar Backlog Sprint Review

Reviewed the remaining Sidecar backlog under STDO-UX sprint governance.

## Decisions

- B-071 is closed. The persistent selector-window behavior is already
  reducer-owned and now has explicit design law plus e2e proof.
- B-067 is closed. Mermaid rendering now enters through the shared
  `DocumentViewer` carrier with strict Mermaid security and deterministic
  render ids.
- B-068 is closed. Zoom, pan, reset, and fit behavior are implemented through
  surface-tab-scoped document viewer state.
- B-069 remains open but deferred. PDF route, binary carrier, page state, and
  PDF.js worker design are intentionally deprioritized.
- B-070 is closed. Syntax highlighting is implemented through Shiki and the
  shared code adapter for markdown fences and direct source files.

## Consolidation

B-067, B-068, and B-070 were the focused document-viewer sprint set under
`.ai-workspace/sprints/SPRINT-2026-04-30-sidecar-document-viewer.md`; that
focused sprint cut is now complete.

B-069 remains recorded under that sprint as future design work, but it is not
part of the immediate UX iteration.

B-071 is carried by the closed sprint
`.ai-workspace/sprints/SPRINT-2026-05-01-sidecar-selector-window.md`.

## Review Boundary

No ABG, odd_sdlc query-contract, Project registry, or runtime semantics were
changed by this sprint review.

## Closure Proof 2026-05-01

- `npm run build`: passed
- `npm run test:runtime:node`: 128 passed
- `npm run test:sidecar-wave`: 128 node runtime tests and 7 Python runtime
  tests passed
- `npm run test:e2e -- -g "sidecar document viewer renders Mermaid"`: passed

The remaining document-viewer backlog is B-069 PDF, intentionally deferred.

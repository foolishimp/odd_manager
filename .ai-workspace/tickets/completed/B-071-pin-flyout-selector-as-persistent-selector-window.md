---
id: B-071
title: Pin flyout selector as persistent selector window
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Allow the Sidecar flyout selector to be pinned open as a selector window while preserving context-aware actions.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-05-01T00:16:08+10:00
build_tenant: react_vite
sprint: SPRINT-2026-05-01-sidecar-selector-window
dependencies:
  - B-051 completed
  - B-052 completed
  - B-060 completed
  - B-066 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar explorer flyouts and selector windows
intake_source: Operator request to pin the flyout selector as a selector window so files can be browsed while the picker remains open, while retaining context actions such as comment reply.
target_truth: A Sidecar explorer flyout can be pinned into a persistent selector window. The pinned selector stays open while browsing and selecting records, and context-aware actions remain visible for the selected surface type.
superseded_truth: The flyout behaves primarily as a transient picker. Clicking outside or selecting records can interrupt browse flow, and persistent browsing competes with document pane use.
closure_law: This ticket closes only when the design defines transient flyout versus pinned selector-window behavior, implementation keeps the selector open while browsing, context actions remain available per record type, and tests prove pinned/unpinned behavior.
evaluation_criteria:
  - design module records selector flyout, pinned selector window, and context-action rules
  - pin command converts the active flyout into a persistent selector window
  - pinned selector remains open while selecting folders, files, tickets, comments, projects, and sessions
  - unpin returns the selector to transient flyout behavior
  - outside click closes only transient flyouts, not pinned selector windows
  - context-aware actions remain available: comment reply, mark unread/read, ticket transitions, project open/remove, file pin/copy/open
  - pinned selector does not steal focus from terminal input unless the operator explicitly focuses it
  - selection state is explicit in Sidecar UI state and replayable
  - Playwright proof pins the file browser, opens two files, and confirms the selector remains open
  - Playwright proof opens a comment selector and confirms reply action remains available
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - pinning creates a duplicate source of selection truth
  - pinned selector loses existing context actions
  - the selector can only be closed by resetting layout
  - the selector is implemented as a DOM-only open flag outside the reducer
---

## SPEC_METHOD Triage

This is a design reframe. The explorer and context actions already exist. The
new realization state is whether the selector is transient or pinned as a
persistent selector window.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

Pinned selector state is UX-local state:

- active selector provider
- pinned/unpinned mode
- selector focus
- selected row
- expanded folders
- active context action set

The view projects these facts. Context actions remain typed Msg/Cmd paths and
must not be reimplemented as detached button handlers.

## Closure Notes 2026-05-01

Closed under STDO-UX sprint
`.ai-workspace/sprints/SPRINT-2026-05-01-sidecar-selector-window.md`.

Implementation state accepted:

- `SidecarState.ui.infoPinned` is reducer-owned UX state.
- `ui/set-info-pinned` opens the selector and toggles persistent mode without
  command effects.
- pinned mode moves the selector into the workbench grid and shifts the canvas
  right.
- outside pointer close is disabled while pinned and restored when unpinned.
- file, ticket, comment, Project, pinned-folder, and recent-path selection
  reuse existing typed row actions rather than new DOM-only handlers.

B-073 superseded the older assumption that Tickets and Comments selectors are
record-action lists. They are filesystem-backed selectors by default; record
specific actions remain available through record inspectors or later explicit
context-action work.

Verification:

- `runtime/tests/test_sidecar_msg_replay.mjs` covers pin replay and static
  layout contract.
- `tests/e2e/odd-manager-smoke.spec.ts` includes pinned selector browser proof
  for Browse file selection, Tickets selector persistence, Comments file
  selection, outside-click persistence, and unpin close.

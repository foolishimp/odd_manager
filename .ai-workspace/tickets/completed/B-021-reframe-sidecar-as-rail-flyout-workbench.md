---
id: B-021
title: Reframe Sidecar as rail and flyout workbench
type: design_reframe
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Apply VS Code workbench lessons to Sidecar: fixed rails, one selection flyout, large central canvas, and a horizontal bottom terminal workspace.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-020
dependencies:
  - B-020 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator identified VS Code workbench lessons: fixed left, right, and bottom navigation bars; flyouts for context; one selection widget; sidebar tabs for context; large canvases; horizontal terminal treatment.
target_truth: Sidecar is a workbench surface. A fixed left activity rail chooses exactly one selection flyout, the selected object renders in a large central canvas, a fixed right context rail compresses context state, and the terminal workspace occupies a horizontal bottom dock.
superseded_truth: Sidecar renders Projects, Tickets, Comments, inspector, and terminal workspaces as stacked panels with multiple simultaneous selection widgets competing for canvas space.
closure_law: This ticket closes only when Sidecar selection is rail-driven, the info browser is one flyout list at a time, the main inspector becomes the central canvas, terminals remain in a horizontal bottom dock, the UI state changes replay through Sidecar Msg without Cmd effects, and build plus Sidecar wave verification pass.
evaluation_criteria:
  - Sidecar has a fixed left activity rail for Projects, Tickets, and Comments
  - only one selection flyout list is visible at a time
  - main selected-object detail renders in a central canvas
  - right context rail compresses context and selection state
  - terminal sessions remain horizontally managed in a bottom dock
  - rail/flyout and bottom dock state replay through Sidecar Msg without Cmd effects
  - npm run build and npm run test:sidecar-wave pass
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - npm run build
  - npm run test:sidecar-wave
non_closure_conditions:
  - Projects, Tickets, and Comments render as three simultaneous selector columns
  - selection rail state is view-local React state
  - terminal workspace is moved into a vertical side panel
  - central selected-object canvas is squeezed by permanent multi-column selectors
---

## STDO Reading

This is a design reframe of Sidecar layout. The product behavior and effect
surface stay stable: load, select, ticket transition, comment read/reply, shell
spawn, shell close, and terminal attach remain the same.

The realization structure changes from stacked panels to a governed workbench:
fixed left rail, one selection flyout, central canvas, right context rail, and
horizontal bottom terminal dock.

## Closure Evidence

- `SidecarState.ui` now carries `activeInfoSurface` and replays
  `ui/select-info-surface` through `SidecarMsg`.
- `SidecarPanel` now renders a workbench shell:
  - fixed left activity rail for Projects, Tickets, and Comments
  - one selection flyout at a time
  - central selected-object canvas
  - compact right context rail
  - horizontal bottom terminal dock
- The old simultaneous Projects/Tickets/Comments selector columns no longer
  render in the main canvas.
- Terminal dock presentation is capped and metadata-light so it does not
  consume the full page.
- `runtime/tests/test_sidecar_msg_replay.mjs` proves rail/flyout selection
  replay emits no `Cmd`.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 86 Node tests and 7 Python tests.
- Desktop Chromium probe at 1440px verified workbench, rail, flyout, canvas,
  context rail, bottom dock, one active flyout pane, no legacy OddBoard/Local
  Shell nodes, full-width route, and no console warnings or errors.
- Mobile Chromium probe at 390px verified stacked rail, flyout, canvas, context
  rail, bottom dock order, one active flyout pane, no legacy nodes, and no
  console warnings or errors.

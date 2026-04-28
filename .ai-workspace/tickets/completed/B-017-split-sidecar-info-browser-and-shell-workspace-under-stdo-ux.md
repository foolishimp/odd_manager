---
id: B-017
title: Split Sidecar into independently collapsible info browser and shell workspace
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Port the Local Shell Workspace separation pattern into Sidecar so the info browser and shell workspace can be expanded and collapsed independently.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-016
dependencies:
  - B-016 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator accepted the B-016 visual pass but identified that Sidecar still needs the original Local Shell Workspace separation behavior: Sidecar should contain an info browser and a shell workspace, each independently collapsible/expandable.
target_truth: Sidecar is realized as two governed sub-workspaces, `Info Browser` and `Shell Workspace`, with independent collapse state expressed as replayable Sidecar Msg updates and no new product effect paths.
superseded_truth: Sidecar renders as one combined browser/inspector/sessions surface, forcing session work and information browsing to expand or collapse together.
closure_law: This ticket closes only when the split is represented in Sidecar State/Msg, the view renders separate expanded and collapsed forms for both sub-workspaces, shell session selection no longer depends on the info browser inspector, and build plus Sidecar wave proof pass.
evaluation_criteria:
  - Sidecar state includes independent collapse state for info and shell workspaces
  - collapse/expand updates replay through Msg without emitting Cmd effects
  - info browser contains project/ticket/comment browsing and its inspector
  - shell workspace contains session list, spawn/close controls, session metadata, and terminal attach
  - browser observation proves each region can collapse/expand independently
  - npm run build and npm run test:sidecar-wave pass
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - npm run build
  - npm run test:sidecar-wave
  - browser observation
non_closure_conditions:
  - collapse state is held only in React view-local state
  - collapsing one Sidecar sub-workspace forces the other to collapse
  - shell session selection clears the active info-browser item
  - Sidecar gains new server or terminal effect paths beyond the existing Msg/Cmd membrane
---

## STDO Reading

This is a realization refactor of Sidecar workspace composition. It does not
change the AssetSurface contracts or add shell functionality.

The Local Shell Workspace is reference material for collapse/expand ergonomics.
The lawful target shape is Sidecar-owned State/Msg replay, not copied view-local
`useState` collapse flags.

## Closure Evidence

- `SidecarState.ui` now owns independent `infoCollapsed` and
  `shellCollapsed` state.
- `ui/toggle-workspace` and `session/select` replay through `SidecarMsg`
  without emitting `Cmd` effects.
- Sidecar renders separate `Info Browser` and `Sidecar Shell Workspace`
  sub-workspaces with independent expanded and collapsed forms.
- Session selection uses `activeSessionId` and no longer clears the selected
  Project, Ticket, or Comment.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 84 Node tests and 7 Python tests.
- Browser observation at `http://127.0.0.1:5174/` collapsed and expanded the
  info browser and shell workspace independently, then switched dark to light
  mode with no new console warnings or errors.

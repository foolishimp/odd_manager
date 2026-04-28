---
id: B-018
title: Port Sidecar shell workspace to full-width multi-window layout
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Bring the old Local Shell Workspace layout behavior into the new Sidecar UX-method surface: full-width shell workspace, horizontal session manager, and multiple terminal windows.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-017
dependencies:
  - B-017 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator confirmed the split is better but identified that both Sidecar regions should take full browser width, the shell session manager should be horizontal above terminal windows, and the Sidecar should support multiple terminal windows like the old Local Shell Workspace.
target_truth: Sidecar renders full-width stacked workspaces. The shell workspace has a horizontal session manager and replayable single/split terminal window layout state while preserving the new UX_METHOD State/Msg/Update/Cmd boundary.
superseded_truth: Sidecar shell workspace uses a left session column and single terminal detail pane, which does not preserve the proven Local Shell Workspace ergonomics.
closure_law: This ticket closes only when the Sidecar shell manager is horizontal, terminal windows render below it in single/split layouts, layout/window selection is represented in Sidecar State/Msg replay, and build plus Sidecar wave verification pass.
evaluation_criteria:
  - Sidecar shell workspace spans the full available Sidecar browser width
  - session manager renders horizontally above terminal windows
  - Sidecar supports single, split vertical, and split horizontal terminal layouts
  - primary and secondary terminal window selection replay through Sidecar Msg without Cmd effects
  - existing spawn/close and terminal attach effects remain inside the current Sidecar effect membrane
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
  - shell layout state is view-local React state
  - session manager remains a vertical sidebar beside terminal windows
  - only one terminal window can be shown when at least two sessions exist
  - new side effects are introduced outside the existing Sidecar Cmd membrane
---

## STDO Reading

This is a UX realization refactor over the Sidecar shell workspace. The old
Local Shell Workspace is reference material for layout ergonomics only.

The lawful import is the horizontal session manager and single/split terminal
window pattern, expressed through Sidecar-owned State/Msg replay.

## Closure Evidence

- Sidecar shell layout state now supports `single`, `split-vertical`, and
  `split-horizontal` in `SidecarState.ui.shellLayout`.
- Primary and secondary shell window selection replay through `SidecarMsg`
  without emitting `SidecarCmd` effects.
- Sidecar shell workspace renders a full-width horizontal session manager above
  terminal windows.
- Terminal windows render below the session manager using the shared
  `agent-console__terminal-layout` single/split classes.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 85 Node tests and 7 Python tests.
- Browser observation at `http://127.0.0.1:5174/` verified Sidecar shell
  sessions as horizontal tabs, Single/Split V/Split H layout controls,
  multi-window split rendering, dark-mode switching, and no new console
  warnings or errors.

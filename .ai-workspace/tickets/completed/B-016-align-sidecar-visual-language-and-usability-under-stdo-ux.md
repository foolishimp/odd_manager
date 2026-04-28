---
id: B-016
title: Align Sidecar visual language and usability under STDO-UX
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Retire the Sidecar's dark inline style island and port the widget surface to the current product design language with light/dark support and Local Shell Workspace-derived terminal usability.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-015
dependencies:
  - B-015 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator requested quality-of-life work before more Sidecar functionality, specifically product design-language alignment including light/dark support and improved Sidecar formatting/usability using the reliable Local Shell Workspace look and feel where it fits.
target_truth: Sidecar renders from the same shared product design primitives as the rest of odd_manager, supports light and dark modes through stylesheet variables, and applies Local Shell Workspace terminal/session usability patterns without adding new product behavior.
superseded_truth: Sidecar owns a standalone dark inline style system that obscures product visual language, makes light mode incoherent, and compresses the session terminal into a low-usability inspector strip.
closure_law: This ticket closes only when Sidecar visual structure is class-based, uses shared product CSS variables and reusable panel/pill/status/terminal primitives, preserves the existing State/Msg/Update/Cmd contract, and passes build plus Sidecar wave verification with browser observation in light and dark modes.
evaluation_criteria:
  - Sidecar removes its dark inline style constants from the React component
  - Sidecar rows, panes, context strip, inspector, actions, and terminal use product CSS classes and variables
  - light and dark modes render coherently through the existing app theme switch
  - Local Shell Workspace terminal shell/bar/session affordances are reused where appropriate
  - no new product behavior or effect path is introduced outside the existing Sidecar Msg/Cmd membrane
  - npm run build and npm run test:sidecar-wave pass
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - npm run build
  - npm run test:sidecar-wave
  - browser observation in light and dark mode
non_closure_conditions:
  - Sidecar still depends on dark-only inline styles for core layout or color
  - light mode renders as a dark embedded island except for the xterm terminal body
  - product actions bypass the existing Sidecar Msg/Cmd membrane
  - Local Shell Workspace behavior is broken or rewritten as part of this QoL pass
---

## STDO Reading

This is a realization refactor over an already-governed Sidecar surface.
Specification and behavior stay fixed. The work changes presentation and local
usability only.

Local Shell Workspace is reference material for terminal presentation and
session affordances. It does not become the Sidecar product authority.

## Closure Evidence

- Sidecar React markup no longer contains core inline style constants or
  `style=` presentation wiring.
- Sidecar panes, rows, context strip, inspector, actions, and terminal shell
  now consume shared product CSS classes and variables.
- Design module section 9 records the B-016 visual realization rule and keeps
  Local Shell Workspace as reference material.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 82 Node tests and 7 Python tests.
- Browser observation at `http://127.0.0.1:5174/` selected Sidecar, selected a
  running session, attached the terminal shell, switched from light to dark
  mode, and reported no new console warnings or errors.

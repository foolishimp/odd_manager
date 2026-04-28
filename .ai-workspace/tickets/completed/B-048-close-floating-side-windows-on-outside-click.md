---
id: B-048
title: Close floating side windows on outside click
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make floating side panels dismiss when the operator clicks outside them.
change_class: realization_refactor
re_entry_point: code
affected_boundary: build_tenants/react_vite/src/layout/AppShell.tsx, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: medium
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T02:50:06Z
build_tenant: react_vite
dependencies:
  - B-047 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Workspace Tool, Sidecar selection flyout
intake_source: Operator quality-of-life request: clicking outside a side window should close it.
target_truth: Floating side windows close on outside click without breaking internal controls or rail/button selection.
superseded_truth: Floating side windows remain open until an explicit close/toggle action.
closure_law: This ticket closes only when Workspace Tool and Sidecar selection flyout both dismiss on outside click and browser proof covers the behavior.
evaluation_criteria:
  - Workspace Tool closes when clicking outside the selector
  - Workspace Tool does not immediately reopen when clicking its owning button
  - Sidecar selection flyout closes when clicking the canvas outside it
  - Sidecar rail interactions continue to select/open flyout surfaces
  - Playwright proof covers outside-click dismissal
proof_surface:
  - build_tenants/react_vite/src/layout/AppShell.tsx
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:e2e
---

## SPEC_METHOD Triage

This is a realization refactor. The product and design model do not change;
the defect is missing dismissal behavior for already-existing floating panels.

Lawful re-entry point: Code.

## STDO-UX Execution Contract

- `State`: open/closed panel state remains the single UI truth
- `Msg`: outside click maps to existing close/toggle messages
- `Update`: no new data mutation
- `Cmd`: no external effect
- `View`: side panels dismiss consistently when focus moves back to the canvas/page

## Closure Evidence

Implemented outside-click dismissal for:

- Workspace Tool dialog, excluding clicks inside the dialog and on its owning
  Managed Project button
- Sidecar selection flyout, closing when the operator clicks into the canvas

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "project add stays|floating side windows"`: 2 passed
- `npm run test:e2e`: 22 passed

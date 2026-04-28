---
id: B-049
title: Keep Workspace Tool open after Project add
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make Add register Projects without activating them or closing the Workspace Tool, so multiple Projects can be added in one pass.
change_class: realization_refactor
re_entry_point: code
affected_boundary: build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T02:50:06Z
build_tenant: react_vite
dependencies:
  - B-046 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Workspace Tool Project add/open behavior
intake_source: Operator request: when adding a Project, just add it and keep the dialog open because multiple Projects may be added.
target_truth: Add registers a Project and keeps the Workspace Tool open. Open activates a registered Project and closes the Workspace Tool.
superseded_truth: Add both registers and activates/closes for Browse and Manual flows.
closure_law: This ticket closes only when all Add paths stay in the dialog and Open remains the explicit activation action.
evaluation_criteria:
  - Manual Add Project registers without closing the dialog
  - Browse Add registers without closing the dialog
  - Scan Add registers without closing the dialog
  - Project list Open still activates and closes
  - Playwright proof covers Add staying open
proof_surface:
  - build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:e2e
---

## SPEC_METHOD Triage

This is a realization refactor. The maintained Project registry model remains
unchanged; only command semantics in the Workspace Tool are corrected.

Lawful re-entry point: Code.

## STDO-UX Execution Contract

- `State`: registered Projects update in dialog-local view state
- `Msg`: Add and Open are distinct actions
- `Update`: Add returns to Projects list with status; Open applies context
- `Cmd`: Add calls registry mutation only; Open calls active-project mutation
- `View`: dialog stays open after Add so batch registration is possible

## Closure Evidence

Changed Workspace Tool Project add semantics so Add registers only. It no longer
activates the Project or closes the dialog. Open remains the explicit context
switch action.

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "project add stays|floating side windows"`: 2 passed
- `npm run test:e2e`: 22 passed

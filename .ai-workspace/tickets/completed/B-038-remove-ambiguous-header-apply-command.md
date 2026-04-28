---
id: B-038
title: Remove ambiguous header Apply command
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove the generic top-level Apply button because workspace opening is already governed by the workspace selector and the button does not expose a distinct, legible operator command.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/layout/AppShell.tsx, build_tenants/react_vite/src/routes/WorkspaceRoute.tsx, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
completed_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-037
dependencies:
  - B-037 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: production AppShell workspace controls
intake_source: Operator correction: the header Apply button does not appear needed after workspace selection moved into the managed workspace selector.
target_truth: The AppShell header exposes only legible persistent commands. Workspace changes are performed through the managed workspace selector using explicit Open Workspace actions.
superseded_truth: The AppShell header shows a generic Apply command that can re-project the current workspace but does not communicate a distinct operator outcome.
closure_law: This ticket closes only when the generic header Apply button is removed, workspace opening remains available through the workspace selector, stale copy no longer references Apply, executable browser proof asserts the header command is absent, and build plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - UX_METHOD command grammar is tightened by removing the ambiguous persistent action
  - header workspace selector remains available
  - manual workspace entry still exposes `Open Workspace`
  - no reducer, command effect, or subscription semantics are changed
  - no visible no-world copy instructs the operator to use a removed Apply command
  - Playwright proof asserts the header Apply command is absent
  - `npm run build` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/src/layout/AppShell.tsx
  - build_tenants/react_vite/src/routes/WorkspaceRoute.tsx
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:e2e
non_closure_conditions:
  - a generic persistent Apply button remains in the AppShell header
  - workspace opening is removed from the workspace selector
  - stale copy still refers to Apply as a current command
  - the change introduces a new state/update/command/subscription path
---

## SPEC_METHOD Triage

This is a design reframe over the AppShell command surface. Product capability
does not change: the operator can still choose and open a managed workspace.
The realization changes by removing an ambiguous persistent command and keeping
the explicit workspace opening command inside the selector.

Affected product boundary: `odd_manager` production AppShell in the `react_vite`
build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: no new workspace state is introduced
- `Msg`: no new product command path is introduced
- `Update`: no reducer semantics change
- `Cmd`: existing workspace refresh/open effect remains attached to the
  workspace selector
- `Sub`: no external subscription is introduced
- `View`: the header removes the ambiguous Apply command and stale copy is
  aligned to the remaining explicit Open Workspace action

## Implementation Plan

1. Remove the persistent AppShell header Apply button.
2. Keep the managed workspace selector and manual Open Workspace action intact.
3. Update no-world empty-state copy so it does not reference Apply.
4. Add browser proof that the header no longer renders the generic Apply command.
5. Run build and e2e proof.

## Closure Evidence

Closed at `20260427T233346Z`.

Implemented:

- Removed the generic persistent `Apply` button from the AppShell header.
- Kept workspace changes governed by the managed workspace selector and its explicit `Open Workspace` action.
- Updated no-world copy to refer to opening a managed workspace instead of applying one.
- Added shared Playwright chrome proof that the header no longer renders an `Apply` button.

Verification:

- `npm run build` passed.
- `npm run test:e2e` passed: 17 Playwright tests.

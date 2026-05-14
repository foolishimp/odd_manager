---
id: B-076
title: Fix project selector sidebar context switch
type: bug
ticket_category: corrective_review
status: active
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Repair the project selector sidebar so selecting a different Project changes the active Project context consumed by Sidecar surfaces instead of leaving the workbench on the previous Project.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/app/App.tsx, build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx, build_tenants/react_vite/src/routes/WorkspaceRoute.tsx, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-05-01
created_at: 2026-05-01
updated_at: 2026-05-13T09:18:20+10:00
sprint: SPRINT-2026-05-13-sidecar-project-context
build_tenant: react_vite
dependencies:
  - B-009 completed
  - T-017 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Project selector sidebar and active Project context propagation
intake_source: Operator report 2026-05-01: "Project selector sidebar has a bug its not changing project context."
target_truth: Selecting a Project from the sidebar updates the reducer-owned active Project context and every Project-scoped Sidecar surface reloads against the selected Project root.
superseded_truth: The project selector sidebar can show or select a different Project without changing the effective Project context used by the workbench.
closure_law: This bug closes only when project selection has one declared state path, context-dependent surfaces reload from the selected root, visible context indicators match the effective root, and browser proof catches regressions.
evaluation_criteria:
  - sidebar project selection dispatches a typed state transition rather than a DOM-only or display-only update
  - active Project id/root changes in the state consumed by WorkspaceRoute and SidecarPanel
  - ticket, comment, session, file browser, process navigator, and document-surface reads use the selected Project root after the switch
  - visible active Project affordances reflect the same root used by API calls
  - switching between two fixture Projects shows distinguishable Project-scoped data without requiring a page reload
  - stale loads from the previous Project cannot overwrite the newly selected Project context
  - Playwright proof selects a second Project from the sidebar and asserts both visible context and scoped data change
  - npm run build passes
  - npm run test:sidecar-wave passes
  - npm run test:e2e passes
proof_surface:
  - build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx
  - build_tenants/react_vite/src/routes/WorkspaceRoute.tsx
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - the sidebar label changes while API calls still use the previous or default Project root
  - the active Project is stored outside the declared STDO-UX State/Msg path
  - a full browser reload is required for project context to take effect
  - only one dependent surface is updated while other Project-scoped surfaces remain stale
---

## STDO-UX Triage

This is a realization refactor over an existing UX contract. B-009 already
established that Sidecar data loads must be scoped to selected Project context,
and T-017 established Project selection as a ContextDelta producer. The reported
bug indicates a regression or incomplete integration in the sidebar selector
path, not a new product requirement.

Lawful re-entry point: Realization.

## Execution Contract

Project context remains a declared STDO-UX state fact. The fix must route
sidebar selection through the same typed state and command path consumed by
WorkspaceRoute, SidecarPanel, and Project-scoped API calls. The UI may expose
the selected Project in multiple places, but those views must project one active
context rather than maintaining competing local selections.

## Sprint Boundary

This ticket is coordinated by
`.ai-workspace/sprints/SPRINT-2026-05-13-sidecar-project-context.md`.

It remains active sprint work. Targeted replay, build, and focused browser proof
can establish the current implementation direction, but they do not close the
ticket while the sprint closure gates still include full `test:sidecar-wave`,
full `test:e2e` or an explicit narrowed-browser review, and a live steel-thread
workspace re-check of shell label, Sidecar root, Browse root, pins, and Recent
Paths.

## 2026-05-13 Crash Recovery Note

The recovered symptom is visible root drift: the shell title/control can still
show the previous `data_mapper.test35` root while a Sidecar project tab and
viewer body are already loaded from a steel-thread sandbox workspace. That is a
non-closure condition for this ticket because Browse and visible context labels
must derive from the same active Project root.

## 2026-05-13 Implementation Evidence

Implemented in the Sidecar and route boundary:

- Sidecar project selection now calls the Project registry active-project path
  before dispatching the reducer selection.
- Sidecar opened project roots use the same active-project path.
- Sidecar derives the effective browser root from `activeLoadRoot` or loaded
  context before falling back to the embedding prop.
- Pinned-folder persistence is guarded by the root it was loaded for, so
  old-root pins cannot overwrite the newly selected Project's stored pins
  during a switch.
- App-level workspace switching keeps the current Sidecar instance mounted
  while Sidecar is the selected page, preserving the selected file tab during
  root promotion.
- `WorkspaceRoute` wires `onContextChange` back to the app-level project root
  switch so the shell title/control and Sidecar browser share one root.
- Sidecar filesystem browsing requests uncapped entries while the generic
  folder picker remains bounded by default.

Verification:

- `npm run test:runtime:node -- runtime/tests/test_sidecar_msg_replay.mjs`
  passed through the repo script's full Node runtime expansion: 142 passed.
- `npm run build` passed.
- `npx playwright test tests/e2e/odd-manager-smoke.spec.ts -g "project selection from sidecar Projects surface promotes active context|project switching from sidecar keeps sidecar open"` passed: 2 passed.

## 2026-05-13 Open Sprint Evidence Update

The sprint closure lanes have now been run in the active pass:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 142 Node runtime tests and 9 Python
  runtime tests.
- `npm run test:e2e` passed: 38 browser tests.
- Focused recovery checks passed for the earlier full-suite failures:
  collaboration workspace activation, Sidecar section controls, and unpinned
  active folder visibility.
- Live steel-thread browser proof used
  `/Users/jim/src/apps/odd_sdlc/build_tenants/typescript/test_env/test_runs/data_mapper_steel_thread_sandbox/20260512T170956378Z_pid24944/workspace`.
  The shell root control, Sidecar Project rail, and Browse flyout resolved to
  that workspace instead of the prior `data_mapper.test35` Project.

Sprint state: implementation closure evidence is green, but B-076 remains
active until operator close review transitions the ticket.

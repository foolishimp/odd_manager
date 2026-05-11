---
id: B-076
title: Fix project selector sidebar context switch
type: bug
ticket_category: corrective_review
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Repair the project selector sidebar so selecting a different Project changes the active Project context consumed by Sidecar surfaces instead of leaving the workbench on the previous Project.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/project-selector/ProjectSelector.tsx, build_tenants/react_vite/src/routes/WorkspaceRoute.tsx, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-05-01
created_at: 2026-05-01
updated_at: 2026-05-01T11:41:40+10:00
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

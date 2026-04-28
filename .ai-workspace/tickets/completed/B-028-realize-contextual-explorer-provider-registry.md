---
id: B-028
title: Realize contextual explorer provider registry
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Continue B-026 by replacing hard-coded Sidecar rail surfaces with a typed explorer provider registry and adding Sessions as a governed explorer provider.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-026
dependencies:
  - B-026 active
  - B-027 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route explorer provider controls
intake_source: B-026 Option A workbench reframe requires a contextual/selectable explorer before tabbed viewer groups can be introduced. Current Projects, Tickets, and Comments rail buttons are hard-coded view structure rather than a typed provider carrier.
target_truth: Sidecar has a typed `SidecarExplorerProvider` registry. The left activity rail renders providers from that registry, the active provider is reducer-owned state, and Projects, Tickets, Comments, and Sessions are selectable explorer providers. Selecting Sessions opens a session browser without changing terminal effect boundaries.
superseded_truth: Sidecar activity rail and flyout providers are hard-coded in the React view and limited to Projects, Tickets, and Comments.
closure_law: This ticket closes only when provider identity is a typed carrier, provider selection replays through Sidecar State/Msg with no Cmd effects, Sessions is available as an explorer provider, the provider browser remains a pure projection over admitted state, browser proof covers provider switching, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - `SidecarExplorerProvider` and provider id types exist as typed carriers
  - provider registry includes Projects, Tickets, Comments, and Sessions
  - activity rail renders from the provider registry rather than hard-coded buttons
  - provider selection updates reducer-owned state and emits no `SidecarCmd`
  - Sessions provider renders from admitted session state and does not spawn, attach, kill, or perform terminal I/O
  - selecting a session from the explorer updates selection and active session through the existing typed message path
  - provider switching is keyboard accessible through normal button semantics
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - provider identity remains only hard-coded JSX
  - Sessions is still only reachable through terminal dock controls
  - provider selection uses view-local React state
  - provider switching emits command effects
  - Sessions provider performs session runtime effects in the explorer browser
  - browser proof does not exercise provider switching
---

## SPEC_METHOD Triage

This is a substantive change because it changes the Sidecar realization
structure from hard-coded rail/flyout branches to a typed explorer provider
carrier.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Intended scope: second implementation slice of B-026 only. This ticket does
not introduce viewer tab groups, terminal tab groups, layout persistence,
editor framework adoption, or a VS Code extension.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

Downstream span:

- design surface: `sidecar-session-workspace.md` B-026/B-028 rules
- code: Sidecar reducer, Sidecar panel projection, and rail CSS
- evidence: Msg-replay tests, Playwright e2e browser proof, build proof

Release scope: within the current Sidecar UX work wave. No Goals, Intent,
Product, or Requirements repricing is required because the operator control
plane purpose and Sidecar capability boundary remain stable.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: active explorer provider lives in `SidecarState.ui`
- `Msg`: provider selection uses a typed Sidecar message
- `Update`: provider selection is pure reducer logic
- `Cmd`: provider selection emits no commands
- `Sub`: no new subscriptions are introduced in this slice
- `View`: rail and flyout are pure projections over registry and state

Sessions provider is a browser/projection over admitted session state. It must
not become a hidden session runtime controller. Spawn, close, attach, and
terminal I/O remain in the existing session and terminal effect membrane.

## Implementation Plan

1. Add `SidecarExplorerProviderId`, `SidecarExplorerProvider`, and
   `SIDECAR_EXPLORER_PROVIDERS`.
2. Expand the active provider state to include Sessions.
3. Render the activity rail from the provider registry.
4. Extend the explorer flyout to render Sessions from current session records.
5. Add a session inspector projection for selected sessions.
6. Add Msg-replay proof for provider registry and Sessions selection.
7. Add Playwright proof for provider switching in the browser.

## Closure Evidence

- `SidecarExplorerProviderId`, `SidecarExplorerProvider`, and
  `SIDECAR_EXPLORER_PROVIDERS` now define the explorer provider carrier.
- The provider registry includes Projects, Tickets, Comments, and Sessions.
- The activity rail renders from the provider registry instead of hard-coded
  JSX branches.
- Provider selection remains reducer-owned through `ui/select-info-surface`
  and emits no `SidecarCmd`.
- The Sessions provider renders current `SessionRecord` state as a browser
  projection.
- Selecting a session from the provider uses the existing typed `select`
  message with `kind: session`, updates selection, and activates the session.
- A read-only `SessionInspector` projects selected session metadata without
  introducing new session runtime effects.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 93 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 8 Playwright tests.

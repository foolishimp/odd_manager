---
id: B-031
title: Persist Sidecar workbench layout and prove browser behavior
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Close B-026 by persisting the Sidecar workbench layout profile per Context and proving reset, persistence, and browser behavior under STDO-UX.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-026
dependencies:
  - B-026 active
  - B-030 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route workbench layout profile
intake_source: B-026 Option A workbench reframe requires per-Context layout persistence, reset-to-default, and proof that browser payloads are validated before admission into reducer-owned state.
target_truth: Sidecar persists a typed workbench layout profile per `Context = Project x Workspace`. Persisted browser payloads are validated before entering `SidecarState`, invalid payloads fail closed, reset-to-default is a typed Sidecar message, and persistence uses the browser effect membrane rather than view-local layout truth.
superseded_truth: Sidecar layout state is reducer-owned while mounted but not restored across browser reloads and has no typed persisted-profile admission path.
closure_law: This ticket closes only when layout profile serialization and validation exist, persisted payload load applies through typed `SidecarMsg`, invalid persisted payloads fail closed, reset-to-default replays through reducer state, browser proof covers resize persistence and reset, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - persisted layout profile is versioned and scoped by Context key
  - persisted profile contains reducer-owned layout state rather than DOM measurements or component refs
  - localStorage payloads are runtime-validated before entering `SidecarState`
  - invalid persisted payloads fail closed and do not overwrite current layout
  - reset-to-default is a typed `SidecarMsg` and emits no command effects
  - persistence effects are isolated to the Sidecar browser effect membrane
  - Msg-replay proof covers valid load, invalid load, save-failure message, and reset
  - Playwright proof covers resize persistence across reload and reset-to-default
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - persisted layout state is read directly by a component without reducer admission
  - persisted payload validation uses permissive defaults that reconstruct product truth
  - reset is implemented by DOM manipulation or browser storage deletion only
  - layout persistence emits product action commands
  - browser proof does not reload the page
---

## SPEC_METHOD Triage

This is a substantive change because it adds an external browser persistence
surface for Sidecar workbench layout state.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Intended scope: final implementation slice of B-026 only. This ticket does not
persist terminal transcripts, session records, product assets, comments,
tickets, or browser-specific editor state.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

Downstream span:

- design surface: `sidecar-session-workspace.md` B-026/B-031 rules
- code: Sidecar reducer, Sidecar browser effect membrane, and Sidecar CSS
- evidence: Msg-replay tests, Playwright e2e browser proof, build proof

Release scope: within the current Sidecar UX work wave. No Goals, Intent,
Product, or Requirements repricing is required because the operator control
plane purpose and Sidecar capability boundary remain stable.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: the current layout profile remains in `SidecarState.ui`
- `Msg`: profile load, load failure, save failure, and reset are typed Sidecar
  messages
- `Update`: profile admission and reset are pure reducer logic
- `Cmd`: no product command is emitted for layout persistence
- `Sub`: browser storage load is treated as an external event source returning
  typed messages
- `View`: reset controls are pure projections over state and dispatch only
  typed messages

Browser storage is an external payload. It must be parsed and validated before
it changes `SidecarState`. The persisted profile is layout and workbench UI
state only; it must not become a product-truth or session-truth store.

## Implementation Plan

1. Add a versioned `SidecarLayoutProfile` carrier.
2. Add validation and serialization helpers in the Sidecar state module.
3. Add typed messages for profile load, load failure, save failure, and reset.
4. Apply valid persisted profiles through reducer state only.
5. Wire browser localStorage load/save in `SidecarPanel` as an effect membrane.
6. Add a reset-to-default workbench control.
7. Add Msg-replay proof for valid load, invalid load, save failure, and reset.
8. Add Playwright proof for resize persistence across reload and reset.

## Closure Evidence

- `SidecarLayoutProfile` now defines a versioned persisted layout carrier
  scoped by Context key.
- Persisted layout profile serialization is derived from reducer-owned
  `SidecarState`.
- Persisted browser payloads are validated before admission into
  `SidecarState`.
- Invalid persisted payloads fail closed through typed
  `layout/profile-loaded` handling and do not replace current layout state.
- Save and load failures are represented as typed Sidecar messages.
- Reset-to-default is represented as `layout/profile-reset` and emits no
  product command effects.
- Browser localStorage load/save is isolated in the Sidecar effect membrane.
- Browser proof covers resize persistence across reload and reset-to-default.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 100 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 11 Playwright tests.

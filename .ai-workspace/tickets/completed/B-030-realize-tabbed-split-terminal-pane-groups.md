---
id: B-030
title: Realize tabbed split terminal pane groups
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Continue B-026 by turning the Sidecar bottom dock into reducer-owned tabbed terminal groups over the existing xterm session substrate.
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
  - B-029 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route bottom terminal dock
intake_source: B-026 Option A workbench reframe requires tabbed/splittable CLI panes after viewer groups exist. Current Sidecar terminal dock still uses one active session plus one secondary session rather than a typed terminal group carrier.
target_truth: Sidecar terminal dock is a typed terminal workspace. Terminal tabs and groups are reducer-owned state, tabs store session identity rather than copied session records, shell session selection opens or activates a terminal tab in the active terminal group, and the dock can switch between single, vertical split, and horizontal split terminal group layouts without layout command effects.
superseded_truth: Sidecar terminal dock renders primary and secondary sessions from `activeSessionId`, `secondarySessionId`, and `shellLayout`, so terminal group membership is not represented as replayable tab state.
closure_law: This ticket closes only when `TerminalTab` and `TerminalGroup` carriers exist, session selection opens terminal tabs through reducer state, terminal tab select/close/split/focus replay with no layout Cmd effects, rendered terminal tabs use accessible tablist semantics, browser proof covers select/split/close behavior, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - `SidecarTerminalWorkspace`, `SidecarTerminalGroup`, and `SidecarTerminalTab` exist as typed carriers
  - terminal tabs store session id only, not copied `SessionRecord` bodies
  - selecting a session opens or activates a terminal tab in the active terminal group
  - terminal tab select updates reducer-owned active tab and `activeSessionId`
  - terminal tab close updates reducer-owned groups and active session deterministically
  - terminal split mode supports single, split vertical, and split horizontal
  - terminal split/focus/select/close/open messages emit no layout `SidecarCmd`
  - terminal tab bars expose tablist/tab semantics and close controls have accessible names
  - spawn and kill still use the existing session command membrane
  - terminal attach and I/O still use the existing xterm/WebSocket membrane
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
  - terminal tab state is view-local React state
  - tabs duplicate session records instead of storing session identity
  - split layout exists only as CSS without reducer-owned state
  - terminal tab selection or split emits command effects
  - closing a terminal tab leaves active session or active group in an impossible state
  - terminal spawn, close, attach, or I/O is reimplemented outside the existing effect membrane
  - browser proof does not exercise terminal tab select/split/close
---

## SPEC_METHOD Triage

This is a substantive change because it changes the Sidecar bottom dock
realization from primary/secondary session slots into typed terminal tab and
split group carriers.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Intended scope: fourth implementation slice of B-026 only. This ticket does
not introduce terminal rename, room join, Codex/Claude launch controls, layout
persistence, editor framework adoption, or a VS Code extension.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

Downstream span:

- design surface: `sidecar-session-workspace.md` B-026/B-030 rules
- code: Sidecar reducer, Sidecar terminal dock projection, and Sidecar CSS
- evidence: Msg-replay tests, Playwright e2e browser proof, build proof

Release scope: within the current Sidecar UX work wave. No Goals, Intent,
Product, or Requirements repricing is required because the operator control
plane purpose and Sidecar capability boundary remain stable.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: terminal tabs, groups, active group, active tab, and split mode live
  in `SidecarState.ui`
- `Msg`: terminal open, select, close, split, and focus actions are typed
  Sidecar messages
- `Update`: terminal transitions are pure reducer logic
- `Cmd`: terminal tab and split layout actions emit no commands
- `Sub`: no new subscriptions are introduced in this slice
- `View`: terminal tabs and panes are pure projections over current state

Terminal tabs are session identity carriers. They must not become a copied
session-truth store. Session details remain derived from admitted
`SessionRecord` state.

The xterm/WebSocket implementation remains an effect membrane. This ticket may
mount existing terminal panes inside new group projections, but it must not
replace the terminal substrate or move terminal I/O into reducer or view state.

## Implementation Plan

1. Add `SidecarTerminalWorkspace`, `SidecarTerminalGroup`, and
   `SidecarTerminalTab` carriers.
2. Add messages for open, select, close, split, and focus terminal group.
3. Open or activate terminal tabs from existing session selection messages.
4. Normalize loaded session records into terminal workspace state.
5. Render the bottom dock as terminal groups with accessible tab bars.
6. Preserve spawn, kill, attach, and terminal I/O through existing command and
   xterm/WebSocket membranes.
7. Add Msg-replay proof for terminal open/select/close/split behavior.
8. Add Playwright proof for tabbed/split terminal behavior.

## Closure Evidence

- `SidecarTerminalWorkspace`, `SidecarTerminalGroup`, and
  `SidecarTerminalTab` now define the bottom-dock terminal carrier.
- Terminal tabs store only session identity: `sessionId`.
- Existing session selection now opens or activates a terminal tab in the
  active terminal group.
- Terminal messages now cover open, select tab, close tab, split, and focus
  group.
- Terminal open/select/close/split/focus messages emit no `SidecarCmd`.
- Terminal split supports single, vertical split, and horizontal split layouts.
- The existing xterm/WebSocket terminal component remains the attach and I/O
  effect membrane.
- Spawn and kill still use the existing declared session commands.
- Terminal tab bars expose tablist/tab semantics, and close controls carry
  accessible names.
- Browser proof covers opening two terminal tabs, switching to split terminal
  groups, and closing a terminal tab.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 97 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 10 Playwright tests.

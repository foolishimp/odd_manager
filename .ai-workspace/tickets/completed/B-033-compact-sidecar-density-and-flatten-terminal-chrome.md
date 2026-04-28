---
id: B-033
title: Compact Sidecar density and flatten terminal chrome
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Reduce Sidecar vertical chrome and terminal nesting while preserving the reducer-owned Sidecar workbench behavior established by B-026 through B-032.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
completed_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-032
dependencies:
  - B-032 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route density, canvas chrome, and terminal dock chrome
intake_source: Operator review of the B-032 Sidecar screen: the foundations are solid, but attractive styling consumes too much vertical space and the terminal has too many chrome layers before the actual terminal host.
target_truth: Sidecar uses compact workbench density. Section controls are a compact command strip, canvas context duplication is removed, empty canvas chrome is quiet, terminal controls collapse into one compact toolbar, terminal tabs/session selection become the primary selector surface, and the actual terminal host is reached after minimal chrome.
superseded_truth: Sidecar has correct workbench primitives but stacks global chrome, section controls, terminal heading, session manager, terminal tabs, session frame, connection bar, and terminal host as visually separate layers.
closure_law: This ticket closes only when the design module defines the density rule, Sidecar behavior remains reducer-owned, terminal chrome is flattened without losing session spawn/select/kill/split behavior, executable assertions cover the density and terminal-layer invariants, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - UX_METHOD remains sole UX realization authority for this production surface
  - no new product command effects are introduced for density changes
  - section controls render as a compact command strip
  - canvas header no longer duplicates full context-chip state already present in the right rail
  - terminal dock has one compact toolbar before terminal tabs
  - terminal session selection is available from the compact toolbar or terminal tabs
  - terminal host receives more usable vertical space than before
  - executable assertions cover compact controls and flattened terminal chrome
  - Playwright proof covers terminal chrome density and terminal host height
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - view-local state is introduced for terminal selection, split, collapse, or layout
  - session spawn, select, kill, attach, or terminal I/O bypasses the existing Sidecar messages and effect membrane
  - terminal controls are hidden without an equivalent compact affordance
  - density is achieved by making text unreadable or controls inaccessible
  - browser proof does not measure actual terminal host height or chrome depth
---

## SPEC_METHOD Triage

This is a design reframe over the existing Sidecar UX realization. The
product-level capability boundary remains unchanged. The request reprices how
the working primitives are visually composed so the workspace gives height back
to the terminal and canvas.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: existing Sidecar state remains authoritative for collapse, tabs,
  terminal split, terminal selection, and layout
- `Msg`: existing Sidecar messages remain the control path
- `Update`: reducer behavior may only change if needed to preserve existing
  replay semantics
- `Cmd`: no new command effect is introduced for density work
- `Sub`: no new external subscription is introduced
- `View`: compact density is a pure projection over existing state

## Implementation Plan

1. Add the density and terminal-flattening rule to the Sidecar design module.
2. Compress route, section-control, canvas, and Sidecar workbench spacing.
3. Remove duplicate canvas context chrome already represented by the context
   rail.
4. Replace the separate terminal session manager row with one compact terminal
   toolbar.
5. Remove hidden terminal metadata grid and card-like terminal session frame.
6. Add executable CSS/markup assertions for terminal chrome depth.
7. Add browser proof for terminal host height and compact chrome.
8. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Closed under STDO-UX as a design reframe. The implementation changes the
Sidecar projection density without adding a new product command effect,
subscription, or view-owned semantic state.

Realization:

- `build_tenants/react_vite/design/widgets/sidecar-session-workspace.md`
  defines the B-033 density and terminal-flattening rule.
- `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx` removes
  duplicate canvas context chrome, replaces the terminal session manager with a
  compact terminal toolbar, and keeps session spawn/select/kill/split behavior
  on the existing message/effect path.
- `build_tenants/react_vite/src/app/styles.css` compresses route chrome,
  section controls, canvas chrome, terminal tabs, and the terminal host frame.
- `build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs` asserts
  the density grammar and flattened terminal markup without introducing new
  state effects.
- `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` asserts the
  compact terminal toolbar, absence of the old shell-manager layer, actual
  terminal host visibility, chrome-depth budget, and terminal host height.

Verification:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed.
- `npm run test:e2e` passed.

Residual:

- This pass establishes the compact density and flattened terminal structure.
  Further visual language refinement should continue in separate tickets so the
  reducer/message contract remains auditable per UX_METHOD.

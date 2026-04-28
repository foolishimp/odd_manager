---
id: B-037
title: Keep Sidecar right rail as narrow sweep-out context
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Preserve the Sidecar right rail as a narrow context affordance while moving project/selection detail into sweep-out panels instead of cramped horizontal text.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
completed_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-036
dependencies:
  - B-036 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar right context rail
intake_source: Operator correction: keep the right rail, make it narrow, and allow details to sweep out rather than losing the rail and later deciding it is needed again.
target_truth: The right rail is a narrow fixed context affordance. It shows compact symbols/counts only. Full project, selection, unread, and shell details appear in sweep-out panels on hover/focus.
superseded_truth: The right rail renders horizontal labels and truncated project/selection text inside a narrow column, duplicating information already available in the top/header surfaces.
closure_law: This ticket closes only when the design module defines the narrow sweep-out rail rule, the right rail remains present but narrow, cramped horizontal text is removed from the rail body, details remain available by sweep-out hover/focus, executable assertions cover the markup/CSS, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - UX_METHOD remains sole UX realization authority for this production surface
  - right rail remains present in the Sidecar workbench
  - right rail width is fixed/narrow and no longer consumes a resizable detail column
  - rail body renders compact symbols/counts instead of horizontal labels and truncated names
  - each rail item has a sweep-out detail panel available by hover/focus
  - no new product command effects or subscriptions are introduced
  - executable assertions cover narrow rail grammar and sweep-out CSS
  - Playwright proof covers narrow rail width and visible sweep-out detail
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
  - right rail is removed
  - right rail still displays long project or selection text inside the narrow rail
  - detail access depends on hidden view-local semantic state
  - right rail becomes a second source of context truth
---

## SPEC_METHOD Triage

This is a design reframe over the Sidecar right context rail. The product
capability does not change. The existing context information remains derived
from Sidecar state, but the projection changes from cramped inline text to a
narrow rail with sweep-out details.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the Elm Architecture process model:

- `State`: no new product-meaningful context state is introduced
- `Msg`: no new product command path is introduced
- `Update`: no reducer change is expected
- `Cmd`: no command effect is introduced
- `Sub`: no external subscription is introduced
- `View`: the narrow rail and sweep-out panels are pure projections of existing
  Sidecar state

## Implementation Plan

1. Add the narrow sweep-out context rail rule to the Sidecar design module.
2. Replace inline right-rail text items with compact symbolic items.
3. Add hover/focus sweep-out panels for full detail.
4. Fix the workbench right column to a narrow rail width.
5. Update tests so right-rail resize is no longer required.
6. Add executable markup/CSS and browser assertions for sweep-out behavior.
7. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Closed at `20260427T231326Z`.

Implemented:

- Added the Sidecar narrow sweep-out context rail rule to the design module.
- Kept the right rail present as a fixed narrow context affordance.
- Replaced horizontal project/selection/unread/shell text in the rail body with compact symbols and counts.
- Added hover/focus sweep-out detail panels for full project, selection, unread, and shell context.
- Removed the right-rail resize interaction from Sidecar workbench proof.
- Added executable runtime assertions for the narrow rail grammar and sweep-out CSS.
- Added Playwright coverage proving narrow width and visible sweep-out detail.
- Tightened the empty split-pane targeting e2e setup so terminal pane targeting is asserted without hanging on a detached close button during render update.

Verification:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 111 Node tests, 7 Python tests.
- `npm run test:e2e -- --grep "sidecar split panes can be explicitly targeted when empty"` passed.
- `npm run test:e2e` passed: 17 Playwright tests.

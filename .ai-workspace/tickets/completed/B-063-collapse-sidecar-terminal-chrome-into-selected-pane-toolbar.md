---
id: B-063
title: Collapse Sidecar terminal chrome into selected-pane toolbar
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove repeated terminal pane chrome and make the dock toolbar the selected terminal pane command surface.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T14:47:46Z
build_tenant: react_vite
dependencies:
  - B-033 completed
  - B-040 completed
  - B-044 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar terminal dock
intake_source: Operator screenshot showed three terminal chrome bars: dock controls, pane tab strip, and per-terminal status bar. The desired model is one dock toolbar that follows the selected terminal pane.
target_truth: The Sidecar terminal dock has one toolbar. The left side selects the shell. The middle reports selected shell status, pid/shell/backend, and selected-pane tabs. The right side owns spawn and layout controls. Terminal pane bodies contain terminal content or empty-pane placeholders only.
superseded_truth: Terminal pane groups render their own tab strips and each live terminal renders another status/control bar, wasting vertical space and making pane targeting ambiguous.
closure_law: This ticket closes only when implementation removes per-pane terminal tabs and per-terminal bars, keeps spawn/select targeting active terminal groups, and executable tests prove the one-toolbar selected-pane behavior.
evaluation_criteria:
  - terminal tabs render in the dock toolbar for the active terminal group
  - terminal groups no longer render local tab strips
  - live terminal windows no longer render their own status/control bar
  - shell spawn does not receive the React click event as a group id
  - browser tests prove selected pane tab context and compact terminal chrome
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor. The product requirement for split terminal
workspaces is unchanged. The defect was duplicate visual/control realization
inside the terminal dock.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented the one-toolbar terminal dock model. The toolbar now follows the
active terminal pane, renders the shell selector on the left, selected shell
status/meta and tabs in the middle, and spawn/layout/collapse controls on the
right. Terminal groups no longer render pane-local tab strips and live terminal
windows no longer render their own status bar. The spawn button now calls
`onSpawn()` explicitly so the React click event cannot become a bogus group id.

Verification passed:

- `npm run build`
- `npm run test:sidecar-wave`
- `npm run test:e2e` (26 passed)

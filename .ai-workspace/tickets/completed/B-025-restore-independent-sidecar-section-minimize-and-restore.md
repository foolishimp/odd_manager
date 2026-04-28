---
id: B-025
title: Restore independent Sidecar section minimize and restore
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the Sidecar info browser and shell workspace independently minimizable and independently restorable through persistent controls.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-023
dependencies:
  - B-023 completed
  - B-024 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator reported minimized Sidecar content disappears without an obvious unminimize/collapse affordance, and the board/info section lacks an independent minimize control.
target_truth: The Sidecar always exposes persistent section controls for the info browser and shell workspace. Each section can be minimized and restored independently without hiding the restore affordance.
superseded_truth: Section collapse is split between flyout rail behavior and a bottom terminal tab, making restore affordances easy to lose and leaving the info/browser section without a clear independent minimize control.
closure_law: This ticket closes only when Sidecar exposes persistent info-browser and shell-workspace minimize/restore controls, both controls replay through the Sidecar state algebra with no Cmd effects, collapsed shell layout still reclaims terminal height, and build plus sidecar wave plus Playwright e2e verification pass.
evaluation_criteria:
  - info browser has a persistent minimize control and a persistent restore control
  - shell workspace has a persistent minimize control and a persistent restore control
  - info browser and shell workspace collapse states are independent
  - minimized sections do not remove all visible restore affordances
  - npm run build passes
  - npm run test:sidecar-wave passes
  - npm run test:e2e passes
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - a section can be minimized but cannot be restored from a persistent visible control
  - the info/browser section depends only on rail selection for restore
  - shell collapse hides every restore affordance
  - section collapse introduces command effects or view-local state
---

## STDO Reading

This is a Sidecar realization refactor over the existing state algebra. The
product behavior remains the same: the workbench has an information browser
and a shell workspace. The defect is UX operability: the reversible minimize
controls are not explicit and persistent for both sections.

## Closure Evidence

- Sidecar now has an always-visible section control strip above the workbench.
- `Info Browser` exposes a persistent minimize control and a persistent restore
  control.
- `Shell Workspace` exposes a persistent minimize control and a persistent
  restore control.
- Info and shell collapse states remain reducer-owned and replay independently
  with no command effects.
- The collapsed shell grid still reclaims the terminal dock row while leaving
  restore controls visible.
- Playwright now verifies independent minimize and restore behavior in the
  browser.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 89 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 6 Playwright tests.

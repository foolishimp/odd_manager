---
id: B-023
title: Fix Sidecar terminal hide reclaiming space
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the Sidecar terminal hide control reclaim the bottom dock space instead of only hiding dock contents.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-022
dependencies:
  - B-022 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator reported the hide button does not work after the Sidecar compact chrome and deeper terminal dock change.
target_truth: Sidecar terminal hide collapses the terminal dock to a compact tab and returns the reclaimed viewport height to the canvas row.
superseded_truth: Sidecar terminal hide removes terminal contents but the workbench grid still reserves the deep terminal row.
closure_law: This ticket closes only when the bottom collapsed workbench class changes the grid row allocation, the reducer replay still proves collapse without Cmd effects, a CSS regression test protects the collapsed-grid rule, and build plus Sidecar wave verification pass.
evaluation_criteria:
  - terminal dock collapse state still replays through Sidecar Msg with no Cmd
  - `.sidecar-workbench.is-bottom-collapsed` changes grid rows to a canvas row plus compact auto dock row
  - collapsed dock remains visible as a compact Terminal tab
  - npm run build and npm run test:sidecar-wave pass
proof_surface:
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - npm run build
  - npm run test:sidecar-wave
non_closure_conditions:
  - hide only removes terminal contents while reserving the full terminal row
  - collapse behavior is implemented with view-local React state
  - CSS regression is left untested
---

## STDO Reading

This is a realization refactor over B-022. The Sidecar state algebra already
records shell collapse. The defect is layout realization: the collapsed class
did not change the workbench grid rows.

## Closure Evidence

- `.sidecar-workbench.is-bottom-collapsed` now changes the workbench grid to
  `minmax(0, 1fr) auto`, so the canvas row receives the reclaimed terminal
  height.
- The collapsed bottom dock remains visible as a compact Terminal tab.
- The Sidecar Msg reducer collapse behavior remains owned by the existing state
  algebra, with no view-local collapse state added.
- `test_sidecar_msg_replay.mjs` now guards the collapsed-grid rule and prevents
  regression to the expanded terminal row allocation.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 87 Node tests and 7 Python tests.

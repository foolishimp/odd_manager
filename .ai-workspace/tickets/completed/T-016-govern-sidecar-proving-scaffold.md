---
id: T-016
title: Govern sidecar proving scaffold lifecycle
type: chore
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Bring the standalone sidecar demo at runtime/dev/sidecar-demo.mjs under explicit STDO-UX governance with banner enforcement and a declared retirement point at T-010 closure, so the scaffold is not mistaken for production UX and does not accrete features outside its proving role.
change_class: realization_refactor
re_entry_point: design_surface
affected_boundary: runtime/dev/sidecar-demo.mjs lifecycle, scaffold banner contract, scaffold-to-T-010 supersession path
priority: medium
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies: []
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: commit 1292218 (sidecar demo scaffold first landed); user direction 2026-04-26 to keep wave under STDO compliance with no loose artifacts; ODD §16 failure pattern #1 (claimed step has no corresponding node)
target_truth: Scaffold runtime/dev/sidecar-demo.mjs carries a visible SCAFFOLD banner in its served HTML, includes a top-of-file comment naming T-010 as the supersession point, and is referenced by every read-path ticket (T-007 / T-008 / T-009 / T-017) whose evaluation includes a scaffold pane. T-010 closure deletes the scaffold file; this ticket closes when that retirement is complete.
superseded_truth: Scaffold is a loose tenant-local artifact with no governance — could be mistaken for production UX, could accrete write actions or business logic.
closure_law: this ticket closes when T-010 ships and the scaffold file is deleted, at which point the proving role transferred cleanly to the real React widget.
evaluation_criteria:
  - sidecar-demo.mjs HTML carries a visible SCAFFOLD banner naming the T-010 supersession path
  - sidecar-demo.mjs file header comment names this ticket and T-010 explicitly
  - read-path tickets (T-007 / T-008 / T-009 / T-017) reference the scaffold as their visible-proof surface
  - T-010 closure_law includes "scaffold file deleted; proving role retired"
proof_surface:
  - sidecar-demo.mjs banner and header
  - cross-references from T-007, T-008, T-009, T-017
  - T-010 evaluation criterion for scaffold deletion
non_closure_conditions:
  - scaffold treated as production code or extended with write actions outside its proving role
  - banner removed from served HTML
  - T-010 ships without retiring the scaffold file
  - scaffold accretes a UX framework (Redux, React) — that is T-010 territory
---

## STDO Reading

Brings the proving artifact under method instead of leaving it as a loose ad-hoc scaffold; keeps it bounded and disposable.

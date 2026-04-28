---
id: B-013
title: Make sidecar wave verification fail-fast and fixture-owned
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Ensure sidecar wave verification cannot report green when earlier suites fail and does not depend on mutable live workspace lane distribution.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/runtime/tests, build_tenants/react_vite/package.json, .ai-workspace/comments/claude/20260427T040000Z_REVIEW_sidecar-wave-final-closure-for-cold-reviewer.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-012
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Codex reran the nine-suite command from the closure review and found earlier suite failures can be masked by the shell loop returning the last suite status; test_ticket_asset_surface also depends on there being at least one live backlog ticket.
target_truth: The sidecar wave has one fail-fast verification command that returns nonzero on any failed suite and uses fixtures for lane-distribution assumptions.
superseded_truth: Operators run an ad hoc for-loop that can continue after failures and return success if the last suite passes.
closure_law: This bug closes when npm exposes a single sidecar wave verification command that fails on any failed Node suite and all tests use owned fixtures for shape assumptions that are not constitutional live-workspace truths.
evaluation_criteria:
  - npm script or runner executes all Node sidecar runtime suites fail-fast or aggregates failures with nonzero exit
  - test_ticket_asset_surface no longer requires the live workspace to contain a backlog ticket
  - screen/backplane tests skip with explicit diagnostics when the required backplane is unavailable
  - closure review command examples use the new fail-fast command
proof_surface:
  - package.json script or test runner
  - updated fixture-owned tests
  - rerun evidence showing command status matches failures
non_closure_conditions:
  - shell loop can mask failures
  - tests depend on mutable live ticket lane distribution
  - environment-dependent backplane failures are neither skipped nor diagnosed
---

## STDO Reading

Verification is a proof surface. A proof command that can hide failures is a
qualification defect, not only a convenience issue.

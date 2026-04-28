---
id: B-011
title: Make TicketAssetSurface lane transitions atomic and fail-closed
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Prevent duplicate, overwritten, or partially moved ticket files during lane transitions.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/server/ticket-asset-surface-service.mjs, build_tenants/react_vite/runtime/tests/test_ticket_asset_surface_write.mjs
priority: medium
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-018
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: Codex sidecar-wave code review found transitionStatus writes the destination file and then unlinks the source, without destination collision checks.
target_truth: A ticket lane transition is one fail-closed operation that cannot overwrite an existing destination ticket and cannot leave duplicate live ticket records on crash or error.
superseded_truth: Transition writes a new file, then deletes the old file, allowing duplicate or overwritten ticket records under partial failure.
closure_law: This bug closes when lane transition uses a collision-checked move strategy and tests prove destination collision, write failure, and unlink failure do not corrupt the ticket set.
evaluation_criteria:
  - transition refuses to overwrite an existing destination path
  - transition does not delete the source unless the destination state is valid
  - failure cases return explicit action errors
  - cache invalidation and change feed remain correct after success and failure
proof_surface:
  - updated transition implementation
  - tests for destination collision and simulated failure
  - test proving one id has one live sourcePath after transition
non_closure_conditions:
  - source and destination can both exist after an error
  - existing destination file is overwritten silently
  - tests cover only the happy path
---

## STDO Reading

T-018 claims atomic write behavior. The current operation is atomic per file
write but not atomic for the lane move as a whole.

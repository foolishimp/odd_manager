---
id: T-037
title: Deliver the concurrent Build Control MVP
type: feature
ticket_category: ordinary
status: completed
review_status: accepted
proof_status: verified_by_automation
execution_state: manager_mvp_complete_external_residual_owned_by_t032
goal: G-006
source_ticket: T-032
sprint: SPRINT-2026-07-10-abg46-observation-reprice
build_tenant: react_vite
owner: codex
change_intent: >-
  Deliver W20 MVP 4: bounded scheduling and isolated supervision of multiple
  concurrent Project builds.
change_class: realization_refactor
re_entry_point: react_vite_realization
affected_boundary: build scheduler, concurrency policy, Build Portfolio integration, per-execution process/output/correlation isolation, cancellation and browser proof
priority: high
triaged_at: 2026-07-11
created_at: 2026-07-11
updated_at: 2026-07-11T19:57:31+10:00
merged_into: T-032
dependencies:
  - T-034
  - T-036
governance_scope: STDO-UX, REQ-OM-BLD-003 through REQ-OM-BLD-008
target_truth: >-
  Multiple admitted builds can be queued and run concurrently while Project,
  revision, request, process, output, run, freshness, and attention identity
  remain isolated.
closure_law: >-
  Close when explicit concurrency policy governs queue slots and proof runs at
  least two Project builds concurrently through success, failure, cancellation,
  late events, and focus changes without state collision.
evaluation_criteria:
  - Queue and active concurrency are distinguishable.
  - One execution cannot consume another execution's process, output, run, or command event.
  - Cancellation and completion affect only the named execution.
  - Portfolio remains accurate while focus alternates between Projects.
  - Concurrency limits survive refresh/reconnect.
proof_surface:
  - build_tenants/react_vite/src/capabilities/build-control/
  - build_tenants/react_vite/src/capabilities/build-portfolio/
  - build_tenants/react_vite/runtime/tests/
  - build_tenants/react_vite/tests/e2e/
non_closure_conditions:
  - Concurrency is simulated only with static fixtures.
  - Global process or output state is shared across executions.
  - One Project's completion mutates another Project's posture.
---

# T-037: Concurrent Build Control MVP

This ticket owns W20 and begins only after the single-build and portfolio MVPs
close.

## Execution Refinement 2026-07-11

T-036's manager-owned supervisor boundary is automation-verified; only its
external odd_glc carrier gate remains open. W20 may therefore prove scheduler,
queue, isolation, Portfolio projection, focus changes, and cancellation against
real fixture processes at the admitted adapter boundary. That proof cannot
substitute for T-036 or T-039 live odd_glc closure.

## Manager Implementation Evidence 2026-07-11

- The single supervisor now enforces explicit global `maxConcurrent` and
  `maxQueued` policy, stable FIFO queue positions, and independent execution
  roots for worksite, stdout, stderr, and terminal result.
- Build Portfolio consumes a downstream activity projection from that store:
  per-Project running, queued, waiting-human, terminal, latest execution, run,
  failure, stale, and disconnected posture. It owns no rival process state.
- The capability declares polling while executions are active. Host integration
  refreshes Portfolio from changed execution truth without copying it into
  Workbench state.
- Restart recovery retains Project/request/execution/process identities and
  reports formerly running work as `disconnected`; it does not infer failure or
  convergence.

## Verification 2026-07-11

- Real-process service proof runs two Projects concurrently with independent
  converged and failed typed results, then proves a one-slot queue releases in
  order and restart recovery remains identity-stable.
- Same-Project proof runs two requests concurrently and preserves independent
  request, execution, process, worksite, output, and run identity without
  cross-contamination.
- Browser proof submits alpha, changes Project focus through Portfolio, submits
  beta, observes both concurrency slots occupied, returns to alpha, and proves
  alpha convergence and beta failure retain distinct run refs and output.
- The existing real-process cancellation scenario proves named cancellation
  affects only its execution. Reducer replay rejects late cross-Project results.
- TypeScript contracts and production client build pass. The inspected
  concurrent desktop screenshot has no overlap or text escape.

## Lifecycle Completion Audit 2026-07-11

- Scheduler recovery uses the same stale/disconnected/reconnect contract as
  single-build supervision. Reconnect does not mint a replacement execution or
  release identity into another Project's slot.
- Production registry proof confirms lifecycle observation and cancellation
  methods survive digest-pinned module admission, so concurrent external builds
  need no manager-side shell or process fallback.
- The complete regression lane retains the two-Project and same-Project
  isolation proofs after lifecycle recovery was added.

## Remaining Closure Gate

W20's manager boundary was ready for operator review. Production activation
still depends on non-test product carriers; these fixture processes are dynamic
scheduler proof and are not represented as odd_glc data-mapper proof.

## Prime-Set Acceptance 2026-07-11

Accepted. Explicit queue/concurrency policy, real-process two-Project and
same-Project execution, identity isolation, cancellation, focus changes, and
restart posture satisfy the manager-owned closure law. Live product-carrier
activation is a single T-032 residual, not a reason to retain this completed
iteration as a duplicate active ticket.

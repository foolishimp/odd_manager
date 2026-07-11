---
id: T-036
title: Deliver the single Build Control MVP
type: feature
ticket_category: ordinary
status: completed
review_status: manager_slice_accepted_external_residual_merged_into_t032
proof_status: verified_by_automation
execution_state: manager_mvp_complete_external_residual_owned_by_t032
goal: G-006
source_ticket: T-032
sprint: SPRINT-2026-07-10-abg46-observation-reprice
build_tenant: react_vite
owner: codex
change_intent: >-
  Deliver W19 MVP 3: admit, start, supervise, correlate, attach to, and cancel
  one typed build pinned to a Project Revision and a published semantic carrier.
change_class: design_reframe
re_entry_point: react_vite_capability_design
affected_boundary: BuildCarrierDescriptor admission, BuildRequest and BuildExecution store, allowlisted worksite/execution adapters, process supervisor, ABG run correlation, capability UX and proof
priority: high
triaged_at: 2026-07-11
created_at: 2026-07-11
updated_at: 2026-07-11T19:57:31+10:00
merged_into: T-032
dependencies:
  - T-033
external_dependencies:
  - odd_glc T-033 standard declarations-only migration
  - odd_glc T-034 manager-callable software-build carrier descriptor
governance_scope: STDO-UX, REQ-OM-BLD-*, GTL/ABG command and runtime ownership
target_truth: >-
  One build enters through a typed descriptor and request, runs through a
  bounded manager-owned process lifecycle, and correlates to ABG-owned run
  truth without arbitrary argv, test-harness execution, or manager-owned graph
  policy.
closure_law: >-
  Close only when a published non-test carrier is admitted, one build survives
  submit through terminal posture with stable Project/revision/correlation,
  attach/cancel and failure paths are replayable, and process outcome remains
  separate from assurance.
evaluation_criteria:
  - No Build control is enabled until descriptor, provisioner, and adapter are admitted.
  - BuildRequest and BuildExecution satisfy the shared contract schemas.
  - Process and ABG Run identities remain distinct and correlated.
  - Refresh/reconnect resumes the same execution identity where valid.
  - Manager actions do not choose ABG traversal, continuation, evidence, or closure.
proof_surface:
  - odd_glc published carrier evidence
  - build_tenants/react_vite/src/capabilities/build-control/
  - build_tenants/react_vite/src/server/
  - build_tenants/react_vite/runtime/tests/
  - build_tenants/react_vite/tests/e2e/
non_closure_conditions:
  - The odd_glc node:test live harness is invoked as the carrier.
  - Browser input supplies executable path or argv.
  - Missing carrier falls back to an ordinary shell.
  - Process exit establishes gate, asset, or closure truth.
---

# T-036: Single Build Control MVP

This ticket is dependency-blocked by the odd_glc declarations-only and public
carrier work. The Build capability remains unavailable until those conditions
are satisfied.

## Execution Refinement 2026-07-11

The production activation and live closure gate remain dependency-blocked.
The manager-owned contract, descriptor admission, immutable worksite,
supervisor, reducer, UX, and real-process fixture proof may proceed because
they do not manufacture or substitute the missing odd_glc carrier.

Common design ADR-001 applies: Build Control has one canonical State/Msg/
Update/Cmd function. Portfolio and later placements consume its downstream
snapshot rather than creating another process or execution store.

## Manager Implementation Evidence 2026-07-11

- Added runtime-validated descriptor admission at `.odd/build-carrier.json`.
  Product mismatch, malformed descriptors, missing submit support, and unknown
  provisioner/adapter refs fail closed. No shell fallback exists.
- Added one manager-owned durable supervisor with explicit queue/concurrency
  limits, request/execution correlation, atomic state, restart-to-disconnected
  recovery, output tails, attach, and attributed cancellation.
- Added a server-minted immutable Project worksite. Source-before,
  source-after, and copied-worksite fingerprints must agree; revision drift
  and external symlinks fail before spawn.
- Added typed process and terminal-result contracts. Exit zero without a valid
  terminal result is failure; process outcome, carrier result, run refs, and
  assurance remain separate fields.
- Replaced the structural shell with one State/Msg/Update/Cmd capability and
  command interpreter. It exposes descriptor/basis, declared JSON input,
  scheduler posture, execution identity, process/run correlation, freshness,
  bounded output, attach, and cancel.
- The deterministic fixture adapter executes a real Node child process only
  when `OMAN_BUILD_FIXTURE_MODE=1`. Browser input cannot supply executable,
  argv, environment, or worksite path.
- Completion audit added one manager-local production adapter registry. Each
  installed module is a regular file with a pinned SHA-256, exact adapter
  identity, explicit factory export, and install lineage. Invalid registry,
  digest, import, export, identity, or reserved fixture installation stops
  server admission.
- Adapter-validated inputs must remain JSON values. Internal process plans are
  strict and cannot move cwd outside the real immutable worksite, redirect the
  manager-minted result path, or add shell/spawn options.

## Verification 2026-07-11

- Service proof covers descriptor failure, exact-basis worksite provisioning,
  one typed convergence, cancellation, cross-Project concurrency, escaping
  symlink rejection, and arbitrary process-field rejection.
- A digest-pinned external module executes a typed real-process build through
  production service with fixture mode disabled. Negative registry proof covers
  digest drift, fixture identity injection, and cwd escape before spawn.
- Msg replay covers typed submit, attach, cancel, stale basis, and late
  cross-Project result rejection.
- Focused Playwright proof passed both missing-carrier and admitted-carrier
  paths. The admitted path exercised a real process through convergence,
  output attachment, cancellation, and desktop/mobile containment.
- TypeScript contracts and the production client build pass. Process success
  remains visibly paired with `Assurance: Not established`.

## Lifecycle Completion Audit 2026-07-11

- Restart recovery now projects an active execution as `stale`, then
  `disconnected` after a bounded recovery window; neither state is inferred as
  failure or convergence.
- The descriptor may publish `resume`. `build.resume` preserves the exact
  execution identity, records `resumedBy` and `resumedAt`, and follows the
  adapter's typed observations until a lawful terminal result is admitted.
- The digest-pinned production registry preserves optional
  `observeExecution` and `cancelExecution` methods. External cancellation is
  accepted only after adapter confirmation when no manager child handle exists.
- Service and replay proof cover stale-to-disconnected timing, same-identity
  reconnect, continued observation, stored-output attachment, attributable
  reconnect, and adapter-confirmed cancellation.

## Remaining Closure Gate

The manager boundary, including production adapter installation, was ready for
operator review. At that review T-036 remained active because odd_glc
T-033/T-034 had not published the non-test ABIogenesis carrier and adapter
module required by this ticket's live closure law. Manager conformance evidence
proves the installation contract only and is not represented as odd_glc build
proof.

## Prime-Set Compression 2026-07-11

The manager-owned single-build slice is accepted: descriptor admission,
immutable worksite, digest-pinned adapter registry, typed process supervision,
reconnect/cancel behavior, and fail-closed proof are complete. This ticket is
completed by compression rather than by claiming the missing live odd_glc
carrier. That one external residual is now owned only by T-032.

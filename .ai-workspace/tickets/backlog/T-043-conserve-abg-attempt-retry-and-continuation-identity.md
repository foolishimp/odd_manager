---
id: T-043
title: Conserve ABG attempt retry and continuation identity
type: feature
ticket_category: ordinary
status: backlog
review_status: blocked_pending_t042_closure_and_full_identity_joins
proof_status: partial_foundation_verified_non_closure
goal: G-009
build_tenant: react_vite
owner: unassigned
priority: high
created_at: 2026-08-28
updated_at: 2026-08-28
change_intent: replace count- and adjacency-derived traversal closure with identity-conserving graph-call, frame, vector, attempt, retry, and continuation folds
change_class: realization_refactor
re_entry_point: accepted_design_v2
affected_boundary: ABG event index typed folds, traversal projection service and contracts, Run activity diagnostics, lazy vector detail, Run Inspector traversal presentation and replay
selected_method_basis: stdo_odd_manager.json#/constitution/stdo/basis
candidate_design: build_tenants/common/design/ABG_EVENT_STREAM_COMPATIBILITY.md
candidate_design_sha256: sha256:c6f27941bd569ef55d808e948fdb58b5750c036d91790aa98bfbac5355889dbd
dependencies:
  - T-042 accepted
requirements:
  - REQ-OM-ABG-004
growth_authority: none_until_t042_is_accepted
---

# T-043: Attempt, Retry, And Continuation Identity

## Outcome

The manager projects ABG graph calls, frames, semantic vectors, invocation
attempts, retries, and continuations through their published relations. Every
current Hello World baseline remains converged while retaining its retry
history and does not emit a false `run_has_open_closure` diagnostic.

## Scope

- Fold graph-call, frame, vector, attempt, retry, and continuation families
  from the shared event index.
- Key joins by published identifiers and emit explicit unmatched or
  contradictory-relation diagnostics.
- Replace planned/evaluated/closed raw-count subtraction as closure meaning.
- Move Traversal summary/detail onto the same admitted run basis and event
  index as Run Observation.
- Preserve retry history and bounded lazy detail after aggregate terminal
  convergence.

## Acceptance

- Basic CLI, JS Tenant Test, JS SDLC Bootstrap, and Parallel JS each project
  ten invocation attempts, eight semantic vectors, two retries, four
  continuation events, and one converged terminal without false open closure.
- Rust CLI and Rust Service each project nine invocation attempts, eight
  semantic vectors, one retry, two continuation events, and one converged
  terminal without false open closure.
- Interleaved, nested, duplicated, unmatched, and out-of-order identity
  relations are covered by negative tests.
- Traversal and Run Observation cannot select different bases for one run.
- Module replay, installed Run Inspector behavior, typecheck, build, and
  accessibility pass.

## Non-Closure

- Special-casing the Rust Service scenario or subtracting retry counts.
- Joining frames/vectors by array adjacency when published identities exist.
- Hiding retries after terminal convergence.
- Treating event terminality as manager process-lifecycle truth.

## Current Checkpoint

T-042 now supplies the shared identity/event basis and a bounded retry-aware
semantic-vector fold. The latest Rust Service subject projects eight semantic
vectors, nine invocation attempts, one retry, two continuation events, one
converged terminal, and no false open-closure diagnostic. This is prerequisite
evidence only: Traversal's full published graph-call/frame/vector/attempt/
continuation identity joins and the declared interleaved/nested negative matrix
remain open in T-043.

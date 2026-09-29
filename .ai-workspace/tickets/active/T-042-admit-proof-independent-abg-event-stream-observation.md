---
id: T-042
title: Admit proof-independent ABG event-stream observation
type: feature
ticket_category: implementation_migration
migration_strategy: inside_out_hard_break
library_usage: none
library_rationale: the event-envelope and filesystem-admission contract is an ABG boundary-specific migration; reusable strict-JSON parsing is kept in one local service without declaring a cross-Product library
status: active
review_status: candidate_ready_for_independent_review
proof_status: verified_t042_installed_path_pending_independent_acceptance
goal: G-009
build_tenant: react_vite
owner: unassigned
priority: critical
triaged_at: 2026-08-28T00:00:00+10:00
created_at: 2026-08-28T00:00:00+10:00
updated_at: 2026-08-28T00:00:00+10:00
intake_source: Direct Product-owner instruction on 2026-08-28 to implement odd_manager ABIogenesis 5.0 compatibility against the exact current artifact and odd_glc run portfolio
change_intent: realize the first identity-first ABG observation slice so a bounded non-terminal event stream is visible before terminal proof exists
change_class: realization_refactor
re_entry_point: implementation_migration
affected_boundary: Project observation topology, shared run-basis discovery, server event ingestion and index, AbgRunObservation v3, browser ingress, Run Observation replay and bounded Run Inspector overview/events
selected_method_basis: stdo_odd_manager.json#/constitution/stdo/basis
candidate_design: build_tenants/common/design/ABG_EVENT_STREAM_COMPATIBILITY.md
candidate_design_sha256: sha256:c6f27941bd569ef55d808e948fdb58b5750c036d91790aa98bfbac5355889dbd
dependencies:
  - T-041 independent acceptance remains a final closure gate; its verified current governance route is sufficient for this directly instructed implementation checkpoint
  - independent review of the exact implementation baseline remains required for closure
requirements:
  - REQ-OM-ABG-001
  - REQ-OM-ABG-002
  - REQ-OM-ABG-003
  - REQ-OM-ABG-008
growth_authority: bounded_g009_event_observation_migration_only
target_truth: the published run identity plus one admitted ABG event carrier is runtime observation truth; optional proof reconciles later and exact envelope profile bounds compatibility posture
superseded_truth: terminal proof presence and proof.eventSequence are prerequisites and the authoritative event source for Run Observation and Traversal
closure_law: close only when every affected server and browser consumer reads the shared identity/event basis, proof is demoted to reconciliation, mixed truth is rejected, the negative carrier matrix passes, and installed-path evidence preserves exact compatibility labels
evaluation_criteria: exact ABIogenesis 5.0 emitter fixture, latest odd_glc Hello World portfolio, stopped Data Mapper carriers, node/runtime tests, typecheck, production build, installed HTTP/browser path, governance checks, and diff integrity
non_closure_conditions: direct service success alone, relabeling a 4.6 carrier, whole-ledger browser loading, proof fallback as event authority, inferred process liveness, or green mixed old/new tests
proof_surface: build_tenants/react_vite/runtime/tests/test_abg_event_carrier.mjs; test_abg_5_0_event_compatibility.mjs; test_abg_event_compatibility_portfolio.mjs; test_project_observation_topology_security.mjs; test_sidecar_msg_replay.mjs; qualification/abg-5-compatibility-portfolio.json; installed server/browser probes
---

# T-042: Proof-Independent ABG Event-Stream Observation

## Outcome

One selected Project exposes a run from `sandbox-identity.json` and its
in-boundary durable `events.jsonl` even when no terminal proof exists. The Run
Inspector shows exact carrier identity, a bounded stable event prefix,
event-kind counts, non-terminal event posture, unavailable process posture,
and source-linked diagnostics.

## Scope

- Introduce one shared run-basis resolver used by topology, Run Observation,
  and Traversal discovery.
- Admit bounded identity carriers with duplicate-key, path-containment, and
  contradiction checks.
- Incrementally parse and index JSONL on the server, including large lines and
  a partially written final line.
- Publish `AbgRunObservation` v3 carrier, event, process, and proof postures.
- Add bounded event-page/detail commands with Project/run/generation stale
  guards and browser ingress validation.
- Reconcile a later proof against exact count, digest, identity, and event
  order without making proof the event source.
- Keep existing v2 consumers green through one internal one-way adapter while
  migration is in progress; no compatibility field may restore proof as event
  authority.

## Non-Scope

- Typed actor, C-call, payload, requirement, or temporal projections.
- Build process discovery or control.
- General ABIogenesis 4.6 or 5.0 compatibility claims.
- T-040 graph visualization or foreign PTY behavior.

## Acceptance

- The stable stopped Data Mapper root is discovered and returns a ready
  non-terminal observation without a proof file.
- A changing Data Mapper stream produces only a bound complete prefix or a
  fail-closed mutation diagnostic; it never presents a mixed snapshot.
- The supported path handles a 126,104,826-byte stream and a 4,117,268-byte
  event line without whole-carrier browser serialization.
- Missing/malformed/escaping/contradictory identity, invalid JSONL, duplicate
  event id, ordinal discontinuity, stale cursor, and proof digest mismatch all
  fail honestly.
- A synthetic append followed by terminal proof reconciles without changing
  run identity.
- Existing Project deep links, six completed Hello World observations,
  traversal selection, replay, typecheck, build, and browser accessibility
  remain green.

## Non-Closure

- Loading a complete proof object and calling that incremental observation.
- Inferring running or stopped process state from event recency.
- A fixture-only proof with no installed server/browser Data Mapper path.
- Introducing separate run selectors for topology, observation, and traversal.
- Reporting ABIogenesis 5.0 compatibility from a carrier that publishes
  `4.6.0-rc.3`.

## Migration Declaration

- affected_scope: the React/Vite tenant's Project run discovery, ABG event
  ingestion, Run Observation, Traversal projection, HTTP endpoints, browser
  ingress, reducer replay, and Run Inspector event presentation
- excluded_or_disjoint_scopes:
  - the retained ABIogenesis 4.6 flat carrier is an explicit compatibility
    profile selected only by its zero-based flat envelope and published
    substrate identity
  - BuildExecution/process control remains separately routed through manager
    Build Control and never through event recency
  - T-040 visual graph/foreign PTY work remains independently gated
  - ABG event creation or mutation remains owned by ABIogenesis
  - exact odd_glc-on-ABIogenesis-5.0 Product qualification remains T-045 scope
- old_truth_path: proof-gated topology plus `proof.eventSequence` consumed by
  observation and traversal, with proof-shaped v2 browser payloads
- new_truth_path: strict identity admission plus
  `abg-event-carrier-service.mjs` as one bounded envelope-profile index, with
  proof reconciliation and v3 page/detail projection downstream
- producers_old:
  - proof candidates beside `sandbox-identity.json`
  - proof-derived event counts, event sequence, and terminal summaries
- producers_new:
  - exact run-root and workspace `sandbox-identity.json` bytes
  - canonical in-workspace `.ai-workspace/events/events.jsonl` bytes
  - `project-observation-topology-service.mjs`
  - `abg-event-carrier-service.mjs`
- consumers_old:
  - proof-gated Project observation topology
  - proof-shaped Run Observation service and browser validator
  - Traversal proof root resolver and adjacency/count projections
- consumers_new:
  - `abg-run-observation-service.mjs`
  - `traversal-projection-service.mjs`
  - `/api/ai-workspace/run`, `/run/events`, and `/run/event`
  - v3 browser ingress, Sidecar State/Msg/Update/Cmd/Sub, and Run Inspector
- derived_surfaces:
  - Project run selector and run status
  - carrier/event/process/proof/compatibility postures
  - event-kind and bounded event-family summaries
  - paged event rows and lazy exact event detail
  - traversal, diagnostics, artifacts, and qualification dispositions
- retained_compatibility: `abiogenesis_4_6_flat` is deliberately retained as a
  non-overlapping exact profile; it cannot satisfy or impersonate
  `abiogenesis_5_root`
- closure_law: the migration closes only when proof is no longer authoritative
  anywhere in the affected scope, every consumer shares the new basis, mixed
  profiles and stale generations fail closed, and installed proof binds the
  exact subject without broadening its label

## Ordered Break Sequence

1. Publish strict JSON and the bounded event index; sever whole proof-object
   loading as the only event source. Negative proof: malformed, duplicate,
   mixed, discontinuous, oversize, mutating, and stale carriers fail closed.
2. Reprice topology to identity-first discovery; sever proof presence as the
   run-admission gate. Negative proof: missing proof remains observable while
   malformed, conflicting, or escaping identity/carrier paths are rejected.
3. Reprice Run Observation to v3; sever `proof.eventSequence` as runtime
   authority. Negative proof: proof conflict cannot change the event prefix or
   produce positive compatibility posture.
4. Reprice Traversal onto the shared topology/event basis; sever its separate
   proof-root selector. Negative proof: Run Observation and Traversal select
   the same digest and non-terminal runs remain inspectable.
5. Reprice browser ingress and reducer effects; sever whole-ledger and
   component-local filesystem behavior. Negative proof: stale Project, run,
   generation, page, and detail responses cannot replace admitted state.
6. Qualify exact 4.6 and 5.0 profiles independently; sever operator-wave labels
   as compatibility identity. Negative proof: all inspected odd_glc 4.6
   carriers remain 4.6 and an exact 5.0 emitter fixture cannot become an
   odd_glc-on-5.0 runtime claim.

## Migration Checklist

- [x] exact affected migration scope is named
- [x] excluded or disjoint Product and compatibility scopes are named with deterministic routing
- [x] old truth path is named explicitly
- [x] new truth path is named explicitly
- [x] producer set for the new truth is listed
- [x] consumer set for the new truth is listed
- [x] projection/read-model surfaces are listed
- [x] old truth path is removed or explicitly demoted from authority within the affected scope
- [x] mixed-state behavior is no longer accepted as closure evidence
- [x] tests proving mixed old/new behavior are removed or repriced
- [x] recurring realization patterns are checked against existing library/commonization surfaces
- [x] ticket declares library usage and names the governing library or rationale
- [x] this tenant-local ticket carries only the React/Vite lifecycle; no sibling tenant implementation is implied
- [x] ticket wording, Product wording, and proof claims are reconciled before closure

## Current Checkpoint

The exact 5.0.0-dev.286 emitter contract passes envelope, payload-digest,
content-addressed event-id, causal-ref, paging, detail, proof-reconciliation,
integrity-failure, and stale-generation tests. The six latest terminal odd_glc
Hello World runs reconcile exactly through v3. The latest stopped 69 MB Data
Mapper and the significant stopped 126 MB Data Mapper remain bounded,
proof-independent, and explicitly non-terminal. The Rust Service projects
eight semantic vectors, nine invocation attempts, one retry, two continuation
events, and no false open closure.

The source-blind installed candidate now passes 464 runtime tests, its
production build, and all 19 declared operator browser outcomes. That browser
path pages and opens exact 5.0 event detail and observes the latest stopped
Data Mapper without proof or invented process liveness. T-042 remains active
only for independent acceptance. T-043 and T-044 retain their richer
identity-join and presentation scope. T-045 retains the absent self-identified
odd_glc-on-5.0 runtime carrier gate.

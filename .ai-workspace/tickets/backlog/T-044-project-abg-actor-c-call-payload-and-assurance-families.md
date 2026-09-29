---
id: T-044
title: Project ABG actor C-call payload and assurance families
type: feature
ticket_category: ordinary
status: backlog
review_status: blocked_pending_t043_and_typed_lifecycle_design
proof_status: generic_family_foundation_verified_non_closure
goal: G-009
build_tenant: react_vite
owner: unassigned
priority: high
created_at: 2026-08-28
updated_at: 2026-08-28
change_intent: expose the ABI development wave's actor, C-call, response, payload, requirement-route, authority, ambiguity, evidence, and temporal event families as bounded source-linked projections
change_class: capability_extension
re_entry_point: accepted_design_v3_v4
affected_boundary: typed ABG event folds and contracts, lazy detail endpoints, Run Observation State/Msg/Update/Cmd/Sub, Run Inspector lifecycle and assurance views, source navigation and domain-overlay seam
selected_method_basis: stdo_odd_manager.json#/constitution/stdo/basis
candidate_design: build_tenants/common/design/ABG_EVENT_STREAM_COMPATIBILITY.md
candidate_design_sha256: sha256:c6f27941bd569ef55d808e948fdb58b5750c036d91790aa98bfbac5355889dbd
dependencies:
  - T-043 accepted
requirements:
  - REQ-OM-ABG-005
  - REQ-OM-ABG-006
  - REQ-OM-ABG-007
growth_authority: none_until_t043_is_accepted
---

# T-044: Actor, C-Call, Payload, And Assurance Families

## Outcome

The Run Inspector can reconstruct bounded actor and C-call lifecycles,
instruction response contracts, typed payload integrity, and generic
requirement/assurance facts from exact event identities and causal references.
Unknown families remain visible without becoming manager- or domain-authored
meaning.

## Scope

- Actor invocation/result/closure folds.
- C-call lifecycle keyed by `cCallRef`.
- Instruction response-contract and artifact/digest relations.
- Payload observed/validated/rejected relations and exact issues.
- Open requirement-route, authority, ambiguity, closure-input, evidence, and
  temporal-verdict summaries with lazy exact detail.
- Bounded UI projections, source navigation, replay, and admitted domain-label
  overlays.

## Acceptance

- Every typed row conserves exact event identity, ordinal, carrier generation,
  and published causal refs.
- Rejected payload is visible as rejection, not collapsed into generic failure
  or silently omitted.
- Repeated Data Mapper requirement-route facts remain server-indexed and
  bounded in browser state.
- Missing lifecycle members and contradictory joins produce partial state and
  diagnostics rather than synthetic completion.
- Unknown event and route-payload kinds remain counted, inspectable, and
  source-linked.
- Installed Run Inspector, reducer replay, negative ingress, accessibility,
  typecheck, and build proofs pass.

## Non-Closure

- Copying the full Data Mapper ledger or repeated requirement facts into
  reducer state.
- Parsing opaque refs as embedded domain objects.
- Treating a C-call as a GraphCall, frame, vector, or external process.
- Letting a domain overlay redefine ABG identity or disposition.

## Current Checkpoint

T-042 publishes bounded open `actor`, `cCall`, `payloadIntegrity`, and
`assurance` event families with exact event identity, ordinal, causal refs, and
lazy source detail. Those generic rows prevent data disappearance but do not
close this ticket: typed lifecycle joins, partial/contradictory relation
diagnostics, dedicated views, payload-rejection presentation, and the full
negative ingress/accessibility matrix remain T-044 scope.

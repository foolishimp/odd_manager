---
id: B-014
title: Add executable UX Msg-replay proof for sidecar product interactions
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Replace documented-only UX replay confidence with executable Msg-replay proof for SidecarPanel product-meaningful interaction families.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/runtime/tests or frontend test harness, build_tenants/react_vite/qualification/scenario_portfolio.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-010
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Codex sidecar-wave STDO review found scenario S-U1 is documented but not executable, while UX_METHOD requires executable Msg-replay proof before method closure.
target_truth: SidecarPanel carries executable Msg-replay proof for project selection, ticket transition result handling, comment reply/read state, and session spawn/kill interaction state.
superseded_truth: Reducer purity is asserted by inspection and S-U1 is a manual/documented procedure only.
closure_law: This bug closes when replay tests can start from an initial State fixture, apply an ordered Msg log and deterministic Cmd result messages, and assert final State and expected Cmd descriptions for each product-meaningful interaction family.
evaluation_criteria:
  - SidecarPanel exports or exposes testable State, Msg, initial state, update, and Cmd description logic without leaking UI implementation detail
  - replay test covers project selection and context update
  - replay test covers ticket action result and reload intent
  - replay test covers comment reply draft/edit/cancel/result flow
  - replay test covers session spawn/kill action result state
  - scenario_portfolio S-U1 moves from documented to green only after executable proof exists
proof_surface:
  - executable Msg-replay tests
  - refactor of SidecarPanel reducer/Cmd declarations if needed
  - scenario portfolio update
non_closure_conditions:
  - replay remains manual only
  - correctness depends on refs, closures, DOM state, network results, or timers not represented as Msg/Cmd fixtures
  - tests assert render snapshots without replaying Msg state transitions
---

## STDO Reading

UX_METHOD makes Msg replay a closure proof, not a commentary confidence claim.
This bug keeps the sidecar UX under the stricter interpretation of STDO-UX.

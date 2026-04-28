---
id: B-057
title: Align Sidecar runtime provider proof with Browse rail
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Keep the Sidecar replay proof aligned with the current selector rail provider contract.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
priority: medium
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T07:25:00Z
build_tenant: react_vite
dependencies:
  - B-053 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar selector rail replay proof
intake_source: B-056 verification exposed that the runtime replay test still expected the provider registry to stop at projects/tickets/comments/sessions.
target_truth: Sidecar provider replay proof includes `browse`, because Browse is a fixed bottom recovery and folder-pinning surface in the current rail design.
superseded_truth: Runtime replay proof treats Browse as absent from the provider registry.
closure_law: This ticket closes only when the sidecar-wave runtime proof accepts Browse as an intentional provider and verification passes.
evaluation_criteria:
  - provider registry assertion includes `browse`
  - sidecar-wave runtime proof passes
proof_surface:
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
---

## SPEC_METHOD Triage

This is a realization-proof correction. Browse is already part of the current
rail model; the failing assertion was stale proof text from before B-053.

Lawful re-entry point: Realization.

## Closure Evidence

Aligned the Sidecar runtime proof with the current selector rail:

- `SIDECAR_EXPLORER_PROVIDERS` assertion now includes `browse`
- the runtime proof now reflects Browse as the fixed bottom recovery and
  folder-pinning surface added by the current rail design

Verified:

- `npm run test:sidecar-wave`: 115 Node tests and 7 Python tests passed

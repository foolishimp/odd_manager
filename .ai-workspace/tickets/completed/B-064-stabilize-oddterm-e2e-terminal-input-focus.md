---
id: B-064
title: Stabilize OddTerm e2e terminal input focus
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the local shell browser test type through the actual xterm input surface instead of relying on a broad page keyboard target.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/tests/e2e/odd-manager-collaboration.spec.ts
priority: medium
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T14:47:46Z
build_tenant: react_vite
dependencies:
  - B-063 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: OddTerm local shell workspace verification
intake_source: Full Playwright verification found one non-Sidecar failure: the local shell test clicked the terminal host, used page-level keyboard input, and timed out before observing the echo marker.
target_truth: The E2E test sends input through the focused xterm textarea role, uses a unique marker, and proves terminal round-trip behavior deterministically.
superseded_truth: The E2E test relies on a broad host click and `page.keyboard`, which can miss the xterm input target under concurrent browser layout and existing session load.
closure_law: This ticket closes only when the test uses the terminal input role directly and the full Playwright suite passes.
evaluation_criteria:
  - test waits for the xterm terminal input textbox to be focused
  - test sends text via the focused input locator
  - test uses a unique marker rather than a reusable literal
  - full Playwright suite passes
proof_surface:
  - build_tenants/react_vite/tests/e2e/odd-manager-collaboration.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor of the proof surface. The product behavior is
unchanged; the test was not targeting the concrete input affordance tightly
enough.

Lawful re-entry point: Realization.

## Closure Evidence

Changed the OddTerm browser proof to focus and type through the actual xterm
textarea role and assert a unique echo marker.

Verification passed:

- `npm run test:e2e` (26 passed)

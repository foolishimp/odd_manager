---
id: B-062
title: Harmonize Sidecar theme contrast across light and dark-grey
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove hardcoded light/dark color islands from Sidecar controls and markdown surfaces.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T14:47:46Z
build_tenant: react_vite
dependencies:
  - B-061 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar light/dark-grey theme harmony
intake_source: Operator screenshots showed dark-grey still had very white segmented controls and light mode still had very dark markdown/code blocks.
target_truth: Sidecar controls, pills, and markdown code surfaces derive from shared theme tokens. Dark-grey has no light-only control islands; light mode has readable but not navy-black code surfaces.
superseded_truth: Dark-grey inherits light `rgba(255...)` component fills in segmented controls and pills, while markdown code blocks are hardcoded to a dark navy slab in all themes.
closure_law: This ticket closes only when the clashing fills are tokenized and executable proof checks the relevant CSS and browser-computed dark-grey control color.
evaluation_criteria:
  - segmented layout controls derive their background from `var(--panel)` instead of light-only rgba
  - summary pills derive their background from `var(--panel)` instead of light-only rgba
  - markdown code blocks use code theme variables rather than a hardcoded navy background
  - light, dark-blue, and dark-grey define code-surface tokens
  - dark-grey browser proof checks segmented controls are not pale
proof_surface:
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor. The product requirement for one shared visual
language is already active; the defect is local CSS drift from that token
grammar.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented theme-token alignment for segmented controls, summary pills, and
markdown code blocks. Added runtime CSS proof for light, dark-grey, and
dark-blue code-surface tokens and browser proof that the dark-grey segmented
control no longer computes to a pale/light fill.

Verification passed:

- `npm run build`
- `npm run test:sidecar-wave`
- `npm run test:e2e` (26 passed)

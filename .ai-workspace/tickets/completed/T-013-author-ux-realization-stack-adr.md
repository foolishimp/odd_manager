---
id: T-013
title: Author UX realization stack ADR
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Record the tenant-local UX realization stack choice (typed reducer plus Cmd interpreter plus shared typed contract) as a build-tenant ADR so every UX-touching ticket downstream can name its State/Msg/Update/Cmd shape under a known stack.
change_class: design_reframe
re_entry_point: design_surface
affected_boundary: tenant-local UX realization stack, ADR surface under build_tenants/react_vite/design/, downstream UX ticket prerequisites
priority: critical
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies: []
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: UX_METHOD.md §12 (Realization Discretion); UX_METHOD.md §13 (Adoption Guidance) step 2; user direction 2026-04-26 that realization stack choices live in build_tenants/<tenant>/design ADRs not constitutional spec; comments/claude/20260424T140000Z_STRATEGY P3 single-shape rule
target_truth: A tenant ADR under build_tenants/react_vite/design/ records the chosen UX realization stack (typed reducer plus Cmd interpreter plus shared typed-contract mechanism), with a UX_METHOD §4-mapping table that names which chosen-stack mechanism realizes each Elm-process-model concept (State, Msg, Update, View, Cmd, Sub), and a one-paragraph rationale for how the stack preserves §4–§8.
superseded_truth: UX realization choice is implicit in widget-by-widget code patterns; some widgets use direct useState, some use ad-hoc context, no shared reducer pattern, no declared effect membrane.
closure_law: this ticket closes when the ADR file exists under the tenant's design ADR path, names exactly one chosen stack, includes the §4-mapping table explicitly, names the effect-membrane mechanism, names the shared FE/BE typed-contract mechanism, and is referenced by T-006 and T-010.
evaluation_criteria:
  - ADR file exists under build_tenants/react_vite/design/ at the tenant's ADR convention path
  - exactly one realization stack is chosen (no alternatives left open)
  - §4-mapping table maps each of State, Msg, Update, View, Cmd, Sub to a chosen-stack mechanism
  - effect-membrane mechanism named explicitly per UX_METHOD §6
  - shared FE/BE typed-contract package or mechanism named explicitly per UX_METHOD §10
  - one-paragraph rationale justifies how the stack preserves the §4 process model and the §6 effect membrane
  - ADR is referenced by T-006 design module and T-010 widget ticket once both land
proof_surface:
  - ADR file under build_tenants/react_vite/design/
  - cross-reference from T-006 design module
  - cross-reference from T-010 widget evaluation
non_closure_conditions:
  - ADR cites multiple stacks without choosing one
  - §4-mapping table absent or partial
  - chosen stack does not preserve §4 process model under inspection
  - ADR placed outside the tenant design tree (e.g., in specification/, in PRODUCT.md)
  - effect-membrane mechanism unnamed
---

## STDO Reading

This is the tenant-local realization-discretion artifact UX_METHOD §12 delegates to the project; landing it as its own ticket prevents every downstream UX ticket from carrying a buried prerequisite.

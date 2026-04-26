---
id: T-006
title: Define AssetSurface contract and .ai-workspace topology design module
type: feature
ticket_category: build_wave
status: active
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Author one shared design-module surface that defines the AssetSurface chassis and binds the .ai-workspace typed collections to it, so per-collection realization tickets instantiate one contract instead of inventing six.
change_class: design_reframe
re_entry_point: design_surface
affected_boundary: design module surface, AssetSurface contract, .ai-workspace topology binding, per-widget instantiation pattern, MCP resource naming
priority: critical
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
dependencies:
  - T-005 completed
  - T-013 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: comments/claude/20260424T140000Z_STRATEGY P4 (AssetSurface contract); existing typed surfaces in src/lib/types.ts (RequirementView, TicketView, CommentView, AssetView, GraphFunctionVectorView); existing oddboard-service.mjs as a partial pre-image
target_truth: One ratified design module defines the AssetSurface chassis (collection spec, query API, change feed, selection contract, action registry, inspector spec, MCP projection) and a .ai-workspace topology binding maps tickets://, comments://, threads://, sessions://, projects:// to the chassis with declared MCP resource names and storage roots.
superseded_truth: Each widget invents its own data-load, selection, and action shape, producing per-widget divergence and re-implementation cost; MCP resource names and topology are implicit in code paths.
closure_law: this ticket closes when a ratified design module under build_tenants/ defines AssetSurface contract and the .ai-workspace topology binding, per-collection tickets (T-007/T-008/T-009) cite it, and the contract is consistent with the Context shape ratified in T-005.
evaluation_criteria:
  - design module names the seven AssetSurface fields explicitly
  - topology binding lists each typed collection and its storage root under .ai-workspace/
  - each collection has a declared MCP resource name
  - selection contract names what gets pushed to active_context
  - action registry shape is uniform across collections
  - design cites PRODUCT.md Context definition from T-005
  - AssetSurface action registry and selection contract conform to UX_METHOD §7 binding rule so UX surfaces can consume projections and emit Msg through declared actions without re-declaring shape
proof_surface:
  - new design module file under build_tenants/common/design/ or build_tenants/react_vite/design/
  - cross-references from T-007, T-008, T-009 once authored
non_closure_conditions:
  - per-collection tickets start before the design module exists
  - topology binding documented only in code comments
  - MCP resource names not chosen
  - chassis fields differ between collections
---

## STDO Reading

This is the D leg of STDO for the wave; without it the realization tickets fail DESIGN_MODULE_METHOD by construction.

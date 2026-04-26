---
id: T-014
title: Refactor consuming UX widgets (OddBoard, OddTerm, workspace pages) under STDO-UX
change_class: realization_refactor
type: feature
ticket_category: build_wave
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Bring every existing odd_manager UX widget that consumes a new AssetSurface (CommentAssetSurface, SessionAssetSurface, TicketAssetSurface) under UX_METHOD compliance, with declared State/Msg/Update/Cmd, AssetSurface action-registry binding, and passing Msg-replay tests.
re_entry_point: realization
affected_boundary: existing widgets src/features/oddboard/, src/features/oddterm/, src/features/requirements/, src/features/process/, src/features/builder/, src/features/graphs/; their consumed AssetSurface bindings; per-widget design module entries
priority: high
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-007 completed
  - T-008 completed
  - T-009 completed
  - T-013 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: existing src/features/{oddboard,oddterm,requirements,process,builder,graphs}/* (some currently uncommitted in working tree); T-007/T-008/T-009 AssetSurface contracts; T-013 UX realization stack ADR; UX_METHOD.md §3 composition rule (UX surfaces governed under UX_METHOD); UX_METHOD.md §13 adoption checklist
target_truth: Each consuming UX widget in scope (OddBoardWidget, OddTermPanel, OddTermWorkspaceWidget, RequirementsWorkspace, ProcessWorkspace, BuilderPanel, GraphWorkspace) is refactored under UX_METHOD: it has a design-module entry declaring State/Msg/Update/Cmd, it binds to its AssetSurface through declared action registries (no direct file or service writes), it holds no product-meaningful state in view-local state cells, no effect handler contains conditional state-transition logic, and the widget passes the §8 Msg-replay test.
superseded_truth: Widgets consume data through ad-hoc API calls and effect handlers; product-meaningful state lives in view-local state cells; no Msg algebra; effect handlers contain branching state-transition logic; types are re-declared per widget instead of imported from a shared contract.
closure_law: this ticket closes when every widget in the in-scope list has a design-module entry declaring State/Msg/Update/Cmd, consumes its AssetSurface through the declared action registry, passes the §8 Msg-replay test on at least one representative scenario, and the per-widget code review confirms §6 effect-membrane and §9 view-shape compliance.
evaluation_criteria:
  - every widget in scope has a design-module entry under build_tenants/react_vite/design/ declaring State, Msg, Update, Cmd
  - every widget in scope binds to its AssetSurface through the declared action registry per UX_METHOD §7
  - every widget in scope passes the UX_METHOD §8 Msg-replay test on at least one representative scenario
  - no widget holds product-meaningful state in view-local state cells (UX_METHOD §5 / §14 #2)
  - no effect handler contains conditional state-transition logic (UX_METHOD §6 / §14 #3)
  - all UX-consumed types are imported from the shared contract per UX_METHOD §10
  - in-flight uncommitted widget modifications in the current working tree are absorbed into this ticket's scope
proof_surface:
  - per-widget design-module entries under build_tenants/react_vite/design/
  - per-widget Msg-replay tests
  - per-widget code review record confirming §6 / §9 compliance
  - shared contract package import audit
non_closure_conditions:
  - any widget in scope skips its design-module entry
  - any widget fails the Msg-replay test
  - product-meaningful state held outside the reducer in any widget
  - any widget writes directly to file or network bypassing the AssetSurface action registry
  - shared types re-declared in any widget
  - effect handler in any widget owns continuation or branching state-transition logic
---

## STDO Reading

This is the actual UX refactor the wave is regulating; without it the in-flight uncommitted widget work lands without method backing.

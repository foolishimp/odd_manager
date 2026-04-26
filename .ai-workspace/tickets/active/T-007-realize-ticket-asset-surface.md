---
id: T-007
title: Realize TicketAssetSurface over .ai-workspace/tickets
type: feature
ticket_category: build_wave
status: active
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Implement one typed surface over the .ai-workspace/tickets/{active,backlog,completed} topology that exposes tickets as records (not files), with status-transition and link actions, change feed, and selection that pushes the active ticket into Context.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: ticket reading and authoring, status transition semantics, ticket-to-Context binding, MCP tickets:// resource
priority: high
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-006 completed
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: src/lib/types.ts TicketView; existing oddboard-service.mjs admission patterns; .ai-workspace/tickets/{active,backlog,completed} topology; T-006 AssetSurface contract; odd_sdlc and abiogenesis ticket frontmatter shapes
target_truth: TicketAssetSurface implements the AssetSurface contract over the tickets topology, with frontmatter parsing covering the rich STDO shape (id, type, status, goal, change_class, re_entry_point, governance_scope, dependencies, evaluation_criteria, proof_surface, non_closure_conditions) and the older sparse shape, change feed on filesystem mutation, status-transition and link actions, and selection emission of the active ticket into Context.
superseded_truth: Tickets are read ad hoc per consumer; status changes are bare file moves with no actioned semantics; no change feed; no Context binding.
closure_law: this ticket closes when TicketAssetSurface implements the AssetSurface contract over the tickets topology, action registry covers status transitions and link operations, tests prove the read path is non-mutating and the change feed is durable across server restart, and the surface is wired into at least one consuming widget.
evaluation_criteria:
  - frontmatter parsing covers active odd_sdlc, abiogenesis, and odd_manager ticket shapes
  - status transitions move files between active/backlog/completed lawfully and atomically
  - change feed emits on filesystem mutation
  - selection on a ticket emits an active_context update consistent with the T-005 shape
  - read path provably does not mutate state
  - rich and sparse frontmatter both round-trip without loss
proof_surface:
  - TicketAssetSurface module
  - frontmatter parser tests covering all three shapes
  - transition tests including failure modes
  - read-only negative tests
  - change-feed durability test
non_closure_conditions:
  - selection writes runtime state
  - status transitions bypass the action registry
  - change feed misses filesystem events
  - rich-shape parsing loses fields on round-trip
---

## STDO Reading

First instantiation of the AssetSurface contract; sets the bar for T-008 and T-009.

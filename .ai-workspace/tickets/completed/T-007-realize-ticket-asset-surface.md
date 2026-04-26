---
id: T-007
title: Realize TicketAssetSurface over .ai-workspace/tickets
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Implement the read half of one typed surface over the .ai-workspace/tickets/{active,backlog,completed} topology that exposes tickets as records (not files) with frontmatter parsing for both the rich STDO shape and the legacy sparse shape, plus a scaffold pane proving end-to-end live read.
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
target_truth: TicketAssetSurface read path implements the AssetSurface §2.1 collection spec, §2.2 query API (list / get / count over a typed filter), and §2.6 inspector spec, with frontmatter parsing covering both the rich STDO shape and the legacy sparse shape. A scaffold pane (T-016) exposes the live read in the browser as the visible proof.
superseded_truth: Tickets are read ad hoc per consumer; consumers re-declare ticket shape per call site.
closure_law: this ticket closes when the read API operates over the live ticket tree, both frontmatter shapes parse without field loss, the surface is consumed by the scaffold pane, and the test suite covers list / get / count / lane filter / build-tenant filter / dependency filter. Write actions and change feed are spun out as T-018.
evaluation_criteria:
  - frontmatter parsing covers active odd_sdlc, abiogenesis, and odd_manager ticket shapes
  - selection on a ticket emits an active_context update consistent with the T-005 shape
  - read path provably does not mutate state
  - rich and sparse frontmatter both round-trip without loss
  - scaffold pane (T-016) consumes the surface and renders ≥15 tickets across lanes
proof_surface:
  - src/server/ticket-asset-surface-service.mjs
  - src/contracts/ticket.ts
  - runtime/tests/test_ticket_asset_surface.mjs (8 passing assertions)
  - scaffold pane visible at http://localhost:4174/
non_closure_conditions:
  - selection writes runtime state
  - rich-shape parsing loses fields on round-trip
  - write actions or change-feed work creep into this ticket's scope (those belong to T-018)
  - read API mutates the underlying tree
---

## STDO Reading

First instantiation of the AssetSurface contract; sets the bar for T-008 and T-009.

## Scope adjustment 2026-04-26

Original scope bundled read + write + change feed in one closure. Per user
direction for incremental progression through STDO-compliant tickets, the
scope is narrowed to the read path here, with write actions and change
feed spun out as T-018 (`source_ticket: T-007`). The scaffold pane proof
is added to the evaluation criteria so this ticket's closure is visibly
demonstrable.

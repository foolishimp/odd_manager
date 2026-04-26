---
id: T-018
title: Realize TicketAssetSurface write actions and change feed
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Add the write half of TicketAssetSurface — status transitions, dependency-link operations, frontmatter-field updates — plus a filesystem-watcher change feed that emits typed events on ticket mutation, completing the §2.3 / §2.5 obligations spun out of T-007.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: src/server/ticket-asset-surface-service.mjs write actions, fs.watch / chokidar change feed integration, action registry shape conformance
priority: high
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
source_ticket: T-007
dependencies:
  - T-007 completed
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: T-007 spin-out (work bounded to read path on closure); ASSET_SURFACE_AND_TOPOLOGY.md §2.3 (Change Feed) and §2.5 (Action Registry); existing oddboard-service.mjs as a write-pattern reference
target_truth: TicketAssetSurface exposes typed write actions (transition-status, link-dependency, assign-to-build-tenant, update-frontmatter-field) per the AssetSurface action-registry shape, and emits change-feed events (created / updated / deleted) on filesystem mutation with cache invalidation hooks already present from T-007.
superseded_truth: TicketAssetSurface is read-only; status changes happen by direct file move outside the action registry; consumers poll instead of subscribing.
closure_law: this ticket closes when each named action operates atomically (with rollback on failure), the change feed emits on every observed filesystem mutation in the three lane directories, and tests prove read/write/feed round-trip is consistent under concurrent mutation.
evaluation_criteria:
  - actions transition-status, link-dependency, assign-to-build-tenant, update-frontmatter-field implemented per §2.5 shape (precondition + Cmd-producing effect)
  - status transitions atomic (single fs.rename, no half-states)
  - change feed emits on fs.watch events for all three lane directories
  - concurrent-mutation test: parallel transitions on different tickets do not corrupt either
  - read cache invalidated on every change-feed event
  - actions are pure values; effects interpreted at the membrane (per UX_METHOD §6 even though this is server-side)
proof_surface:
  - src/server/ticket-asset-surface-service.mjs write + feed additions
  - runtime/tests/test_ticket_asset_surface_write.mjs
  - runtime/tests/test_ticket_asset_surface_feed.mjs
  - concurrent-mutation integration test
non_closure_conditions:
  - status transition is non-atomic (write-then-delete or delete-then-write without rollback)
  - change feed misses fs.watch events
  - read cache stays stale after mutation
  - actions perform side effects directly instead of producing Cmd values
---

## STDO Reading

Closes the §2.3 / §2.5 obligations T-007 spun out so the read path could land atomically.

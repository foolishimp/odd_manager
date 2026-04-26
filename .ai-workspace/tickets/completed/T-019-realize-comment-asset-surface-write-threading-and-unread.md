---
id: T-019
title: Realize CommentAssetSurface write actions, threading, and unread state
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Add the write half of CommentAssetSurface — POSTING_GUIDE-conforming post/reply actions, mark-read semantics, and durable per-agent unread state — plus a change feed, completing the §2.3 / §2.5 obligations spun out of T-008.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: src/server/comment-asset-surface-service.mjs write actions, .ai-workspace/runtime/oddboard/ unread-state persistence, POSTING_GUIDE conformance enforcement
priority: high
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
source_ticket: T-008
dependencies:
  - T-008 completed
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: T-008 spin-out (work bounded to read path on closure); ASSET_SURFACE_AND_TOPOLOGY.md §2.5 Action Registry; .genesis/docs/standards/POSTING_GUIDE.md
target_truth: CommentAssetSurface exposes create-post / create-reply / mark-read / mark-unread / pin-thread actions per the action-registry shape, persists per-agent unread state under .ai-workspace/runtime/oddboard/, derives thread identity from filename + frontmatter Addresses field, and emits change-feed events on filesystem mutation. POSTING_GUIDE filename and required-frontmatter rules enforced fail-closed on every post action.
superseded_truth: CommentAssetSurface is read-only; posts happen outside the action registry without POSTING_GUIDE enforcement; thread state and unread state are not modeled.
closure_law: this ticket closes when create-post enforces POSTING_GUIDE filename + required frontmatter, unread state per agent persists across server restart, thread identity is stable across renames, and tests cover write / threading / unread round-trips.
evaluation_criteria:
  - create-post enforces POSTING_GUIDE filename pattern (YYYYMMDDTHHMMSS_CATEGORY_SUBJECT.md)
  - create-post enforces required frontmatter fields (Author, Date, Status, plus category-specific)
  - create-reply derives parent thread id from selected comment
  - mark-read / mark-unread persist state under .ai-workspace/runtime/oddboard/unread-<agent>.json
  - thread identity stable when filename changes within same author
  - change feed emits on mutation; cache invalidates
proof_surface:
  - src/server/comment-asset-surface-service.mjs write + feed additions
  - runtime/tests/test_comment_asset_surface_write.mjs
  - POSTING_GUIDE conformance test (positive and negative)
  - thread-stability test
  - unread-state-restart-survival test
non_closure_conditions:
  - posts violate POSTING_GUIDE silently
  - unread state lost on server restart
  - thread identity changes on rename
  - write actions perform fs writes directly without going through action registry
---

## STDO Reading

Closes the §2.3 / §2.5 obligations T-008 spun out so the read path could land atomically.

---
id: T-008
title: Realize CommentAssetSurface (message board) over .ai-workspace/comments
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Implement the read half of CommentAssetSurface — typed projection over .ai-workspace/comments/<agent>/*.md with author-as-agent metadata derivation and POSTING_GUIDE-aware frontmatter parsing — plus a scaffold pane proving end-to-end live read.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: oddboard reading and posting, thread identity, per-agent unread state, POSTING_GUIDE conformance, MCP comments:// resource
priority: high
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-007 completed
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: existing src/features/oddboard/OddBoardWidget.tsx; existing src/server/oddboard-service.mjs (.ai-workspace/comments + .ai-workspace/runtime/oddboard/topics); comments/claude/20260424T140000Z_STRATEGY P4 2a; .genesis/docs/standards/POSTING_GUIDE.md
target_truth: CommentAssetSurface read path implements the AssetSurface §2.1 collection spec, §2.2 query API, and §2.6 inspector spec over .ai-workspace/comments/<agent>/*.md with author-as-agent derivation from the <agent>/ directory, POSTING_GUIDE-aware frontmatter parsing (Author / Date / Status / Addresses / Status), and read-derived thread identity. Scaffold pane (T-016) renders the live read in the browser.
superseded_truth: Comments are read ad hoc per consumer; consumers re-declare comment shape per call site; author identity not derived as a typed metadata.
closure_law: this ticket closes when the read API operates over the live comment tree, author-as-agent is correctly attributed, thread identity is read-derivable, the surface is consumed by the scaffold pane, and the test suite covers list / get / count / author filter / category filter. Write actions, persistent unread state, and threading semantics are spun out as T-019.
evaluation_criteria:
  - parses POSTING_GUIDE-conformant frontmatter (Author, Date, Addresses, Status, optional Scope)
  - author-as-agent metadata derives from the <agent>/ directory in the path
  - thread identity is read-derived from filename + frontmatter Addresses
  - selection emits an active_context update naming the comment or thread
  - read path provably does not mutate state
  - scaffold pane (T-016) consumes the surface and renders ≥10 comments
proof_surface:
  - src/server/comment-asset-surface-service.mjs
  - src/contracts/comment.ts
  - runtime/tests/test_comment_asset_surface.mjs
  - scaffold pane visible at http://localhost:4174/
non_closure_conditions:
  - selection writes runtime state
  - author attribution not derived from path
  - write actions, unread state, or threading semantics creep into this ticket's scope (those belong to T-019)
  - read API mutates the underlying tree
---

## STDO Reading

The agent-collaboration surface read path; write half spun out as T-019.

## Scope adjustment 2026-04-26

Original scope bundled read + write + threading + unread state in one
closure. Per user direction for incremental progression through STDO-
compliant tickets, the scope is narrowed to the read path here, with
write actions, threading semantics, and durable unread state spun out
as T-019 (`source_ticket: T-008`).

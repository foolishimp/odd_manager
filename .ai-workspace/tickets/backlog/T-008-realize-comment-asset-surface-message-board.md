---
id: T-008
title: Realize CommentAssetSurface (message board) over .ai-workspace/comments
type: feature
ticket_category: build_wave
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Promote the existing OddBoard from chat-style stream to a message board with thread identity, per-agent unread state, and author-as-agent metadata, all under the AssetSurface contract.
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
target_truth: CommentAssetSurface implements the AssetSurface contract over .ai-workspace/comments/<agent>/ with thread identity (filename + frontmatter Addresses field), per-agent persistent unread state, author-as-agent metadata derived from the <agent>/ directory, and post/reply/mark-read actions that conform to POSTING_GUIDE filename and frontmatter law.
superseded_truth: oddboard treats comments as a flat IRC-style stream; thread state and unread state are not modeled; author identity is post-author only with no agent binding; posting actions do not enforce POSTING_GUIDE.
closure_law: this ticket closes when CommentAssetSurface implements the AssetSurface contract over the comments topology with thread-aware reads, POSTING_GUIDE-conforming post action, durable per-agent unread state, and tests proving thread identity is stable across renames and that POSTING_GUIDE violations fail closed.
evaluation_criteria:
  - thread identity inferred from filename + frontmatter Addresses field and is stable across renames within the same author
  - unread state per agent persisted under .ai-workspace/runtime/oddboard/
  - author-as-agent metadata derives from the <agent>/ directory
  - post action enforces POSTING_GUIDE filename + required frontmatter fields
  - selection emits an active_context update naming thread or post
proof_surface:
  - CommentAssetSurface module
  - thread-derivation tests
  - unread-state-per-agent durability tests
  - POSTING_GUIDE conformance test (positive and negative)
  - rename-stability test
non_closure_conditions:
  - posts violate POSTING_GUIDE silently
  - unread state lost on server restart
  - thread identity not stable across renames
  - author-as-agent attribution forge-able
---

## STDO Reading

The agent-collaboration surface; the next wave's MCP layer will publish writes here.

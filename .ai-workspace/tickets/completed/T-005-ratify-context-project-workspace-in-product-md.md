---
id: T-005
title: Ratify Context (Project × Workspace) in PRODUCT.md
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Promote the Context concept from commentary to constitutional product surface so downstream realization can cite a stable definition rather than re-deriving it per widget.
change_class: product_reprice
re_entry_point: product_definition
affected_boundary: PRODUCT.md product shape, WorkspaceSnapshot semantics, downstream widget Context emission, MCP resource shape
priority: critical
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
dependencies: []
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: comments/claude/20260424T140000Z_STRATEGY_odd-manager-sidecar-and-project-agent-widget.md (P1); src/lib/types.ts:565 collision between workspace_root (path) and workspace_profile (identity)
target_truth: PRODUCT.md ratifies Context as the runtime binding of (Project, Workspace); Project is the filesystem/git entity carrying an odd-type tag; Workspace is the governance identity and custom UX suite (odd_sdlc, odd_world_model, future odd_*); agent execution is bound to a Context, not to a Workspace or Project alone; one Project may carry multiple Workspace lenses; embedding semantics default to local-by-default with promote-to-global on explicit pin.
superseded_truth: "Workspace" is overloaded to name both a filesystem path and a governance identity, leaving Context implicit and embedding semantics undefined.
closure_law: this ticket closes when PRODUCT.md carries the Context concept with explicit product-shape implications, names Project and Workspace as separate concerns, defines embedding semantics, and downstream tickets cite PRODUCT.md as authority for Context shape.
evaluation_criteria:
  - PRODUCT.md names Context as the runtime binding of (Project, Workspace)
  - Project and Workspace are defined as separate concepts with distinct ownership
  - embedding semantics (local-by-default, promote-to-global on pin) are stated explicitly
  - the multi-Workspace-per-Project case is named in or out of scope explicitly
  - a paired realization_refactor ticket exists for the workspaceRoot → projectRoot rename
proof_surface:
  - PRODUCT.md updated section
  - cross-reference from the 2026-04-24 STRATEGY post acknowledging adoption
  - issued realization_refactor ticket for workspaceRoot → projectRoot rename
non_closure_conditions:
  - Context defined only in commentary, not in PRODUCT.md
  - Workspace remains overloaded in spec
  - rename ticket not opened
---

## STDO Reading

This is the constitutional precursor for the wave; without it every downstream widget invents Context locally.

---
id: B-009
title: Scope SidecarPanel data loads to the selected Project Context
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make project selection in SidecarPanel reload tickets, comments, sessions, unread state, and context from the selected project root rather than continuing to show default-root data.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/routes/WorkspaceRoute.tsx, build_tenants/react_vite/src/server/index.mjs
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-010
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Codex sidecar-wave code review found SidecarPanel fetches /api/tickets, /api/comments, and /api/sessions without projectRoot and selecting a project only mutates local context state.
target_truth: SidecarPanel selection changes the active Context and all dependent AssetSurface projections are reloaded from that Context's project root.
superseded_truth: Project selection updates the context bar but the ticket/comment/session panes continue showing the default odd_manager root.
closure_law: This bug closes when selecting a different project changes the query root for tickets, comments, sessions, unread state, and session spawn/attach/kill, with tests proving no default-root leakage.
evaluation_criteria:
  - SidecarPanel load accepts and uses the current context project root
  - all AssetSurface fetches include projectRoot when reading non-default projects
  - session spawn, kill, and WebSocket attach use the same project root
  - WorkspaceRoute passes its selected project root or the sidecar owns a lawful project-root selection reducer
  - e2e or component test proves selecting a fixture project changes the records shown
proof_surface:
  - SidecarPanel context-aware load implementation
  - route integration update
  - test fixture with distinguishable tickets/comments/sessions across two roots
non_closure_conditions:
  - only the context bar changes
  - reads use one root while writes use another
  - selected project root is held outside declared State/Msg flow
---

## STDO Reading

T-005 and T-010 made Context constitutional. The sidecar must treat Context as
the query boundary, not just as display text.

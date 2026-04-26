---
id: T-009
title: Realize SessionAssetSurface read path and scaffold sessions pane
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Implement the read half of SessionAssetSurface — typed projection over the runtime session registry returning typed SessionRecord — plus a scaffold pane that lists sessions with their project / agent_type / cwd / status. Spawn / attach / kill (T-020) and server-restart survival (T-021) follow.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: oddterm session lifecycle, pty backplane, transcript reference stability, Context inheritance on spawn, MCP sessions:// resource
priority: critical
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-008 completed
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: existing src/features/oddterm/OddTermPanel.tsx, OddTermWorkspaceWidget.tsx; comments/claude/20260424T140000Z_STRATEGY P5; the 2026-04-24 VS-Code-crash failure mode that triggered the wave
target_truth: SessionAssetSurface read path implements the AssetSurface §2.1 collection spec, §2.2 query API, and §2.6 inspector spec returning typed SessionRecord (id, project, agent_type, cwd, status, started_at, transcript_ref, context_at_spawn). Read source is the runtime session registry under .ai-workspace/runtime/sessions/ (or empty when no backplane is configured yet). Scaffold pane renders the live session list.
superseded_truth: Sessions are not modeled as typed records; consumers interact with the existing oddterm-pool-service shape per call site.
closure_law: this ticket closes when the read API operates over the live session registry (or returns an empty list with an explicit no-backplane note when none is configured), session metadata is correctly typed, the surface is consumed by the scaffold pane, and the test suite covers list / get / count / project filter / agent_type filter. Spawn / attach / kill are spun out as T-020; server-restart survival is spun out as T-021.
evaluation_criteria:
  - SessionRecord typed shape published in src/contracts/session.ts
  - read source is .ai-workspace/runtime/sessions/<id>.json when present
  - empty backplane returns [] with an explicit no-backplane diagnostic in the surface metadata
  - selection emits an active_context update naming the session
  - read path provably does not mutate state
  - scaffold pane (T-016) consumes the surface and renders the session list (or empty state)
proof_surface:
  - src/server/session-asset-surface-service.mjs
  - src/contracts/session.ts
  - runtime/tests/test_session_asset_surface.mjs
  - scaffold pane visible at http://localhost:4174/
non_closure_conditions:
  - selection writes runtime state
  - spawn / attach / kill / restart-survival work creeps into this ticket's scope (those belong to T-020 and T-021)
  - read API mutates the underlying registry
---

## STDO Reading

Read half of the session surface. The robustness property that retires the IDE-as-host failure mode lives in T-021 (server-restart survival).

## Scope adjustment 2026-04-26

Original scope bundled read + spawn/attach/kill + server-restart survival
in one closure. Per user direction for incremental progression through
STDO-compliant tickets, the scope is narrowed to the read path here,
with spawn/attach/kill spun out as T-020 (`source_ticket: T-009`) and
the server-restart-survival robustness property spun out as T-021
(`source_ticket: T-009`).

---
id: T-011
title: Publish MCP data layer and agent-interop contract over AssetSurfaces
type: feature
ticket_category: build_wave
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Publish the AssetSurface collections as MCP resources and tools so coding agents (Claude Code, Codex) read and write workspace state through one typed projection, with author-as-agent identity attributed automatically.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: MCP server topology, agent identity attribution, cross-agent visibility, widget/MCP shape parity, existing odd_manager_irc_mcp.mjs scope
priority: critical
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-010 completed
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: existing runtime/odd_manager_irc_mcp.mjs as the pattern; T-007/T-008/T-009 AssetSurfaces; T-010 widget Context emission; comments/claude/20260424T140000Z_STRATEGY P3
target_truth: A second MCP server (or additional tools on the existing one) exposes the AssetSurface collections as MCP resources (tickets://, comments://, sessions://, active_context://current, projects://) and tools (create_comment, update_ticket_status, session.spawn / attach / detach / rename / kill, select_project); coding agents read workspace state and write back through this MCP layer; author-as-agent identity is attributed automatically on writes from session metadata; the MCP resource shape is identical to the widget's emission shape with no adapter layer.
superseded_truth: Agents read .ai-workspace/ files directly with no typed projection, no change feed, and no agent-identity routing; the existing MCP is messaging-only (room_*, irc_*).
closure_law: this ticket closes when an integration test runs at least one Claude Code session and one Codex session through the MCP layer, both read tickets / comments / sessions, both write a comment with correct author-as-agent attribution, and cross-agent visibility is verified end-to-end.
evaluation_criteria:
  - MCP server exposes the five resources named (tickets, comments, sessions, active_context, projects)
  - tools cover at minimum: create_comment, update_ticket_status, session.spawn, select_project
  - author-as-agent identity is set automatically on writes from session metadata
  - resource shape matches widget emission shape with no adapter layer
  - integration test runs Claude Code + Codex sessions through the MCP and verifies cross-agent visibility
  - identity attribution is non-spoofable from agent payload
proof_surface:
  - MCP server module mirroring runtime/odd_manager_irc_mcp.mjs pattern
  - per-resource and per-tool tests
  - cross-agent integration test
  - identity-attribution test (positive and negative)
  - shape-parity test against widget emission
non_closure_conditions:
  - widget and MCP shapes diverge
  - identity attribution missing or spoof-able from agent input
  - cross-agent visibility test absent
  - MCP layer rebuilds .ai-workspace authority instead of projecting it
---

## STDO Reading

This is where the slice becomes load-bearing for actual agent interop; the AssetSurfaces stop being UI-only and become the agent contract.

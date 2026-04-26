---
id: T-012
title: RC qualification — end-to-end agent-interop scenario portfolio
type: qualification
ticket_category: build_wave
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Prove the .ai-workspace topology + agent-interop slice through real Claude Code and Codex co-occurrence rather than per-widget unit tests, and publish a postmortem-style RC report identifying intentional gaps and remaining work.
change_class: product_reprice
re_entry_point: product_definition
affected_boundary: RC gate for the wave, scenario portfolio, cross-agent visibility, server-restart survival, identity attribution, gap backlog
priority: critical
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-011 completed
  - T-014 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: T-005 through T-011 closure; specification_methodology/strategy/OODD_future_strategy.md cell-bounded recursion and reusable work vectors; odd_sdlc T-038 RC pattern as a structural template
target_truth: The wave has an RC qualification report stating which scenarios pass (single-agent ticket transitions, multi-agent comment threading, session inheritance of Context, server-restart survival of sessions, identity attribution under cross-agent writes, widget-MCP shape parity), what is intentionally out of scope, and which remaining gaps have backlog tickets.
superseded_truth: RC readiness is inferred from per-widget unit tests passing; no scenario portfolio; no live cross-agent run.
closure_law: this ticket closes when the scenario portfolio passes end-to-end with at least one Claude Code + Codex co-occurrence, the postmortem-style RC report is published under .ai-workspace/comments/claude/, and every known gap has a backlog ticket linked from the report.
evaluation_criteria:
  - scenario portfolio covers each AssetSurface end-to-end
  - cross-agent scenarios prove identity attribution and visibility
  - server-restart scenario proves session survival and re-attachment
  - Context-emission scenario proves widget-MCP shape parity
  - report publishes remaining backlog tickets for known gaps
  - at least one scenario exercises Claude Code and Codex in the same workspace concurrently
  - every UX surface in scope passes the UX_METHOD §8 Msg-replay test in the qualification suite
proof_surface:
  - scenario portfolio file under build_tenants/
  - end-to-end test results
  - RC readiness report under .ai-workspace/comments/claude/
  - postmortem comparing what works vs known gaps
  - linked backlog tickets for every gap
  - per-UX-surface Msg-replay test results (UX_METHOD §8 / §14)
non_closure_conditions:
  - any scenario relies on a per-widget unit test as proof
  - no live cross-agent run
  - identity spoofing possible from MCP payload
  - missing gaps lack backlog tickets
  - report claims closure for scenarios that did not run live
---

## STDO Reading

The RC gate; without it the wave is realization without product evidence.

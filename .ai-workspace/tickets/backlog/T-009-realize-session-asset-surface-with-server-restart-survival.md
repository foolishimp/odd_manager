---
id: T-009
title: Realize SessionAssetSurface (xterm) with server-restart survival
type: feature
ticket_category: build_wave
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Treat coding-agent terminal sessions as a first-class typed asset whose pty survives odd_manager server restart, removing the IDE-crash failure mode that motivated this wave.
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
target_truth: SessionAssetSurface exposes terminal sessions as typed records (project, agent type, cwd, started_at, status, transcript_ref, context_at_spawn) under the AssetSurface contract; the underlying pty process survives odd_manager server restart; sessions inherit Context on spawn (cwd from project.root, env carries workspace_profile and odd_type tag); session.spawn / attach / detach / rename / kill are the only lawful state transitions.
superseded_truth: Terminal sessions are owned by the React shell process and die when the server restarts; transcripts persist on disk but processes do not; sessions can be spawned without a Context binding.
closure_law: this ticket closes when SessionAssetSurface implements the AssetSurface contract over a session backplane (tmux/zellij or native equivalent), the pty process provably survives odd_manager server restart, the surface re-attaches on reconnect with stable transcript reference, and spawned sessions provably inherit Context.
evaluation_criteria:
  - sessions survive odd_manager server restart and re-attach with the same session id
  - spawned session inherits cwd, workspace_profile, and odd_type from active Context
  - session.spawn requires a Context binding; rejects with a typed error otherwise
  - transcript reference is stable across detach/attach
  - session.kill is the only path that terminates the pty
  - filter sessions:// by Context returns only sessions whose context_at_spawn matches
proof_surface:
  - SessionAssetSurface module
  - session-backplane integration (tmux or equivalent)
  - server-restart survival test
  - Context-inheritance test
  - transcript-stability test
  - kill-only-terminates test
non_closure_conditions:
  - server restart kills any session
  - sessions can spawn without Context
  - transcript reference changes on re-attach
  - any code path other than session.kill terminates the pty
---

## STDO Reading

The robustness property that retires the IDE-as-host failure mode and makes odd_manager the legitimate session host.

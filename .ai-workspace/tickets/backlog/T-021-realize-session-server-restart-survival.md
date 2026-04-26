---
id: T-021
title: Realize SessionAssetSurface server-restart survival
type: feature
ticket_category: build_wave
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the underlying pty processes survive odd_manager server restart so the original VS-Code-crash failure mode that triggered the wave is fully retired — sessions re-attach automatically with stable transcript references after the server bounces.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: SessionAssetSurface backplane (tmux/zellij/native), session-state persistence under .ai-workspace/runtime/sessions/, re-attach handshake on server boot
priority: critical
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
source_ticket: T-009
dependencies:
  - T-020 completed
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: T-009 spin-out; the 2026-04-24 VS-Code-crash failure mode that triggered the entire wave (comments/claude/20260424T140000Z_STRATEGY P5); UX_METHOD §6 effect-membrane discipline for the reattach hook
target_truth: SessionAssetSurface uses a session backplane (tmux/zellij or native ConPTY-style) such that pty processes persist across odd_manager server restart; sessions re-attach automatically on server boot with the same session id and transcript reference; an integration test bounces the server and verifies re-attachment.
superseded_truth: Pty lifecycle is bound to the odd_manager server process; restarting the server kills every session; transcripts persist on disk but processes do not.
closure_law: this ticket closes when an operator can spawn a session, restart the odd_manager server, observe the session re-attach automatically with the same session id and stable transcript reference, and continue typing as if no restart occurred.
evaluation_criteria:
  - backplane mechanism named and recorded in a tenant ADR (tmux / zellij / native equivalent)
  - integration test: spawn session → write → restart server → re-attach → verify same session id and transcript continuity
  - session.kill remains the only path that terminates the pty
  - sessions:// list returns the same record set before and after restart
  - transcript reference is stable across the restart cycle
proof_surface:
  - backplane integration code
  - tenant ADR recording the backplane choice
  - server-restart-survival integration test
  - transcript-stability across restart test
non_closure_conditions:
  - server restart kills any session
  - re-attach loses transcript continuity
  - session id changes across re-attach
  - any code path other than session.kill terminates the pty
---

## STDO Reading

Retires the IDE-as-host failure mode that originated this wave — the load-bearing robustness property of the entire sidecar effort.

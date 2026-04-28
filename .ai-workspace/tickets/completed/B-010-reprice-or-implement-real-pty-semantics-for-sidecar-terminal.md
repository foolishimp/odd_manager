---
id: B-010
title: Reprice or implement real pty semantics for the sidecar terminal
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Resolve the gap between T-020's pty/xterm claim and the current child_process pipe implementation.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/server/session-pty-service.mjs, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/design/adr, build_tenants/react_vite/runtime/tests/test_session_pty.mjs
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-020
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Codex sidecar-wave code review found session-pty-service.mjs uses child_process.spawn pipes and treats resize as a no-op while T-020 claims pty/xterm terminal behavior.
target_truth: The sidecar terminal either uses a real pty-capable backplane with resize and terminal semantics, or the ticket/design/product text is repriced to state that it is a pipe-backed process console rather than a pty.
superseded_truth: A pipe-backed child process is documented and closed as a pty-backed terminal.
closure_law: This bug closes when design authority names the chosen terminal substrate and the implementation/tests match that claim exactly.
evaluation_criteria:
  - design or ADR states whether the terminal is pty-backed, screen/tmux-backed, or pipe-backed
  - if pty-backed, implementation supports terminal resize and interactive shell semantics
  - if pipe-backed, user-facing text and ticket claims stop calling it a pty
  - tests cover resize behavior or explicitly prove pipe-console constraints
proof_surface:
  - ADR or design amendment
  - implementation update or ticket/product wording correction
  - terminal behavior tests
non_closure_conditions:
  - code still uses plain stdio pipes while docs claim pty
  - resize remains a no-op under a pty claim
  - xterm UI hides substrate limitations from operators
---

## STDO Reading

This one needs design re-entry because there are two lawful outcomes: implement
the stronger pty claim or reprice the product/design claim down to the actual
pipe-backed behavior.

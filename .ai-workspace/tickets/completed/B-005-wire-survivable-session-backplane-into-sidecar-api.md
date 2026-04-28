---
id: B-005
title: Wire survivable SessionAssetSurface backplane into the sidecar API
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the server-restart-survivable session backplane part of the product API path instead of leaving it as test-only code.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/server/index.mjs, build_tenants/react_vite/src/server/session-pty-service.mjs, build_tenants/react_vite/src/server/session-pty-screen.mjs, build_tenants/react_vite/runtime/tests/test_session_pty_screen.mjs
priority: critical
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-021
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: Codex sidecar-wave code review found that T-021 survival code exists in session-pty-screen.mjs but the live API still calls the in-memory child-process session service.
target_truth: The live /api/sessions/spawn, /api/sessions/:id/kill, sessions:// projection, and server boot path use the survivable backplane when survival is claimed, and rehydrate existing sessions after server restart.
superseded_truth: T-021 is closed by a detached-screen module and tests while the product API continues spawning server-owned child processes that die with Node.
closure_law: This bug closes only when a session spawned through the sidecar API survives an odd_manager server restart, reappears in /api/sessions and sessions:// with the same id and transcript reference, and can be killed through the public API.
evaluation_criteria:
  - sidecar API spawn path selects the survivable backplane or truthfully reports that survival mode is unavailable
  - server boot or API initialization calls the rehydration path for persisted survivable session records
  - /api/sessions and sessions:// report the same revived session id after restart
  - session kill remains the public termination path and does not leave a live backplane process
  - T-021 runtime tests pass in the current environment or skip with explicit unavailable-backplane diagnostics
proof_surface:
  - updated server wiring
  - restart-survival integration test using the public API path
  - sessions:// projection assertion before and after restart
  - diagnostic path for unsupported screen/tmux environments
non_closure_conditions:
  - product API still imports only the in-memory child-process service
  - rehydration remains test-only
  - restart leaves persisted records but kills the underlying process
  - tests pass only by bypassing /api/sessions
---

## STDO Reading

The requirement and ticket authority already exist in T-021. The defect is a
realization drift: the survivable carrier was built beside the product API, not
under it.

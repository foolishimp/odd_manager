---
id: B-008
title: Fix MCP stdio framing for split Content-Length messages
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make odd_manager_data_mcp parse real MCP stdio transport without corrupting partial Content-Length frames.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/runtime/odd_manager_data_mcp.mjs, build_tenants/react_vite/runtime/tests/test_data_mcp.mjs
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-011
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: Codex sidecar-wave code review found tryConsumeFramed returns null for incomplete framed bodies and the dispatch loop then tries line-delimited parsing against the same buffer.
target_truth: The MCP server preserves incomplete framed messages until the full Content-Length body arrives and never consumes a Content-Length header as line-delimited JSON.
superseded_truth: Partial framed messages can be misparsed as line-delimited input, corrupting the transport buffer for real clients.
closure_law: This bug closes when transport-level tests feed split Content-Length frames across multiple chunks and prove exactly one valid JSON-RPC response is emitted after the body completes.
evaluation_criteria:
  - parser distinguishes incomplete framed input from absent framed input
  - line-delimited fallback is attempted only when the buffer is not a framed message prefix
  - tests cover split header, split body, multiple concatenated frames, malformed frame, and line-delimited fallback
  - handleRequest unit tests remain green
proof_surface:
  - parser refactor
  - stdio framing tests that exercise the buffer parser directly or through a subprocess
non_closure_conditions:
  - tests continue to call handleRequest only
  - framed clients depend on chunk boundaries matching complete messages
  - malformed frames poison all later input
---

## STDO Reading

The MCP resource/tool behavior can be correct while the transport is broken.
T-011 needs the live stdio contract, not only direct handler calls.

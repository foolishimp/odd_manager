---
id: B-007
title: Make MCP comment author identity non-spoofable
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Ensure comment writes through odd_manager_data_mcp derive author identity from the MCP session environment rather than caller-supplied tool payload.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/runtime/odd_manager_data_mcp.mjs, build_tenants/react_vite/src/server/comment-asset-surface-service.mjs, build_tenants/react_vite/runtime/tests/test_data_mcp.mjs
priority: critical
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
intake_source: Codex sidecar-wave code review found comments_create_post and comments_create_reply require author in the tool payload and pass it through to the writer.
target_truth: MCP comment creation attributes author identity from OMAN_AGENT_PROVIDER or OMAN_SESSION_LABEL, and caller payload cannot forge another agent's comment directory or Author frontmatter.
superseded_truth: A caller can set author arbitrarily in the MCP tool arguments.
closure_law: This bug closes when MCP comment post and reply tools omit author from their public input schema, derive author from the server-side session identity, and negative tests prove a spoofed author argument is rejected or ignored.
evaluation_criteria:
  - comments_create_post schema no longer requires or trusts author
  - comments_create_reply schema no longer requires or trusts author
  - handler injects the resolved MCP session author before calling the comment surface
  - positive tests prove env-derived author attribution
  - negative tests prove caller-supplied author cannot override the server identity
proof_surface:
  - MCP tool schema change
  - MCP handler identity injection
  - test_data_mcp positive and negative identity tests
  - on-disk comment path and frontmatter assertion
non_closure_conditions:
  - author remains a required public MCP argument
  - tests only cover direct comment service writes
  - caller can create a file under another agent directory
---

## STDO Reading

T-011 already declares non-spoofable author-as-agent attribution. This is a
code-level contract violation, not a new product requirement.

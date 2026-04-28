---
id: B-012
title: Harden TicketAssetSurface frontmatter update validation
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Prevent generic ticket field updates from corrupting frontmatter or rewriting unintended keys.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/server/ticket-asset-surface-service.mjs, build_tenants/react_vite/runtime/odd_manager_data_mcp.mjs, build_tenants/react_vite/runtime/tests/test_ticket_asset_surface_write.mjs, build_tenants/react_vite/runtime/tests/test_data_mcp.mjs
priority: medium
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-018
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: Codex sidecar-wave code review found tickets_update_field accepts arbitrary snake_key and value, then interpolates the key into a regex and writes raw scalar text into YAML frontmatter.
target_truth: Ticket field updates are limited to admitted scalar fields, validate key and value shape, preserve frontmatter validity, and fail closed for unsupported or multiline updates.
superseded_truth: Any MCP caller can request an arbitrary field rewrite and inject malformed frontmatter text.
closure_law: This bug closes when update_field has an allowlist or schema registry for mutable fields, escapes or avoids regex-derived key matching, rejects newline/control characters where invalid, and carries negative tests.
evaluation_criteria:
  - mutable frontmatter fields are explicitly named
  - unsupported keys fail closed
  - multiline or YAML-structural scalar injection fails closed
  - regex metacharacters in keys cannot alter matching behavior
  - MCP tests cover invalid keys and values
proof_surface:
  - validation helper or field schema registry
  - TicketAssetSurface write tests
  - MCP tool negative tests
non_closure_conditions:
  - arbitrary snake_key remains exposed without validation
  - values can introduce new frontmatter keys by newline injection
  - tests only cover well-formed scalar updates
---

## STDO Reading

The action registry is supposed to be the lawful write path. A generic write
action still needs typed admissibility; otherwise the write path becomes a
frontmatter mutation escape hatch.

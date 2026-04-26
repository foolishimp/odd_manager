---
id: T-015
title: Rename workspaceRoot to projectRoot tenant-wide
type: chore
ticket_category: build_wave
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Resolve the workspaceRoot (path) vs workspace_profile (identity) collision noted in src/lib/types.ts:565 by renaming every path-bearing workspaceRoot to projectRoot, retaining workspace_profile for governance identity.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: src/lib/types.ts; src/server/{oddboard-service,odd-console-events,index}.mjs; runtime/odd_manager_world.py; REST query parameter names; client API consumers in src/lib/api.ts; MCP layer once T-011 lands
priority: medium
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-005 completed
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
intake_source: T-005 non_closure_condition (rename ticket not opened); src/lib/types.ts:565 collision between workspace_root (path) and workspace_profile (identity); comments/claude/20260424T140000Z_STRATEGY post P6
target_truth: Every use of workspaceRoot that names a filesystem path in build_tenants/react_vite/ is renamed to projectRoot, both in TypeScript and Python runtime; workspace_profile is retained unchanged for governance identity; REST query parameter is renamed (with backward-compat alias only if external consumers are declared); MCP layer (T-011) consumes the renamed shape from the start.
superseded_truth: workspaceRoot is overloaded to name both a filesystem path and a governance identity, requiring readers to disambiguate per call site and producing the collision recorded in src/lib/types.ts.
closure_law: this ticket closes when no instance of workspaceRoot-as-path remains in build_tenants/react_vite/ except where an explicit declared exemption applies (e.g., a documented external consumer with backward-compat alias), workspace_profile is provably untouched, a usage-drift test passes, and one round-trip test through the server API confirms the rename is consistent end-to-end.
evaluation_criteria:
  - all TypeScript path-bearing workspaceRoot references in build_tenants/react_vite/ are renamed to projectRoot
  - all Python runtime path-bearing workspaceRoot references in runtime/ are renamed to projectRoot
  - workspace_profile (identity) is provably untouched
  - REST query parameter renamed (with declared backward-compat alias if any external consumer is named)
  - MCP layer (T-011) consumes projectRoot from the start, not workspaceRoot
  - one round-trip test through /api/world or equivalent confirms the rename is end-to-end consistent
  - usage-drift test fails if any new workspaceRoot-as-path usage appears
proof_surface:
  - rename diff
  - usage-drift test
  - server API round-trip test
  - explicit list of any backward-compat aliases declared, with consumer rationale
non_closure_conditions:
  - any path-bearing workspaceRoot reference remains without explicit exemption
  - workspace_profile (identity) accidentally renamed or merged with projectRoot
  - external consumers broken without a declared backward-compat alias
  - MCP layer ships consuming workspaceRoot then is patched after the fact
---

## STDO Reading

Closes the T-005 non_closure_condition; plain STDO since this is not UX work, just a tenant-local rename to retire the type collision.

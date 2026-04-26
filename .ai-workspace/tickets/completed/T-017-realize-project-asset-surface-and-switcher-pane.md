---
id: T-017
title: Realize ProjectAssetSurface read path and scaffold switcher pane
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Implement the ProjectAssetSurface read half — a typed projection over the registry of known Projects on disk — and a scaffold pane that lets the operator pick a Project, emitting a ContextDelta the rest of the sidecar consumes.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: src/contracts/project.ts, src/server/project-asset-surface-service.mjs, runtime/dev/sidecar-demo.mjs project-switcher pane, ContextDelta emission contract
priority: high
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-006 completed
  - T-013 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: ASSET_SURFACE_AND_TOPOLOGY.md §3 Projects collection; PRODUCT.md Context section (T-005 closure); user direction 2026-04-26 for incremental visible progression with Project switcher as one increment
target_truth: ProjectAssetSurface implements the AssetSurface contract over a Project registry (default: scan /Users/jim/src/apps/ for directories containing .ai-workspace/) with frontmatter-style read of any per-Project metadata, list/get/count operations, and a scaffold switcher pane that emits a ContextDelta { project: <id> } on selection consumed by the active Context bar.
superseded_truth: Scaffold Context is hard-coded to a single project; no read of the Project registry; no switcher.
closure_law: this ticket closes when ProjectAssetSurface is implemented, the scaffold pane shows ≥3 Projects from /Users/jim/src/apps/, selection updates the scaffold's active Context bar live, and tests cover the read path and selection emission.
evaluation_criteria:
  - src/contracts/project.ts defines ProjectRecord and ProjectCollectionFilter
  - src/server/project-asset-surface-service.mjs scans the registry root and returns typed ProjectRecord[]
  - scaffold project-switcher pane lists projects with name + odd_type (when discoverable)
  - selection emits ContextDelta consumed by the scaffold's active Context bar
  - registry root is configurable via PROJECT_REGISTRY_ROOT env var (defaults to /Users/jim/src/apps/)
  - tests cover list, get, count, and selection emission
proof_surface:
  - src/contracts/project.ts
  - src/server/project-asset-surface-service.mjs
  - runtime/tests/test_project_asset_surface.mjs
  - scaffold pane visible at http://localhost:4174/
non_closure_conditions:
  - project list hard-coded
  - selection does not emit a ContextDelta
  - scaffold's Context bar does not update on selection
  - registry scan recurses into Project contents (must scan one directory level only)
---

## STDO Reading

Surfaces the Project switcher as a separable visible increment ahead of T-010's full Context-producer widget.

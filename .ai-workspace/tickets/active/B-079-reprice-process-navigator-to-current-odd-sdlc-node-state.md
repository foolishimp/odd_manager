---
id: B-079
title: Reprice Process Navigator to current odd_sdlc node-management state
type: bug
ticket_category: ordinary
status: active
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove the stale fixed Process Navigator view taxonomy and make the Sidecar process surface derive sections from the current odd_sdlc TypeScript projection.
change_class: requirement_reprice
re_entry_point: requirements
affected_boundary: specification/requirements/10-entry-lenses-and-delivery-workspaces.md, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/contracts/process.ts, build_tenants/react_vite/src/server/sidecar-process-projection.mjs, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/runtime/tests/test_sidecar_process_navigator_msg_replay.mjs, build_tenants/react_vite/runtime/tests/test_sidecar_process_projection.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-05-31
created_at: 2026-05-31
updated_at: 2026-05-31
review_status: implemented_pending_operator_review
build_tenant: react_vite
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
target_truth: The Process Navigator derives its visible sections from current odd_sdlc TypeScript runtime, catalog, overlay, and asset-node carriers. Runtime state is always first; graph overlays, function catalog, and asset-node relationships appear only when projected by the active workspace.
superseded_truth: The Process Navigator exposes a fixed three-view operator taxonomy or reducer-persisted process-flow variant scaffold.
closure_law: This ticket closes only when live requirement/design/sprint authority no longer requires the fixed view taxonomy, the active Sidecar process panel has no saved-view or variant reducer path, and focused runtime/e2e validation passes.
evaluation_criteria:
  - REQ-OM-LNS-003 requires projection-derived sections rather than three fixed operator views
  - Sidecar design law describes current odd_sdlc runtime/catalog/overlay/asset-node carriers as the visible section source
  - active Process Navigator renders Runtime State, Function Catalog, and Asset Nodes from the active projection and adds Graph Overlays only when overlays exist
  - stale `process/select-view`, `process/select-map`, `process/select-variant`, and `process/select-leaf` reducer paths are removed from live state
  - process projection no longer publishes the old fixed view labels as operator views
  - runtime and e2e tests assert the projection-derived surface instead of false-green legacy view shape
proof_surface:
  - specification/PRODUCT.md
  - specification/requirements/10-entry-lenses-and-delivery-workspaces.md
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - .ai-workspace/sprints/SPRINT-2026-05-04-process-navigator-substrate-alignment.md
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/contracts/process.ts
  - build_tenants/react_vite/src/server/sidecar-process-projection.mjs
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/runtime/tests/test_sidecar_process_navigator_msg_replay.mjs
  - build_tenants/react_vite/runtime/tests/test_sidecar_process_projection.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - live authority still requires `Active Work`, `Blocked / Waiting`, and `Ready for Handoff`
  - live UI renders saved process views or process-flow variant tabs
  - reducer replay still admits removed process view/map/variant/leaf selection messages
  - e2e requires a fixed process-tab count instead of projection-derived sections
---

## Implementation Evidence 2026-05-31

- Repriced REQ-OM-LNS-003 and Sidecar design law to projection-derived
  `odd_sdlc` node-management sections.
- Removed the legacy `ProcessNavigatorPanel` saved-view path from the live
  source.
- Removed stale process view/map/variant/leaf reducer state and profile
  persistence.
- Changed process projection output to stop publishing the old fixed operator
  view labels.
- Updated runtime and e2e tests to assert the current Runtime State, Function
  Catalog, and Asset Nodes surface.
- Fixed the project-selection/profile-restore race exposed by the full smoke
  rerun so a selected viewer object is not erased by a newly loaded layout
  profile.

## Verification 2026-05-31

- `git diff --check` passed.
- `node --test runtime/tests/test_sidecar_msg_replay.mjs runtime/tests/test_sidecar_process_navigator_msg_replay.mjs runtime/tests/test_sidecar_process_projection.mjs` passed, 78/78.
- `npm run test:runtime:node` passed, 164/164.
- `npm run build` passed with existing Vite chunk-size warnings.
- `npx playwright test tests/e2e/odd-manager-smoke.spec.ts --grep "viewer panes open tabs|horizontal viewer split"` passed, 2/2.
- `npx playwright test tests/e2e/odd-manager-smoke.spec.ts` passed, 30/30.

## Open Review

- Operator review remains open before ticket transition.

---
id: T-029
title: Retire legacy workspace-route panels and consolidate runtime/process/builder entry on the sidecar
type: feature
ticket_category: ui_substrate_alignment
status: backlog
review_status: pending
goal: realize-ai-workspace-topology-and-agent-interoperability
build_tenant: react_vite
owner: unassigned
change_intent: Retire or demote the legacy ManagerWorld-driven workspace-route panels whose runtime/process/builder responsibilities are superseded by the sidecar Process Navigator and related typed sidecar carriers.
change_class: design_reframe
re_entry_point: design
affected_boundary: src/features/home/HomePanel.tsx, src/features/runtime/RuntimePanel.tsx, src/features/builder/BuilderPanel.tsx, src/features/process/ProcessWorkspace.tsx, src/routes/WorkspaceRoute.tsx
priority: medium
created_at: 2026-05-05
updated_at: 2026-05-05
governance_scope: STDO Method
depends_on:
  - T-022
  - T-024
  - T-026
intake_source: T-025 audit classified HomePanel as extension_required only if retained; the safer product move is a legacy-retirement wave because the sidecar now owns the live TypeScript process projection.
target_truth: Legacy workspace-route runtime/process/builder surfaces are either removed, clearly demoted, or redirected to the sidecar carriers. ManagerWorld-derived runtime/process truth no longer competes with the sidecar process projection.
closure_law: This ticket closes only after design decides remove vs redirect per panel, routes are updated accordingly, and regression coverage proves the sidecar remains the canonical runtime/process entry.
---

# T-029: Retire Legacy Workspace Route Panels And Consolidate On Sidecar

## STDO Triage

First missing layer: design.

The substrate-aligned carrier path now lives in the sidecar. The legacy Home / Runtime / Builder / ProcessWorkspace route surfaces still exist and can drift if kept as parallel runtime/process truth.

## Candidate Disposition

- `HomePanel.tsx`: retire or reframe as a thin entry dashboard
- `RuntimePanel.tsx`: retire; T-022 moved runtime evidence to sidecar
- `BuilderPanel.tsx`: retire or defer with T-023
- `ProcessWorkspace.tsx`: retire; T-026 moved process navigation to sidecar

## Closure Criteria

- each legacy route surface has an explicit remove/redirect/retain decision
- retained surfaces consume admitted sidecar carriers or are explicitly non-runtime
- sidecar Process Navigator remains the canonical process surface
- route-level tests cover the resulting navigation

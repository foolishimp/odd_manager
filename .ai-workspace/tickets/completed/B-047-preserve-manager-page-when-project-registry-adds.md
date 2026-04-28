---
id: B-047
title: Preserve manager page when Project registry add applies
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Stop Project add/open from navigating away from the current manager surface when that surface remains valid.
change_class: realization_refactor
re_entry_point: code
affected_boundary: build_tenants/react_vite/src/app/App.tsx, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T02:23:36Z
build_tenant: react_vite
dependencies:
  - B-046 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Workspace Tool, Sidecar page continuity
intake_source: Operator observed that Add succeeded but navigated to the home/default page; returning to Sidecar showed the Project was added.
target_truth: Applying a managed Project change preserves the current manager page if the new Project profile still exposes that page. Registry mutation must not act like global navigation.
superseded_truth: Every workspace apply resets to the default page for the new workspace profile.
closure_law: This ticket closes only when Project add/open preserves Sidecar and browser proof covers the behavior.
evaluation_criteria:
  - Add Project from Sidecar keeps the operator on Sidecar
  - Workspace apply still falls back when the current page is not valid for the new profile
  - Playwright proof covers the Sidecar continuity regression
proof_surface:
  - build_tenants/react_vite/src/app/App.tsx
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:e2e
---

## SPEC_METHOD Triage

This is a realization refactor. The B-046 Project registry model is correct;
the defect is local UX control flow in the workspace apply command.

Lawful re-entry point: Code.

## STDO-UX Execution Contract

- `State`: selected manager page is operator navigation state
- `Msg`: Project add/open is a registry/apply action, not a page navigation
- `Update`: page state is preserved unless invalid for the next profile
- `Cmd`: world reload remains the only external effect
- `View`: Sidecar remains mounted after add/open when Sidecar is valid

## Closure Evidence

Changed workspace apply so it reloads the managed Project without forcing a
default-page reset. The existing `refreshWorld` validity check still moves to
the default page when the current page is not exposed by the next workspace
profile.

Added Playwright proof that Manual Add Project from Sidecar keeps Sidecar
selected and mounted.

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "project add preserves"`: 1 passed
- `npm run test:e2e`: 21 passed

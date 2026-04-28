---
id: B-054
title: Remove built-in Sidecar navigator folder duplicates
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Prevent built-in Tickets and Comments from also rendering as editable pinned folder favorites.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T06:00:31Z
build_tenant: react_vite
dependencies:
  - B-052 completed
  - B-053 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar left selector rail and Browse pin manager
intake_source: Operator observed Tickets and Comments appearing twice, and duplicate pinned versions were not clearly removable.
target_truth: Tickets and Comments are uneditable built-in navigator defaults. User favorites start after a compact divider and never include those built-in folder paths.
superseded_truth: Legacy pinned folders for `.ai-workspace/tickets` and `.ai-workspace/comments` can render as duplicate `T` and `C` rail items.
closure_law: This ticket closes only when legacy built-in folder pins are migrated out, new built-in folder pins are rejected, and browser proof covers duplicate prevention.
evaluation_criteria:
  - `.ai-workspace/tickets` and `.ai-workspace/comments` do not render as pinned folder rail entries
  - persisted legacy pins for those paths are removed from the effective pinned folder set
  - user favorites render after a compact rail divider
  - Browse does not offer recovery for built-in navigator folders
  - Browser proof seeds legacy localStorage and verifies no duplicate pinned `T`/`C` items
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor over the Sidecar rail. The fixed navigator
defaults are already lawful; the defect is that old editable folder pins can
shadow them.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented duplicate prevention for built-in navigator folders:

- `.ai-workspace/tickets` and `.ai-workspace/comments` are now reserved
  built-in navigator paths
- pinned folder load, save, manual pin, and recovery paths sanitize those
  reserved folders out
- legacy localStorage values containing the old pinned Tickets and Comments
  folders are migrated out automatically
- the rail now renders a compact divider before editable favorites
- browser proof seeds the legacy bad localStorage state and verifies there is
  only one Tickets and one Comments rail entry

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar browse navigator"`: 1 passed
- `npm run test:e2e`: 25 passed

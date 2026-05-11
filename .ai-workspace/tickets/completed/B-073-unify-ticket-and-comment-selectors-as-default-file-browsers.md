---
id: B-073
title: Unify ticket and comment selectors as default file browsers
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Remove divergent selector behavior so Tickets and Comments behave like default pinned filesystem browsers with copy-on-click and typed file rendering.
change_class: realization_refactor
re_entry_point: design
affected_boundary: specification/PRODUCT.md, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/server/index.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-04-29
activated_at: 2026-04-29
completed_at: 2026-04-29
build_tenant: react_vite
dependencies:
  - B-060 completed
  - B-072 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar selector rail, folder browser, tickets selector, comments selector, typed file viewer
intake_source: Operator observation that Tickets and Comments were stale record projections and did not behave like filesystem files: clicking did not copy paths and the selector diverged from Browse.
target_truth: Tickets and Comments are default selector entries over `./.ai-workspace/tickets` and `./.ai-workspace/comments`. They render through the same folder-tree component as Browse and pinned folders. Clicking a file opens the typed file viewer and copies the absolute path.
superseded_truth: Tickets and Comments render bespoke record lists with a separate click contract, while Browse and pinned folders render filesystem-backed rows with path copy and history.
closure_law: This ticket closes only when Tickets and Comments use the shared folder-tree selector, file clicks copy absolute paths through the B-072 command path, typed rendering is preserved, `.ai-workspace` is reachable from Browse, and browser proof covers the behavior.
evaluation_criteria:
  - Tickets selector root is `./.ai-workspace/tickets`
  - Comments selector root is `./.ai-workspace/comments`
  - ticket/comment files open as `surface` viewer tabs
  - ticket/comment file clicks copy the absolute path to clipboard
  - default Tickets and Comments do not duplicate as removable user favorites
  - Browse exposes hidden project folders, including `.ai-workspace`
  - existing typed file rendering remains the viewer path
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - focused Playwright proof passes
proof_surface:
  - specification/PRODUCT.md
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/server/index.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - Tickets or Comments still render through bespoke selector rows
  - clicking ticket/comment files opens record cards instead of file surfaces
  - ticket/comment file clicks do not copy absolute paths
  - `.ai-workspace` remains hidden from Browse
  - typed file rendering is replaced by a plain record renderer
---

## SPEC_METHOD Triage

This is a realization refactor with a design re-entry point. The product-level
utility from B-072 remains correct, but its selector realization was too narrow:
only Browse and user-pinned folders used the filesystem-backed file row.

## Closure Evidence

Implemented:

- Tickets and Comments now resolve to default folder roots over the project
  filesystem.
- The shared folder-tree selector renders those roots and opens clicked files
  as `surface` tabs.
- The B-072 path-history copy command handles ticket/comment file clicks.
- The server browse endpoint accepts explicit hidden-folder inclusion, and
  Sidecar folder browsing requests it so `.ai-workspace` is visible.
- Browser proof was updated to exercise ticket/comment default folder browsing,
  copy-on-click, duplicate suppression, and `.ai-workspace` visibility.

Verification passed:

- `npm run build`
- `npm run test:sidecar-wave`
- `npm run test:e2e -- --grep "sidecar selector uses the same filesystem browser|sidecar browse navigator pins project folders"`
- `npm run test:e2e` (26 Playwright tests)

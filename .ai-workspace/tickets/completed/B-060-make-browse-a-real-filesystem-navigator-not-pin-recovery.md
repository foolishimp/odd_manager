---
id: B-060
title: Make Browse a real filesystem navigator, not pin recovery
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Separate filesystem browsing from sidebar favorite membership.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T12:54:00Z
build_tenant: react_vite
dependencies:
  - B-059 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar Browse filesystem navigator and pinned folder favorites
intake_source: Operator clarified that Browse should show filesystem reality, not a recoverable pin list; unpinning removes only the sidebar favorite, never the browser entry.
target_truth: Browse always shows the underlying Project filesystem. Folder pin state is a sidebar favorite overlay. Pinning adds a sidebar favorite; unpinning removes the favorite but leaves the folder visible wherever it appears in Browse.
superseded_truth: Browse renders pinned folders and a recovery list, so unpinning can look like the folder was removed from the browser.
closure_law: This ticket closes only when Browse loads the project root tree, recovery UI is removed, folders can be pinned from Browse, and unpinning from the sidebar leaves the folder visible in Browse.
evaluation_criteria:
  - Browse renders the project root filesystem tree independent of pinned folder state
  - no recovery section appears in Browse
  - sidebar unpin removes only the favorite rail item
  - the unpinned folder remains visible in Browse and can be pinned again from Browse
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor over the Sidecar Browse/pin UX. The filesystem
browser is a read model over project reality. Pinned folders are operator
favorites in the rail, not the browser's data source.

Lawful re-entry point: Realization.

## Closure Evidence

Implemented the Browse/favorites separation:

- Browse now loads the active Project root as the filesystem tree.
- Browse no longer renders a recovery section.
- Pinned folders are rail favorites only; they are not the data source for
  Browse.
- Unpinning a rail favorite removes the rail item but leaves the folder visible
  in the current browser tree.
- Folder tree controls can pin or unpin the corresponding folder without
  removing the folder from Browse.
- The Browse rail count now indicates filesystem mode rather than favorite
  count.

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar browse navigator|sidecar build tenant favorite"`: 2 passed
- `npm run test:sidecar-wave`: 115 Node tests and 7 Python tests passed
- `npm run test:e2e`: 26 passed

---
id: B-061
title: Align Browse favorites, explorer density, and dark-grey theme
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make the Browse filesystem navigator behave like a compact IDE explorer and add the long-session dark-grey theme variant.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/app/App.tsx, build_tenants/react_vite/src/layout/AppShell.tsx, build_tenants/react_vite/src/lib/types.ts, build_tenants/react_vite/src/components/MarkdownDocument.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-28
created_at: 2026-04-28
updated_at: 2026-04-28
completed_at: 2026-04-28T13:04:25Z
build_tenant: react_vite
dependencies:
  - B-060 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar Browse filesystem navigator, favorite rail, and product theme selection
intake_source: Operator review showed that pinned build-tenant folders should appear as favorites, Browse is too visually large for filesystem navigation, and the preferred long-session development theme is a Visual Studio Code-like dark grey rather than the existing dark blue.
target_truth: Browse remains filesystem reality; pinning a folder makes it a visible rail favorite immediately. The selector uses compact IDE-density rows and controls. Theme selection supports light, dark grey, and dark blue while preserving one shared token grammar.
superseded_truth: Browse folder pinning is visually ambiguous, explorer rows consume too much space, and dark mode only exposes the blue product palette.
closure_law: This ticket closes only when nested Browse folder pinning is executable proof, explorer density is materially reduced, dark-grey theme is first-class typed state, and build/e2e proof passes.
evaluation_criteria:
  - pinning a nested build-tenant folder from Browse creates a rail favorite with a stable short label
  - newly pinned Browse folders can be activated as favorites without leaving Browse in an ambiguous state
  - Browse tree headings, folder controls, and file rows use compact IDE-density metrics
  - theme state accepts light, dark grey, and dark blue
  - theme toggle reaches dark grey before dark blue because dark grey is the preferred development theme
  - Mermaid and browser color-scheme behavior treat both dark variants as dark
proof_surface:
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/app/App.tsx
  - build_tenants/react_vite/src/layout/AppShell.tsx
  - build_tenants/react_vite/src/lib/types.ts
  - build_tenants/react_vite/src/components/MarkdownDocument.tsx
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
---

## SPEC_METHOD Triage

This is a realization refactor over the Sidecar UX implementation. Existing
Product and Requirements already require one shared visual language, truthful
navigation, and a workspace-scoped operator workbench. The gap is in the
current realization: Browse pin state is not obvious enough, tree density is
not suited to file navigation, and theme state does not carry the dark-grey
variant the operator wants for long development sessions.

Lawful re-entry point: Realization.

## STDO-UX Execution Contract

- `State`: theme expands to three explicit variants; pinned folder state stays
  the same operator-favorite overlay.
- `Msg`: no new reducer-owned product messages are introduced.
- `Update`: pinning from Browse transforms only pinned-folder UI state.
- `Cmd`: Browse keeps using the existing filesystem browse contract.
- `View`: density and theme changes remain projections over existing state.

## Closure Evidence

Implemented:

- Browse pin actions now immediately activate the newly pinned folder so the
  rail favorite and current flyout are visibly tied together.
- The Browse tree/file rows use tighter IDE-density spacing, smaller folder
  controls, smaller row typography, and shallower pane/header chrome.
- Theme state now supports `light`, `dark-grey`, and `dark`; the toggle enters
  dark grey before dark blue.
- Dark grey uses a VS Code-like neutral grey palette while preserving shared
  semantic tokens.
- Mermaid and document color-scheme handling treat both dark variants as dark.
- Browser tests now open the observed workspace explicitly instead of relying
  on whichever Project the maintained registry last marked active.

Verified:

- `npm run build`: passed
- `npm run test:e2e -- --grep "sidecar browse navigator|sidecar design language"`: 2 passed
- `npm run test:sidecar-wave`: 115 Node tests and 7 Python tests passed
- `npm run test:e2e`: 26 passed

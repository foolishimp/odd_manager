---
id: B-078
title: Clean up Sidecar Project Favourites and Browse placement
type: bug
ticket_category: ordinary
status: active
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Rehome removed top Project Root selector capability into Sidecar-native Browse and Projects surfaces without introducing a parallel visual grammar.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-05-17
created_at: 2026-05-17
updated_at: 2026-05-30
review_status: implemented_pending_operator_review
build_tenant: react_vite
dependencies:
  - B-058 completed
  - B-060 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar Projects and Browse flyout surfaces
intake_source: Operator review after Claude UI cleanup removed redundant top Sidecar Project Root selector but left missing Project Favourite picking behavior and inconsistent controls.
target_truth: Browse browses and pins folders inside the active Project. Projects owns a Project Browser with separate `Favourite`, `Recent`, and `Pick` tabs for registered Project rows, recent-folder candidates, outside-project navigation, Project favourite registration, compact inline removal via `[U]` beside Browse, and consistent folder-tree controls inside inline Project browsing.
superseded_truth: Cross-project Project favourite picking is hidden under Browse, Project rows use inconsistent action placement, outside-project navigation is not available from the Projects surface, and Project Favourite functions are stacked in one window instead of separated as tabs.
closure_law: This ticket closes only when the Sidecar Projects surface owns Project Favourite add/remove/browse behavior in separate `Favourite`, `Recent`, and `Pick` tabs, Browse is current-Project-only, inline project removal follows the existing compact control grammar, and focused runtime plus build verification pass.
evaluation_criteria:
  - Browse renders only current-Project folder browsing and pinning controls
  - Projects rows render Browse and `[U]` on one action line inside the `Favourite` tab
  - Projects exposes recent folder candidates for Project Favourite registration inside the `Recent` tab
  - Projects exposes outside-project navigation for registering Project Favourites inside the `Pick` tab
  - Project Browser `Favourite` inline trees can add nested folders as Project Favourites through the same compact control grammar
  - Project Browser refresh reloads all visible folders in open inline browse trees while chevron expansion refreshes only that folder
  - reducer replay emits project register/unregister and browse commands deterministically
  - visual styling reuses existing Sidecar row, pill, and tree-control grammar
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - outside-project picking remains only in the Browse surface
  - Project favourite removal appears on a separate line
  - Project rows introduce a new card or action style
  - recent folder candidates cannot be promoted into Project Favourites
  - Project Browser inline browse trees cannot promote nested folders into Project Favourites
  - Project Browser refresh only reloads one selected root while other visible open trees remain stale
---

## STDO-UX Triage

This is a realization refactor over existing Sidecar browser and Project
registry capabilities. The Project registry remains the authority for Project
Favourites. The Sidecar flyout only changes where those actions are exposed and
how they are presented.

Lawful re-entry point: Realization.

## UX Contract

- Browse is for current-Project folder navigation and folder rail pinning.
- Projects is a Project Browser with `Favourite`, `Recent`, and `Pick` tabs.
- Recent Path-derived folder candidates are hints, not authoritative Projects
  until registered through the existing Project registry API.
- Cross-project navigation registers a selected folder as a Project Favourite;
  it does not implicitly switch the active Project.
- `[U]` removes a Project Favourite and must sit beside Browse in the Project
  row action cluster.
- Project Browser inline tree rows use the same compact add-control grammar as
  Recent and Pick Project Favourite registration.
- Project Browser header refresh reloads every visible folder row in open
  inline browse trees; folder chevron expansion refreshes only the expanded
  folder.

## Implementation Evidence 2026-05-17

- Moved cross-project Project Favourite picking out of Browse and into the
  Projects flyout.
- Retitled the Projects flyout projection to `Project Browser` while keeping
  the rail provider label as `Projects`.
- Added separate `Favourite`, `Recent`, and `Pick` tabs in the Project Browser
  header beside the pane title.
- Added Recent folder candidates derived from Sidecar path history.
- Added Pick outside project navigation using the existing filesystem browse
  endpoint and Project registry registration command.
- Kept Browse current-Project-only for folder navigation and folder pinning.
- Reworked Project Favourite row actions so Browse and `[U]` share one compact
  row action cluster.
- Added reducer/markup/style proof for Project Favourites ownership and
  outside-project browse start semantics.

## Verification

- `node --test runtime/tests/test_sidecar_msg_replay.mjs`: passed, 55 tests.
- `npm run build`: passed.
- `npm run test:sidecar-wave`: passed, 149 Node runtime tests and 9 Python
  runtime tests.
- Live headless browser smoke against `http://127.0.0.1:5173/`: Project
  Browser showed separate `Favourite`, `Recent`, and `Pick` tabs; Pick content
  was hidden while Favourite was selected; Recent and Pick each opened as
  separate tab panels.
- Header-placement browser smoke against `http://127.0.0.1:5173/`: Project
  Browser tablist was in `.sidecar-pane__header`, centered with the title, and
  no duplicate tab row remained in the pane body.

## Verification 2026-05-30

- `git diff --check`: passed.
- `node --test runtime/tests/test_sidecar_msg_replay.mjs`: passed, 60 tests.
- `npm run test:runtime:node`: passed, 166 tests.
- `npx playwright test tests/e2e/odd-manager-smoke.spec.ts --grep "project favourite browse tree|project browser refresh|managed project add|shell mode control"`:
  passed, 4 tests.
- `npx playwright test tests/e2e/odd-manager-smoke.spec.ts`: passed, 30 tests.
- `npm run build`: passed with the existing large-chunk warnings.

## Implementation Evidence 2026-05-30

- Extended the shared `FolderTreeNode` Project Browser mode with compact
  Project Favourite add controls for nested folder rows.
- Changed Project Browser header refresh from one selected/root folder to all
  visible folders in open inline browse trees.
- Kept chevron expansion as the local single-folder refresh path.
- Resized the Project Browser refresh affordance to match the square tree pin
  control proportions.
- Repaired the Process Navigator refresh hook order exposed by the full
  Sidecar e2e run, preventing unsupported-to-supported process projection
  transitions from blanking the app.

## Open Review

- Operator visual review remains open before ticket transition.

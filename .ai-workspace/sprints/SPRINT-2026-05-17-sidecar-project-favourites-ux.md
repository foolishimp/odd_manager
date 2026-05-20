# SPRINT-2026-05-17 Sidecar Project Favourites UX

- id: SPRINT-2026-05-17-sidecar-project-favourites-ux
- title: Clean up Sidecar browse and Project Favourites after redundant top selector removal
- status: open
- goal: realize-ai-workspace-topology-and-agent-interoperability
- opened_at: 2026-05-17T00:00:00+10:00
- updated_at: 2026-05-17T21:08:03+10:00
- governance_scope: STDO-UX Method

## Authority

- specification/PRODUCT.md
- specification/requirements/04-orientation-and-navigation.md
- specification/requirements/10-entry-lenses-and-delivery-workspaces.md
- .ai-workspace/tickets/active/B-078-sidecar-project-favourites-browse-cleanup.md
- .ai-workspace/tickets/completed/B-058-remove-info-shell-selector-and-clarify-folder-pinning.md
- .ai-workspace/tickets/completed/B-060-make-browse-a-real-filesystem-navigator-not-pin-recovery.md

## Scope

The Sidecar no longer carries the shell-level Project Root selector in its top
chrome. The displaced capability is rehomed into Sidecar-native surfaces:

- Browse remains a current-Project filesystem navigator for pinning folders
  inside the active Project.
- Projects is the Project Browser surface: it exposes separate `Favourite`,
  `Recent`, and `Pick` tabs for registered Project favourites, recent-folder
  candidates, and outside-Project navigation.
- Removing a Project favourite uses one compact `[U]` control beside Browse on
  the same row, not a separate line or a full-width action.

## Included Tickets

- B-078: active

## Closure Gates

- [x] Projects surface shows registered Project favourites on a separate
  `Favourite` tab with inline Browse and `[U]` controls.
- [x] Projects surface exposes recent folder candidates on a separate `Recent`
  tab that can add Project Favourites.
- [x] Projects surface exposes outside-project navigation on a separate `Pick`
  tab for picking a new Project favourite.
- [x] Browse surface only browses and pins folders within the current Project.
- [x] Focused reducer/markup/style proof passes.
- [x] `npm run build` passes.

## Current Evidence

- Projects flyout title is `Project Browser`; its internal tabs are
  `Favourite`, `Recent`, and `Pick`, mounted beside the title in the pane
  header.
- The `Favourite` tab keeps registered Project rows with Browse and `[U]` in
  one compact action cluster.
- The `Recent` tab exposes recent folders from Sidecar path history as Project
  Favourite add candidates.
- The `Pick` tab starts outside-Project navigation at the parent of the current
  Project root.
- Browse flyout no longer exposes cross-project mode; it remains current-Project
  folder browsing and folder pinning.
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

## Open Review

- Operator visual review of the new Project Browser layout remains open.

## Excluded Boundaries

- no Project registry storage redesign
- no odd_sdlc process/projection changes
- no top-shell Project selector restoration inside Sidecar
- no GTL/ABG runtime semantics

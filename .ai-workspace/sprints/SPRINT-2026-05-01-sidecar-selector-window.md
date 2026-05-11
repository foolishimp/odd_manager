# SPRINT-2026-05-01 Sidecar Selector Window

- id: SPRINT-2026-05-01-sidecar-selector-window
- title: Close persistent Sidecar selector-window backlog
- status: closed
- goal: realize-ai-workspace-topology-and-agent-interoperability
- opened_at: 2026-05-01T00:16:08+10:00
- closed_at: 2026-05-01T00:16:08+10:00
- updated_at: 2026-05-01T00:16:08+10:00

## Authority

- specification/PRODUCT.md#File-Path-Memory
- specification/requirements/04-orientation-and-navigation.md
- specification/requirements/10-entry-lenses-and-delivery-workspaces.md
- build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
- specification_methodology v1.4.0 sprint execution-control and UX
  compliance-escrow law

## Scope

Close B-071 after reviewing the existing implementation and adding the missing
design and browser proof for the pinned Sidecar selector window.

## Excluded Boundaries

- no GTL/ABG runtime semantics
- no odd_sdlc query-contract changes
- no Project registry model changes
- no document-viewer capability work
- no record-action redesign for Tickets or Comments after B-073 made those
  selectors filesystem-backed by default

## Expected Change Classes

- design_reframe for the selector-window law
- realization_refactor for the e2e proof over existing reducer-owned state

## Included Tickets

- B-071: completed

## Close Review

B-071 is accepted because persistent selector behavior is reducer-owned
Sidecar UX state and the current view projects it directly:

- `infoPinned` is part of `SidecarState.ui`
- `ui/set-info-pinned` opens and pins the selector without command effects
- `.sidecar-workbench.is-left-pinned` moves the selector into the grid and
  shifts the canvas right
- outside click closes only transient flyouts
- unpin returns the flyout to transient behavior
- pinned selection keeps Browse and Comments open while opening files, and
  keeps the Tickets selector open while browsing ticket lanes

B-073 changed the context-action premise for Tickets and Comments. The default
selector path is now filesystem-backed. Record-specific actions remain valid in
record inspectors or later explicit context-action work, not as a B-071
non-closure condition.

## Verification

- `runtime/tests/test_sidecar_msg_replay.mjs` covers replay and static layout
  contract for `ui/set-info-pinned`.
- `tests/e2e/odd-manager-smoke.spec.ts` now includes pinned selector browser
  proof for Browse file selection, Tickets selector persistence, Comments file
  selection, outside-click persistence, and unpin close.

## Deferred Compliance

None. This sprint does not escrow state ownership, selector closure behavior,
or context-action authority.

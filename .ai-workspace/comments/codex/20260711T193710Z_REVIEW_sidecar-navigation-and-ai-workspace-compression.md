# REVIEW: Sidecar Navigation And AI Workspace Compression

**Author**: codex
**Date**: 2026-07-11T19:37:10+10:00
**Addresses**: T-031; ADR-001; ADR-002; AI Workspace; Sidecar
**Status**: Closed

## Finding

AI Workspace duplicated weaker Tickets and Comments navigation by flattening
their files into artifact rows. The canonical Sidecar navigators already
preserved lane/author hierarchy, name/time sorting, refresh, path lineage, and
right-tab opening.

Specification and Build Tenants were also represented as default favorites.
They are stable Project-level navigation functions and therefore belong in the
provider registry beside Tickets and Comments.

## Decision

ADR-002 ratifies one shell grammar:

```text
left activity provider -> flyout navigator -> selected object -> right viewer tab
```

The primary provider order is now `T`, `C`, `S`, `B`. Browse is the `F` system
provider and Recent Paths remains `H`. Favorites contain only user-selected
non-canonical Project folders.

AI Workspace remains a right-side feature inventory. Its Tickets and Comments
features activate the canonical left navigators, and their flat artifact groups
are no longer rendered. The AI Workspace tab remains open while a navigator is
used, preserving the same Context and viewer workspace.

## Realization

- extended the typed provider registry with Specification and Build Tenants;
- bound provider roots to `specification/` and `build_tenants/` through the
  existing shared folder navigator;
- migrated canonical roots out of persisted favorites;
- retained hierarchy, sorting, refresh, file selection, clipboard/path history,
  and viewer-tab opening through one function;
- added a `provider` path-history source rather than mislabeling built-in
  navigation as a favorite;
- delegated AI Workspace Tickets/Comments features to provider selection;
- removed dead AI Workspace open-tab styling;
- suppressed desktop sweep-out details after the context rail reflows into the
  compact mobile grid, preventing focused-control overlap.

## Proof

- runtime and replay: 263/263 passed;
- TypeScript: passed;
- production build: passed with the existing chunk-size warning;
- complete Playwright lane: 44/44 passed in 4.4 minutes;
- browser proof covers T/C hierarchy and sorting, canonical-root favorite
  migration, first-class S/B selection, AI Workspace handoff, right-tab
  retention, desktop/mobile containment, and existing viewer regressions;
- desktop/mobile screenshots were visually inspected;
- independent near-black compositor checks returned zero for the revised
  navigation captures;
- `git diff --check`: passed.

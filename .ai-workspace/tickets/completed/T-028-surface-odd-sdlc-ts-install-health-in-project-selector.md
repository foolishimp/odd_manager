---
id: T-028
title: Surface odd_sdlc TypeScript install health in the project selector
type: feature
ticket_category: ui_substrate_alignment
status: completed
review_status: closed_as_superseded
proof_status: supersession_verified
goal: realize-ai-workspace-topology-and-agent-interoperability
build_tenant: react_vite
owner: unassigned
change_intent: Let the project selector surface a compact install-health badge for the selected project using the typed supported/unsupported state already carried by the sidecar process projection.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: src/features/project-selector/ProjectSelector.tsx, src/features/project-selector/FolderBrowser.tsx, sidecar process projection supported-state carrier
priority: low
created_at: 2026-05-05
updated_at: 2026-07-11T19:57:31+10:00
superseded_by: T-034
governance_scope: STDO Method
depends_on:
  - T-026
intake_source: T-025 audit classified project-selector as out_of_scope for runtime evidence but identified an optional low-priority UX follow-up for TS install health.
target_truth: The selector can show whether the active project exposes the odd_sdlc TypeScript process contract without making project browsing substrate-dependent.
closure_law: This ticket closes only when the selector consumes typed supported/unsupported state, keeps generic browsing of non-odd_sdlc roots intact, and includes proof that unsupported projects remain selectable.
---

# T-028: Surface odd_sdlc TS Install Health In Project Selector

## STDO Triage

First missing layer: realization.

The project selector is not a runtime substrate surface. The useful follow-up is a non-blocking install-health badge after selection, not a hard dependency before browsing.

## Carrier Consumption

`consumes_carrier(t026:live_module_projection.supported_state)`

Fields consumed:

- `SidecarProcessProjection.supported`
- `SidecarProcessProjection.unsupportedReason`
- `contractName`
- `contractVersion`

## Closure Criteria

- selected projects can show supported/unsupported TypeScript process contract state
- unsupported roots remain valid for generic browsing and shells
- proof covers supported and unsupported projects

## Prime-Set Cleanup 2026-07-11

The odd_sdlc TypeScript install-health carrier, Sidecar process projection, and
legacy Project selector are retired. T-034 established Build Portfolio as the
one cross-Project registry and readiness navigator, with generic capability
availability and explicit missing-carrier states. This ticket is completed by
supersession; it must not restore substrate-specific selector health logic.

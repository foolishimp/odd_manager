---
id: B-032
title: Normalize Sidecar design language and component grammar
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Convert the now-working Sidecar workbench primitives into a consistent design language that keeps the central workspace visually minimal while concentrating navigation, metadata, and command complexity in sidebars and compact control rails.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-026
dependencies:
  - B-026 completed
  - B-031 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route visual and interaction grammar
intake_source: Operator feedback after B-026 through B-031 established the core Sidecar workbench behavior. The next gap is consistency of design language and logical design.
target_truth: Sidecar exposes one coherent workbench design language. Rails select, flyouts browse, viewer and terminal groups share the same tab grammar, the central canvas and terminal workspace are internally low-border, sidebar/control surfaces use compact 8px geometry, nested surfaces do not read as cards inside cards, and light/dark styling is derived from shared product tokens.
superseded_truth: Sidecar has working primitives but still mixes copied visual idioms, large-radius panels, duplicate tab styling, bordered internal workspace panes, and inconsistent surface hierarchy across explorer, viewer, inspector, session, and terminal areas.
closure_law: This ticket closes only when the Sidecar design module defines the component grammar, the implementation normalizes the Sidecar CSS to that grammar without changing reducer-owned behavior, executable assertions cover the grammar invariants, and build plus sidecar-wave plus e2e verification pass.
evaluation_criteria:
  - SPEC_METHOD triage is recorded with `design_reframe` and design re-entry
  - UX_METHOD remains the sole UX realization authority for the Sidecar production surface
  - the design module defines Sidecar layout regions and reusable visual primitives
  - viewer and terminal tab groups use one shared visual grammar
  - activity rail, flyout, context rail, rows, replies, controls, and action result containers use compact 8px geometry unless the element is an intentional chip/dot/handle
  - central viewer and terminal split groups are internally low-border and avoid card-like containers
  - nested Sidecar content avoids card-in-card visual hierarchy
  - light and dark mode styling derives from shared tokens rather than separate local palettes
  - CSS assertions cover the normalized grammar
  - browser proof covers Sidecar rendering in light and dark theme
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - cosmetic changes are made without a design grammar in the design module
  - new behavior is introduced while claiming a visual-language pass
  - Sidecar view code starts owning product-meaningful state outside the reducer
  - duplicated viewer and terminal tab CSS drifts into different grammars
  - large-radius card styling remains on Sidecar control surfaces or nested surfaces
  - central viewer or terminal split groups read as bordered cards instead of workspace windows
  - light or dark mode gets special-case styling that contradicts shared product tokens
---

## SPEC_METHOD Triage

This is a substantive design change because the Sidecar now has enough
primitive behavior for visual and interaction inconsistency to become product
risk. The request does not change Goals, Intent, Product, or Requirements. It
reprices the design layer so future functionality composes through a coherent
workbench language.

Affected product boundary: `odd_manager` production Sidecar route in the
`react_vite` build tenant.

Lawful change class: `design_reframe`.

Lawful re-entry point: Design.

## STDO-UX Execution Contract

The implementation must preserve the existing Elm Architecture process model:

- `State`: no new product-meaningful state is added for this pass
- `Msg`: no new Sidecar messages are required for visual normalization
- `Update`: reducer behavior remains unchanged unless a proof exposes drift
- `Cmd`: no new command effects are introduced
- `Sub`: no new external subscriptions are introduced
- `View`: visual grammar is a projection over existing state

The design language is not a replacement authority for UX_METHOD. It is the
Sidecar-local realization grammar under UX_METHOD.

## Implementation Plan

1. Add the Sidecar design-language rule to the Sidecar design module.
2. Normalize Sidecar CSS primitives around compact workbench geometry.
3. Consolidate viewer and terminal tab visual grammar.
4. Add executable CSS grammar assertions.
5. Add browser proof that Sidecar renders under light and dark themes.
6. Run build, sidecar-wave, and e2e proof.

## Closure Evidence

Closed at: 20260427T104939Z.

The Sidecar design module now defines the current grammar:

- navigation and metadata complexity lives in the activity rail, flyout,
  context rail, and compact session/control strips
- center canvas and terminal workspace are low-border workspace areas
- viewer and terminal split groups are group windows rather than nested cards
- viewer and terminal tabs share one visual grammar
- theme styling derives from shared product tokens

Implementation changes:

- added Sidecar-scoped design tokens for radius, gaps, surfaces, tabs, and
  active borders
- removed card-like border/background/shadow treatment from the canvas and
  bottom dock work areas
- removed bordered-card framing from viewer and terminal split groups
- consolidated viewer and terminal tab CSS into shared selectors
- normalized Sidecar control surfaces and nested records to compact geometry

Proof:

- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 102 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 12 Playwright tests.
- New Msg/CSS proof asserts sidebar-complex/workspace-low-border grammar and
  shared viewer/terminal tab grammar.
- New browser proof asserts Sidecar canvas and terminal dock remain borderless
  and transparent in light and dark themes while sidebars retain visible
  surface treatment.

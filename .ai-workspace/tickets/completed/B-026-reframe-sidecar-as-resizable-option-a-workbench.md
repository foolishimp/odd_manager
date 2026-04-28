---
id: B-026
title: Reframe Sidecar as resizable Option A workbench
type: design_reframe
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Continue Option A by turning the existing Sidecar into an ODD Manager-native workbench with VS Code-inspired resize, explorer, split-viewer, and split-terminal mechanics while retaining the current xterm substrate and STDO-UX state boundary.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/oddterm/OddTermPanel.tsx, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-025
dependencies:
  - B-021 completed
  - B-022 completed
  - B-023 completed
  - B-024 completed
  - B-025 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
ux_method_authority: /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
ux_surface_scope: production Sidecar route and all Sidecar-reachable explorer, viewer, terminal, session, context, and layout controls
ux_process_model: Elm Architecture with typed State, Msg, pure Update, declared Cmd, declared Sub, pure View projection, and effect membrane interpretation
ux_scaffold_exemption: none
ux_stack_choice: TypeScript, React, Vite, Sidecar reducer, and declared effect interpreter
ux_accessibility_standard: WCAG AA unless superseded by stricter project-local law
intake_source: Operator chose Option A after comparing continuing the native Sidecar path, adopting existing editor frameworks, or creating a VS Code plugin. Operator wants VS Code-like resize, contextual explorer selection, tabbed split viewer panes, and tabbed CLI panes inside the ODD Manager Sidecar.
target_truth: Sidecar is an ODD Manager-native resizable workbench. The fixed activity rail selects contextual explorer providers, explorer/viewer/terminal regions can be resized by drag, viewer work is represented as tabbed split pane groups, shell work is represented as tabbed split terminal groups, and compact session controls do not consume the main canvas.
superseded_truth: Sidecar is a fixed-grid rail/flyout/bottom-dock surface with independent collapse controls but without generalized workbench primitives for resizing, explorer-provider selection, viewer tab groups, or terminal tab groups.
closure_law: This ticket closes only when the design surface defines the resizable workbench carrier model under UX_METHOD, the implementation is cut into lawful follow-up tickets, and the first implementation slice has proof that resize/tab/split state is reducer-owned Sidecar Msg state rather than view-local imperative layout state.
evaluation_criteria:
  - Sidecar workbench carrier model is documented before feature implementation
  - triage declares design_reframe as the lawful re-entry point
  - Option A is explicitly distinguished from adopting a VS Code/Theia codebase or building a VS Code extension
  - UX_METHOD is declared as sole UX realization authority for the Sidecar production surface
  - State, Msg, Update, Cmd, and Sub are declared before implementation
  - product-truth-changing messages map to admitted AssetSurface, session, context, runtime, or equivalent typed product contracts
  - external HTTP, MCP, websocket, storage, and browser payloads are runtime-validated before entering Sidecar state
  - accessibility obligations are explicit for pointer, keyboard, focus, semantic roles, separator handles, tablists, and theme contrast
  - work is decomposed into safe implementation tickets for layout, explorer providers, viewer groups, terminal groups, and persistence/proof
  - every planned layout operation is represented as Sidecar State/Msg replay with no accidental Cmd effects
  - every planned terminal effect stays inside the existing session and xterm effect membrane
  - Msg-replay proof is required for resize, collapse/restore, explorer selection, viewer split/tab, terminal split/tab, session control, and persistence
  - browser proof is required for pointer drag resize, keyboard resize, section collapse/restore, viewer split/tab, terminal split/tab, viewport filling, and light/dark themes
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - follow-up implementation tickets
  - runtime Sidecar Msg replay tests
  - Playwright e2e tests
  - runtime validation tests for external seams
  - accessibility assertions or documented accessibility review
non_closure_conditions:
  - adopting VS Code or Theia without a separate product/design re-entry
  - turning Sidecar into a VS Code extension
  - implementing drag or tab state as ungoverned view-local React state
  - using existing code, screenshots, component convention, or Local Shell Workspace behavior to weaken UX_METHOD
  - a Sidecar view owns continuation through refs, closures, timers, module variables, or local state that changes product behavior after unmount
  - a product-truth-changing UX message lacks an admitted carrier or typed product contract
  - external payloads enter Sidecar state without runtime validation
  - pointer-only resize, tab, split, or session behavior lacks keyboard-equivalent operation
  - custom splitters, tabs, rails, or terminal controls lack semantic roles, focus behavior, or accessible names
  - replacing the xterm terminal substrate in this wave
  - adding a second runtime or editor-owned authority surface inside ODD Manager
---

## Ticket Write-Up

Option A is accepted for the next Sidecar wave. The work continues the native
ODD Manager Sidecar path rather than importing an editor runtime or moving the
product into a VS Code extension.

The useful lesson from VS Code is workbench geometry, not source authority:
fixed navigation rails, a selectable explorer, resizable split regions,
tabbed/splittable viewer groups, tabbed/splittable terminal groups, and compact
session/context controls that preserve large work surfaces.

The target is an ODD Manager-native workbench under STDO-UX:

- a left activity rail selects the active explorer provider
- the explorer provider renders one contextual browser at a time
- the center canvas is a set of tabbed viewer groups that can split
- the bottom dock is a set of tabbed terminal groups that can split
- compact session controls sit outside the terminal canvas
- all layout changes replay through Sidecar State/Msg
- terminal attach, spawn, close, and I/O stay inside the existing effect
  membrane

## STDO-UX Governance Binding

`UX_METHOD.md` is the sole UX realization authority for the covered Sidecar
surface. Existing code, screenshots, the old Local Shell Workspace, VS Code,
component-library conventions, comments, and design history are evidence only.
They cannot weaken the method.

The covered surface is not a scaffold. Sidecar is reachable from the product
shell, changes selection and context, opens product records, spawns and
attaches shell sessions, and can emit product-truth-changing actions. Therefore
no scaffold exemption applies.

The process model is the Elm Architecture:

- `State`: typed Sidecar state held by the runtime
- `Msg`: typed Sidecar action algebra for every user and system action
- `Update`: pure reducer `(Msg, State) -> (State, Cmd[])`
- `Cmd`: declared effect descriptions interpreted by the Sidecar membrane
- `Sub`: declared external subscriptions that return typed `Msg`
- `View`: pure projection from `State` to view tree

React and Vite are stack choices only. They are lawful only while preserving
the process model. Render code must not own continuation, perform effects,
mutate product state, or hide multi-step behavior in local closures, refs,
timers, or component-local state.

## STDO-UX Carrier Declaration

Irreducible UX carriers for this wave:

- `SidecarState`: admitted state for the Sidecar workbench
- `SidecarWorkbenchLayout`: region sizes, split ratios, collapse state,
  selected explorer provider, active viewer group, active terminal group, and
  layout profile identity for `Context = Project x Workspace`
- `ExplorerProvider`: typed provider identity and projection binding for
  Projects, Tickets, Comments, Sessions, and future admitted providers
- `ViewerGroup` and `ViewerTab`: center-canvas tab and split carriers
- `TerminalGroup` and `TerminalTab`: bottom-dock tab and split carriers over
  existing session identities
- `SidecarMsg`: layout, provider, viewer, terminal, context, session, focus,
  persistence, success, and failure messages
- `SidecarCmd`: declared load, write, session, terminal, persistence, and
  validation effects
- `SidecarSub`: declared terminal websocket, session screen, context, and any
  other external event streams

Subordinate payloads must stay subordinate. A view payload, component prop, or
DOM handle must not become a rival state carrier.

## State / Msg / Update / Cmd / Sub Requirements

Layout messages are UX-local when they change only workbench presentation:
resize panel, commit resize, collapse section, restore section, select
explorer provider, select tab, split group, close tab, move focus, change
filter, or reset layout.

Product-truth-changing messages are not UX-local. They must map to an admitted
carrier:

- project and context changes map to the selected context contract
- ticket actions map to the ticket `AssetSurface` action surface
- comment actions map to the comment `AssetSurface` action surface
- shell spawn, close, attach, and terminal I/O map to the session/runtime
  contract
- future workorder, agent, graph-call, closure, evidence, or provenance actions
  must map to their published carrier before the UX can expose them

The reducer is pure. It may compute the next `State` and emit `Cmd` values. It
must not perform I/O, access browser storage, call services, mutate globals,
or manipulate the DOM.

The effect membrane interprets declared `Cmd` values and returns success or
failure `Msg` values with deterministic correlation keys. Effect handlers must
not contain hidden decision logic that should live in the reducer.

`Sub` streams must be declared. Websocket, terminal screen, context, runtime,
or external event streams must emit typed messages before state changes.

## View And Interaction Law

The Sidecar view is `View = f(State)`. Components may use implementation-local
ephemera only for values that are genuinely inconsequential after unmount,
such as hover presentation. If losing the value changes another view, product
behavior, session behavior, layout recovery, or replay, the value belongs in
`SidecarState`.

Drag resize must not become an imperative layout controller. Pointer capture
and DOM measurement are host interop at the membrane. Region sizes, split
ratios, preview state, and committed state are emitted as typed messages and
represented in `SidecarWorkbenchLayout`.

Tabs and split groups must be state projections. The selected tab, active
group, split direction, split ratio, and group membership must be replayable
from the `Msg` log.

Terminal panes may hold platform handles required by xterm interop, but the
handle must not be semantic state. Session identity, attachment status, active
terminal group, selected terminal tab, and lifecycle state remain in typed
Sidecar state or the admitted session contract.

## AssetSurface And External-Seam Binding

Sidecar derives UX state from admitted contracts, not from UX-local copies of
product truth. Projects, tickets, comments, sessions, and context records must
come from shared contracts or explicit runtime schemas. UX-local types are
allowed only for presentation concerns.

Runtime validation is mandatory before out-of-process data enters
`SidecarState`:

- HTTP and API responses
- MCP payloads
- websocket and terminal event payloads
- file-loaded records
- localStorage or other browser persistence
- URL, clipboard, or browser integration payloads

Invalid payloads fail into typed failure messages. They must not be accepted
through permissive defaults that reconstruct product truth in the view.

## Accessibility Requirements

Every pointer interaction in this wave needs a keyboard-equivalent operation.
This includes splitter resize, tab selection, split creation, section
collapse/restore, terminal selection, session selection, and explorer-provider
selection.

Custom controls require semantic roles and accessible names. Splitter handles
should expose separator semantics and value state. Viewer and terminal tab bars
should expose tablist semantics. Dynamic selection changes must manage focus
predictably. Light and dark themes must preserve WCAG AA contrast unless a
stricter project-local rule supersedes it.

## Proof Requirements

Each interaction family requires Msg-replay proof:

- region resize and resize reset
- info and shell collapse/restore
- explorer provider selection
- viewer open/select/close/split
- terminal open/select/close/split
- shell spawn/close/attach message path
- layout persistence load/save failure path
- invalid external payload failure path

Each replay proof includes an initial state fixture, ordered `Msg` log,
expected final state, expected ordered `Cmd` values, and success/failure
messages returned from interpreted commands.

Browser proof must cover desktop and narrow viewports, pointer and keyboard
operation, section restore affordances, viewport filling, non-overlapping text,
and light/dark theme rendering.

## Triage

Lawful re-entry point: `design_reframe`.

The product `WHAT` is unchanged. `odd_manager` remains the operator-facing
control plane for visible, governable, auditable, and operable runtime and
domain truth. Sidecar remains the project-agent workspace surface inside that
control plane.

The realization `HOW` changes. The fixed rail/flyout/bottom-dock layout from
B-021 through B-025 becomes a reusable workbench model with resizable regions,
explorer providers, viewer tab groups, and terminal tab groups.

This is not Option B. This ticket does not adopt VS Code, Theia, Monaco, or
another editor workbench as authority. A future editor-framework adoption would
need its own product/design re-entry because it changes the runtime and
dependency posture.

This is not Option C. This ticket does not move ODD Manager into a VS Code
extension. A navigator plugin may be useful later, but it would be a separate
distribution and integration product.

Risk is medium-high because the change touches the primary operator layout.
The risk is managed by decomposing the work into small tickets and requiring
replay tests plus browser evidence for each interaction family.

## Implementation Plan

Phase 1: Workbench layout model and resize primitive.

Introduce a `SidecarWorkbenchLayout` state carrier for explorer width, right
rail width, bottom dock height, section collapse state, and viewer/terminal
split ratios. Add Sidecar messages for resize start/update/commit or direct
resize commit. Prove resize state changes emit no `Cmd`. Add keyboard resize
semantics and accessible splitter roles before closure.

Phase 2: Contextual explorer provider registry.

Generalize the current Projects/Tickets/Comments rail into an explorer
provider registry. The left rail selects a provider. The explorer panel renders
the active provider. Initial providers should cover projects, tickets,
comments, and sessions without changing server contracts. Provider selection
is `Msg` state; provider data enters state only after runtime validation.

Phase 3: Tabbed split viewer panes.

Represent center work as `ViewerGroup[]` and `ViewerTab[]`. Add selection,
open, close, and split messages. Initial tabs should wrap existing project,
ticket, comment, and context inspector projections before adding new editor
surfaces. Tab and split controls must expose keyboard and semantic tablist
behavior.

Phase 4: Tabbed split terminal panes.

Represent shell work as `TerminalGroup[]` and `TerminalTab[]` over the existing
session/xterm substrate. Keep spawn, close, attach, and terminal I/O as the
only terminal effects. Move session selection into a compact horizontal or
right-edge control surface so terminal groups stay large. Xterm host handles
are platform interop only; terminal semantic state remains typed and replayable.

Phase 5: Persistence and browser proof.

Persist layout per `Context = Project x Workspace`. Add reset-to-default. Add
Playwright coverage for viewport filling, drag resize, independent collapse
and restore, viewer split/tab behavior, terminal split/tab behavior, and dark
and light theme rendering. Persisted layout is an external payload and must be
validated before it is admitted into `SidecarState`.

## Follow-Up Ticket Cut

Recommended implementation tickets:

- B-027: Realize Sidecar workbench layout state and drag resize primitive — completed
- B-028: Realize contextual explorer provider registry — completed
- B-029: Realize tabbed split viewer pane groups — completed
- B-030: Realize tabbed split terminal pane groups — completed
- B-031: Persist Sidecar workbench layout and prove browser behavior — completed

## Start Evidence

B-026 has started through B-027. The first lawful implementation slice
realized reducer-owned workbench layout state and accessible resize controls
for explorer width, context rail width, and terminal dock height. Build,
Sidecar wave, and Playwright verification passed.

B-028 continued the wave by introducing the typed explorer provider registry
and adding Sessions as a provider. Provider selection remains reducer-owned and
effect-free, Sessions renders as a projection over admitted session state, and
build, Sidecar wave, and Playwright verification passed.

B-029 realized reducer-owned viewer tabs and split viewer groups for the center
canvas. Viewer tabs store object identity only, inspector bodies remain
projections over admitted state, and viewer open/select/close/split/focus
messages emit no command effects. Build, Sidecar wave, and Playwright
verification passed.

B-030 realized reducer-owned terminal tabs and split terminal groups for the
bottom dock. Terminal tabs store session identity only, spawn/kill remain
declared session commands, terminal attach/I/O stays inside the existing
xterm/WebSocket membrane, and terminal open/select/close/split/focus messages
emit no layout command effects. Build, Sidecar wave, and Playwright
verification passed.

B-031 completed the Option A workbench wave by adding a versioned
Context-scoped layout profile, fail-closed persisted payload validation,
browser localStorage effect-membrane load/save, and reset-to-default as a typed
Sidecar message. Build, Sidecar wave, and Playwright verification passed.

## Closure Evidence

- Sidecar workbench carrier model is documented in
  `build_tenants/react_vite/design/widgets/sidecar-session-workspace.md`.
- Workbench layout sizing is reducer-owned and supports pointer plus keyboard
  resize.
- Explorer providers are represented by a typed registry.
- Center viewer panes are represented by reducer-owned viewer tabs and split
  groups.
- Bottom terminal panes are represented by reducer-owned terminal tabs and
  split groups over the existing xterm substrate.
- Layout profile persistence is versioned, Context-scoped, validated before
  reducer admission, and resettable through typed `SidecarMsg`.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 100 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 11 Playwright tests.

## Non-Goals

- do not fork or embed VS Code in this wave
- do not adopt Theia or Monaco as the workbench authority in this wave
- do not create a VS Code extension in this wave
- do not replace the existing xterm terminal substrate
- do not add arbitrary source-file editing until viewer groups exist
- do not introduce layout state outside the Sidecar State/Msg replay boundary

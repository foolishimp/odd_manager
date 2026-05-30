# Design Module - Sidecar Session Workspace OddTerm Port

**Status**: Active
**Date**: 2026-04-27
**Ticket**: B-015
**Tenant**: `react_vite`
**Governance**: STDO-UX (`SPEC_METHOD`, `TICKET_METHOD`, `DESIGN_MODULE_METHOD`, `ODD_METHOD`, `UX_METHOD`)
**Reference Source**: `build_tenants/react_vite/src/features/oddterm/OddTermPanel.tsx`; `build_tenants/react_vite/src/server/oddterm-pool-service.mjs`
**Target Surface**: `build_tenants/react_vite/src/features/sidecar/`

## 1. Purpose

The Sidecar session pane must be ported onto the reliable Local Shell
Workspace substrate without treating the old React widget as authority.

The reference line proves the oddterm runtime carrier:

- `/api/oddterm/session` creates local shell sessions.
- `/api/oddterm` attaches xterm input/output to the selected session.
- the oddterm store preserves session identity, label, pid, backend, and
  transcript references under `.ai-workspace/runtime/`.

The reference line does not govern the target UX realization. Its direct
`useState`, direct async handlers, and xterm/WebSocket controller code are
reference material only.

## 2. Target Boundary

The target boundary is the Sidecar Session Workspace inside `SidecarPanel`.

It consumes the shared `SessionRecord` contract from `src/contracts/session.ts`
and uses an oddterm-backed SessionAsset projection exposed by the server.

Product-meaningful actions are:

- load Sidecar data for the active Project Context
- select a session
- refresh the backend session projection after a browser reload or suspected
  frontend disconnect
- spawn a shell session
- close a shell session
- attach terminal input/output to one selected live session

The UX layer emits typed `Msg` values. The reducer describes typed `Cmd`
values. The effect membrane interprets those commands through HTTP and
WebSocket effects.

## 3. Reference-Derived Mapping

| Reference Material | Target Mapping |
|---|---|
| oddterm session store | preserved as the runtime session carrier |
| `/api/oddterm/session` create/select/close | wrapped by Sidecar session commands and projected as `SessionRecord` |
| `/api/oddterm` WebSocket | used by the terminal effect membrane |
| `GTermSessionSummary` | demoted to `raw` payload on `SessionRecord`; not consumed as Sidecar truth |
| `OddTermPanel` split layout, rename, promote, agent join controls | deferred families outside B-015 |
| view-local action state and direct async handlers | rejected for target; replaced by `State`/`Msg`/`Update`/`Cmd` |

## 4. State / Msg / Update / Cmd

`SidecarState` owns product-meaningful Sidecar state:

- active Context
- Project, Ticket, Comment, and Session projections
- current selection
- unread IDs
- reply draft
- last action result
- pending commands emitted by the reducer

`SidecarMsg` names all user and effect outcomes.

`updateSidecarState` is pure. It never performs I/O.

`describeSidecarCommands` and `reduceSidecarState` are the target
`Update : (Msg, State) -> (State, Cmd)` realization. The React component uses
the reducer result and interprets pending commands in the effect membrane.

## 5. Effect Membrane

The Sidecar effect membrane is bounded to:

- HTTP calls for AssetSurface projections and actions
- xterm.js imperative terminal creation and disposal
- WebSocket attachment to `/api/oddterm`
- refresh/reconnect through the backend-managed OddTerm session registry
- `ResizeObserver` and terminal resize messages

The membrane may branch on declared `Cmd` or terminal event type. It must not
derive product meaning outside `State`/`Msg`/`Update`.

## 6. Irreducible Architectural Carrier Set

- `SidecarState` `<<prime>> <<authoritative>>`: current Sidecar UX state.
- `SidecarMsg` `<<prime>> <<authoritative>>`: action and effect outcome algebra.
- `SidecarCmd` `<<prime>> <<authoritative>>`: declared effect algebra.
- `SessionRecord` `<<prime>> <<downstream>>`: shared FE/BE session contract consumed by the Sidecar.
- `OddTermTerminalHandle` `<<effect-edge>>`: xterm/WebSocket platform handles, not product truth.
- `GTermSessionSummary` `<<subordinate>>`: reference runtime payload retained only inside `SessionRecord.raw`.

## 7. Structural Carrier Diagram

```mermaid
classDiagram
  class SidecarState {
    <<prime>>
    <<authoritative>>
    +context
    +sessions
    +selection
    +pendingCommands
  }
  class SidecarMsg {
    <<prime>>
    <<authoritative>>
    +load/request
    +session/spawn/request
    +session/kill/request
    +cmd/dispatched
  }
  class SidecarCmd {
    <<prime>>
    <<authoritative>>
    +load
    +session.spawn
    +session.kill
  }
  class SessionRecord {
    <<prime>>
    <<downstream>>
    +id
    +status
    +cwd
    +raw
  }
  class OddTermTerminalHandle {
    <<effect-edge>>
    -Terminal
    -FitAddon
    -WebSocket
    -ResizeObserver
  }
  class GTermSessionSummary {
    <<subordinate>>
    -label
    -backend
    -pid
  }

  SidecarState *-- SessionRecord
  SidecarMsg --> SidecarCmd
  SidecarCmd --> SessionRecord
  SessionRecord *-- GTermSessionSummary
  OddTermTerminalHandle --> SessionRecord
```

## 8. Deferred Families

The following reference features remain outside B-015 and need separate
tickets before retirement of the old Local Shell Workspace:

- split terminal layout
- rename session
- promote terminal tail
- launch Codex/Claude from a shell
- join a room topic from a shell
- font/layout persistence

They are not removed from the old widget in this ticket.

## 9. B-016 Visual Realization Rule

B-016 is a realization refactor over the same target boundary. It does not add
new Sidecar product behavior, message kinds, command kinds, or server effects.

The Sidecar presentation must consume the product's shared design primitives:

- `panel` / `panel--agent-console` for the containing surface
- `summary-pill` for compact context and count state
- `status-chip` for terminal connection state
- `agent-console__terminal-shell`, `agent-console__terminal-bar`, and
  `agent-console__terminal-host` for terminal framing
- app theme variables from `styles.css` for light and dark mode

Local Shell Workspace remains reference material. The lawful import is visual
and ergonomic: terminal shell framing, session action sizing, and compact
session status presentation. Its view-local state pattern, direct effect
handlers, and additional product actions remain outside this Sidecar boundary.

## 10. B-017 Workspace Separation Rule

B-017 splits the Sidecar realization into two Sidecar-owned sub-workspaces:

- `Info Browser`: Project, Ticket, and Comment browsing plus the information
  inspector.
- `Shell Workspace`: session list, spawn/close controls, session metadata, and
  terminal attachment.

The separation is a UX realization rule. It does not create new product
surfaces or new server effects.

Collapse state is part of `SidecarState.ui` and changes only through
`SidecarMsg` replay. The target must not copy the Local Shell Workspace's
view-local `useState` collapse flags. The lawful import is the interaction
shape: each sub-workspace has an expanded form, a collapsed strip, summary
pills, and an independent expand/collapse command.

Shell session selection is independent of the info-browser selection. Selecting
a shell must not clear the selected Project, Ticket, or Comment.

## 11. B-018 Shell Window Layout Rule

B-018 ports the Local Shell Workspace window ergonomics into the Sidecar shell
workspace while keeping the Sidecar method boundary.

The shell workspace must render full-width inside Sidecar:

- session manager as a horizontal strip above terminal windows
- single terminal window layout
- split vertical terminal window layout
- split horizontal terminal window layout
- primary and secondary shell selection represented in `SidecarState`

The shell layout and secondary-window selection are `SidecarMsg` updates and do
not emit `SidecarCmd` effects. Spawn, close, and terminal attach remain the only
shell effects, and they stay inside the existing effect membrane.

## 12. B-019 Route Width Rule

B-019 fixes route containment. The Sidecar route must not inherit the default
two-column `.workspace-view` layout used by inspector-oriented pages. Sidecar is
itself a composed workspace surface and must be mounted in a one-column
full-width route container.

A Sidecar width defect exists when the Sidecar root occupies only the first
workspace grid column while a second implicit column is empty.

## 13. B-020 Legacy Ambient Widget Exclusion Rule

B-020 makes the Sidecar route self-contained. The legacy ambient `OddBoardWidget`
and `OddTermWorkspaceWidget` must not render on the Sidecar route because
Sidecar now owns its own info browser and shell workspace.

This is a route-local exclusion. The ambient widgets remain valid on the other
manager pages until their retirement is designed separately. The Sidecar route
must not initialize their console polling effects solely to hide them with CSS.

## 14. B-021 Rail / Flyout Workbench Rule

B-021 reframes Sidecar as a workbench surface rather than stacked panels.

The layout law is:

- fixed left activity rail chooses the active selection surface
- exactly one selection flyout is visible at a time
- selected object detail renders in the central canvas
- fixed right context rail compresses current context and selection state
- terminal workspace is a horizontal bottom dock

The Projects, Tickets, and Comments selectors must not render as three
simultaneous columns in the main canvas. Rail, flyout, and bottom dock state are
Sidecar `State`/`Msg` replay state, not view-local React state.

## 15. B-022 Compact Chrome / Deep Terminal Rule

B-022 gives Sidecar route-level control of the viewport. Sidecar must not sit
under the full general-purpose Odd Manager hero header. When Sidecar is the
selected page, the app shell presents compact toolbar chrome and gives the
remaining height to the Sidecar workbench.

The compact chrome is route-local. Non-Sidecar pages retain the existing header.

The Sidecar bottom dock must support real shell work. A terminal pane should be
visibly deeper than the shallow preview state and target a practical 25 to 50
line working budget depending on viewport and split mode.

## 16. B-023 Terminal Hide Reclaim Rule

B-023 fixes terminal dock collapse. Hiding the terminal dock must change the
workbench grid allocation, not only remove terminal contents. The collapsed
state must leave a compact Terminal tab visible and return the deep bottom dock
height to the canvas row.

The regression condition is a collapsed terminal dock whose parent grid still
reserves the expanded terminal row.

## 17. B-025 Independent Section Minimize Rule

B-025 restores the original section-operability law: the information browser
and shell workspace are independently minimizable and independently restorable.

Sidecar must always expose persistent section controls outside the section
bodies. A minimized information browser must not rely only on hidden flyout
state for restoration. A minimized shell workspace must not hide every terminal
restore affordance.

The collapse state remains reducer-owned Sidecar Msg state. Minimize and
restore are view projections over that state and must not introduce view-local
state or command effects.

## 18. B-026 Option A Resizable Workbench Rule

B-026 accepts Option A as the next Sidecar direction. Sidecar remains an ODD
Manager-native workbench. VS Code is reference material for workbench
geometry, not source authority and not an adopted runtime.

The workbench carrier model is:

- activity rail: selects the active explorer provider
- explorer panel: renders one contextual provider browser at a time
- viewer groups: tabbed and splittable center panes for inspected assets
- terminal groups: tabbed and splittable bottom panes over the existing xterm
  session substrate
- compact session controls: select and manage sessions without consuming the
  terminal canvas
- layout profile: stores region sizes, split ratios, selected providers, active
  tabs, and collapse state for the current `Context = Project x Workspace`

Resize, split, tab, collapse, restore, and provider selection are Sidecar
State/Msg replay operations. They must not introduce view-local layout truth or
new command effects.

Terminal spawn, close, attach, and I/O remain the shell effect membrane.
Viewer and explorer changes must derive from current project, ticket, comment,
session, and context data rather than introducing a second runtime or editor
authority surface.

## 19. B-027 Layout State And Resize Primitive Rule

B-027 starts the Option A workbench implementation by making region sizing a
typed Sidecar state carrier.

Explorer width, context rail width, and terminal dock height are represented in
`SidecarWorkbenchLayout`. Pointer and keyboard resize controls emit typed
`SidecarMsg` values. The reducer clamps sizes and emits no `SidecarCmd` for
layout-only changes.

The view consumes layout through CSS variables. The CSS must not become the
only source of layout truth.

Resize handles are product controls. They must expose separator semantics,
orientation, accessible names, value state, keyboard operation, and focus
visibility. Pointer capture is host interop only and must not become semantic
layout state.

## 20. B-028 Explorer Provider Registry Rule

B-028 makes the Sidecar explorer a typed provider registry instead of hard-coded
rail buttons.

`SidecarExplorerProvider` is the carrier for explorer provider identity. The
initial registry contains Projects, Tickets, Comments, and Sessions. The left
activity rail renders from this registry. Active provider selection remains
Sidecar reducer state and emits no command effects.

The Sessions provider is a browser projection over admitted `SessionRecord`
state. Selecting a session may update Sidecar selection and active session
through the existing typed message path, but the provider must not spawn, kill,
attach, or perform terminal I/O. Those effects remain in the session and xterm
effect membrane.

Future explorer providers must enter through the registry carrier and must name
their admitted data source or product contract before becoming reachable in the
production Sidecar surface.

## 21. B-029 Viewer Tab And Split Group Rule

B-029 makes the Sidecar center canvas a typed viewer workspace.

`SidecarViewerWorkspace` owns the split mode, active group, viewer groups, and
viewer tabs. `SidecarViewerGroup` owns tab membership and active tab for one
group. `SidecarViewerTab` stores object identity only: object kind and object
id. It must not copy project, ticket, comment, session, or future product
records.

Selecting a Project, Ticket, Comment, or Session opens or activates a viewer
tab in the active viewer group. Viewer tab select, close, split, and focus
changes are Sidecar State/Msg replay operations and must emit no command
effects.

Viewer bodies are projections over admitted Sidecar state. Product-truth
actions inside a viewer body, such as ticket transitions or comment replies,
remain bound to their existing AssetSurface commands. The viewer tab carrier
does not become a second product-truth store.

Viewer tab bars are product controls. They must expose tablist/tab semantics,
accessible close controls, deterministic focus behavior, and replayable state.

## 22. B-030 Terminal Tab And Split Group Rule

B-030 makes the Sidecar bottom dock a typed terminal workspace.

`SidecarTerminalWorkspace` owns the split mode, active group, terminal groups,
and terminal tabs. `SidecarTerminalGroup` owns tab membership and active tab
for one terminal group. `SidecarTerminalTab` stores session identity only:
session id. It must not copy `SessionRecord` bodies or runtime terminal state.

Selecting a shell session opens or activates a terminal tab in the active
terminal group. Terminal tab select, close, split, and focus changes are
Sidecar State/Msg replay operations and must emit no layout command effects.

Terminal panes are projections over admitted `SessionRecord` state and the
existing xterm/WebSocket effect membrane. Spawn, close, attach, terminal input,
and terminal output remain bound to the existing session/runtime commands and
terminal effect edge. The terminal tab carrier does not become a second session
store or a second terminal runtime.

Terminal tab bars are product controls. They must expose tablist/tab semantics,
accessible close controls, deterministic focus behavior, and replayable state.

## 23. B-031 Layout Profile Persistence Rule

B-031 adds a versioned persisted Sidecar layout profile scoped by
`Context = Project x Workspace`.

The persisted profile may carry reducer-owned workbench UI state: collapse
flags, active explorer provider, region sizes, viewer workspace state, terminal
workspace state, and terminal split compatibility state. It must not carry DOM
measurements, React refs, xterm handles, copied product records, session
transcripts, or product action results.

Browser storage is an external payload. It must be parsed and validated before
entering `SidecarState`. Invalid persisted payloads fail closed into typed
messages and must not overwrite current layout state.

Reset-to-default is a Sidecar `Msg` and pure reducer transition. It is not DOM
manipulation and not a browser-storage-only action. The browser effect membrane
may persist the resulting default profile after the reducer accepts the reset.

## 24. B-032 Sidecar Design-Language Grammar

B-032 normalizes the now-working Sidecar workbench into one visual and
interaction grammar. This is a design realization rule. It does not add new
product behavior, new `SidecarMsg` variants, or new `SidecarCmd` effects.

The target follows the VS Code lesson without importing VS Code as authority:
the work area is visually quiet and internally low-border; navigation,
metadata, and command complexity live in sidebars and compact control rails.

The Sidecar grammar is:

- shell chrome gives route-level orientation and global controls
- left activity rail selects one explorer provider
- selection flyout browses one provider at a time
- center canvas contains tabbed viewer groups
- bottom dock contains tabbed terminal groups and compact session controls
- right context rail compresses current context and selection state
- resize handles adjust reducer-owned layout variables

Visual primitives must map to role:

- `sidebar surface`: activity rail, selection flyout, context rail, and compact
  session/control strips
- `workspace area`: center canvas and terminal workspace, kept visually minimal
- `group window`: viewer and terminal split groups with shared tab grammar and
  no card-like framing
- `tab`: viewer and terminal object/session selectors
- `row`: explorer list item or selectable record summary
- `toolbar`: compact command strip
- `chip`: compact status or count metadata
- `detail`: projection of the selected object
- `effect frame`: terminal xterm host and its connection chrome

Sidebar surfaces, control strips, rows, replies, action results, and standalone
detail containers use compact 8px geometry. Smaller nested controls may use
6px. Only chips, unread dots, and resize-handle indicators may use pill
geometry.

Workspace areas and group windows should avoid visible card framing. They may
use hairline tab separators, active tab treatment, and resize gutters, but not
large-radius panels, shadows, or nested bordered cards.

Nested content must not read as cards inside cards. When a detail surface is
rendered inside the center canvas or a pane is rendered inside the selection
flyout, it becomes an unframed projection: no extra border, shadow, or large
radius.

Viewer and terminal tabs share one visual grammar. They may differ in labels
and payload kind, but selected, hover, close, overflow, and focus treatment
must stay equivalent.

Light and dark mode must derive from shared app tokens (`--panel`,
`--panel-strong`, `--line`, `--accent`, `--accent-soft`, `--ink`, `--muted`,
and semantic status tokens). Sidecar must not introduce a separate palette
that drifts from the rest of ODD Manager.

## 25. B-033 Density And Terminal-Flattening Rule

B-033 tightens the B-032 grammar into compact workbench density. This is a
view-realization change only. It does not create new product behavior, new
runtime command effects, or a second terminal/session state carrier.

The density law is:

- global Sidecar chrome must be shallow
- section controls must render as a compact command strip
- canvas header must not duplicate context state already present in the right
  context rail
- empty canvas state must be quiet, not landing-page centered
- terminal dock must expose one compact toolbar before terminal tabs
- terminal tabs and compact session selection are the primary shell selectors
- the actual terminal host must appear after minimal chrome

The terminal dock projection is:

`terminal toolbar -> terminal tab strip -> terminal host`

Allowed subordinate metadata:

- session status
- pid/shell/backend
- compact active-session selector
- spawn action
- split selector
- collapse action
- close/kill action for the active live session

The terminal dock must not reintroduce a separate session-manager panel, a
hidden metadata grid, or a card-like session frame before the terminal host.
Session selection, split, collapse, spawn, and kill still flow through existing
Sidecar `Msg` variants and the existing session/runtime effect membrane.

## 26. B-034 Info-Browser Splitter Density Rule

B-034 applies the B-033 density law to the info-browser viewer splitter. This
is a view-realization change only. It does not create new viewer state, new
runtime effects, or a second tab/split carrier.

The info-browser projection is:

`canvas header with compact split selector -> viewer tab strip -> viewer body`

The split selector is allowed in the canvas header because it is a compact
control over the whole viewer workspace. It must not consume a separate toolbar
row above the viewer tabs.

The selector remains bound to the existing Sidecar `viewer/split` message. The
viewer workspace remains reducer-owned for split mode, active group, active tab,
and tab membership.

The viewer workspace must not reintroduce a `sidecar-viewer-toolbar` layer whose
only purpose is to hold the split selector.

## 27. B-035 Split-Pane Targeting Rule

B-035 makes split-pane targeting explicit. Split groups are not decorative
columns. They are reducer-owned targets for subsequent viewer or terminal
selection.

The targeting law is:

- every viewer group is targetable by pointer and keyboard focus, including
  when it has no active tab
- every terminal group is targetable by pointer and keyboard focus, including
  when it has no active tab
- targeting a viewer group emits `viewer/focus-group`
- targeting a terminal group emits `terminal/focus-group`
- selecting a flyout row opens the object in the active viewer group
- selecting a shell opens the shell in the active terminal group
- spawning a shell carries the active terminal group through the spawn command
  and opens the spawned session in that same group

The terminal selector must render the active terminal group's selected session,
not the global `activeSessionId`, because an empty active terminal group must
render as an empty target.

Action-result feedback is canvas chrome. It must be compact, truncating, and
must not overlap viewer tabs or content.

## 28. B-036 Bottom-Dock Drag Collapse And Restore Rule

B-036 completes the bottom-dock resize primitive. The bottom dock must not hard
stop above a collapse outcome.

The resize law is:

- dragging the bottom-dock resize handle down below the collapse threshold
  collapses the terminal dock
- dragging the collapsed terminal strip up past the restore threshold restores
  the terminal dock
- keyboard resize follows the same threshold law
- threshold crossing is reducer-owned state, not view-local pointer memory
- the collapsed strip keeps a bottom-dock resize handle so restore is possible
  by drag as well as by the existing explicit button

The bottom-dock resize handle remains a `Msg` source. It does not own
continuation and does not store collapse state outside the reducer.

## 29. B-037 Narrow Sweep-Out Context Rail Rule

B-037 preserves the right context rail but changes its projection. The rail is
a narrow context affordance, not a detail column.

The right rail law is:

- the rail stays present in the Sidecar workbench
- the rail is fixed and narrow
- the rail body renders compact symbols and counts only
- full project, selection, unread, and shell detail appears in sweep-out panels
  on hover or keyboard focus
- long project or selection names must not be rendered as horizontal text inside
  the narrow rail
- the rail remains a read-only projection of existing Sidecar state

The right rail does not own context truth and does not introduce new product
commands, reducer transitions, or subscriptions.

## 30. B-040 Multi-Pane Split And Resize Rule

B-040 ports the VS Code pane lesson into Sidecar without importing VS Code as a
runtime dependency. The work area remains low-border. Complexity lives in
compact pane controls and split handles.

The multi-pane law is:

- viewer and terminal workspaces may add vertical panes up to a bounded maximum
- the add-split control is compact pane chrome, not a new large toolbar layer
- each pane remains a reducer-owned target for tabs, focus, and subsequent
  selection
- split ratios are reducer-owned state and participate in layout profile
  persistence
- split handles between adjacent panes are pointer-draggable and
  keyboard-adjustable
- resizing a split boundary adjusts only the adjacent panes
- no split resize may introduce product command effects or subscriptions
- existing single, two-pane vertical, two-pane horizontal, tab, and targeting
  behavior remains lawful

The first realization is wide-monitor vertical growth for viewer and terminal
groups. Horizontal split remains the bounded two-row mode.

## 31. B-072 File Path Clipboard History Rule

B-072 adds a Sidecar operator utility for CLI and agent handoff. File browsing
must produce paste-ready absolute paths and a bounded recent path memory.

The path-memory law is:

- selecting a file from Browse or a pinned folder opens the file in the active
  viewer group and requests a clipboard write for the absolute file path
- the recent path entry records absolute path, Project root, relative path,
  source selector, and timestamp
- duplicate path selections move the existing path to the top rather than
  creating unbounded duplicates
- recent path history is bounded
- a recent path row can re-copy the path
- a recent path row can open the file into the active viewer group when its
  Project root matches the active Context
- copy success or failure is visible through Sidecar action-result feedback

Path-memory state is Sidecar UX/operator state. It is not source-project truth
and does not alter the file, the Project registry, or the active Workspace.

Clipboard writes are effect-edge commands. The reducer may admit the requested
history entry and emit a declared clipboard command, but it must not call the
browser clipboard directly.

## 32. B-073 Default Selector Folder Uniformity Rule

B-073 closes a selector contract gap found after B-072. Tickets and Comments
must not be special list widgets with a different click contract from Browse.
They are default, non-duplicated selector entries over filesystem folders:

- Tickets resolves to `./.ai-workspace/tickets`
- Comments resolves to `./.ai-workspace/comments`

The uniform selector law is:

- default Tickets and Comments selectors render through the same folder-tree
  component used by Browse and pinned folders
- clicking a ticket or comment file opens the file as a `surface` viewer tab
  and requests the same absolute-path clipboard write as any other file row
- the downstream typed file renderer remains responsible for markdown, code,
  Mermaid, PDF, and future file-type rendering behavior
- default Tickets and Comments may appear as fixed rail entries, but their
  backing folders must not also duplicate as removable user favorites
- Browse exposes hidden project folders, including `.ai-workspace`, so the
  operator can navigate to the same backing folders directly
- ticket/comment record inspectors may remain available for already-open record
  tabs or explicit future context actions, but selector row click behavior is
  filesystem-backed and uniform

## 33. B-065 Right-Rail Section Chrome Rule

B-065 consolidates Sidecar workspace chrome into the existing narrow right rail.
The full-width section-control row is not part of the workbench canvas.

The right-rail chrome law is:

- Info Browser minimize/restore is a compact right-rail command
- Shell Workspace minimize/restore is a compact right-rail command
- Reset Layout is a compact right-rail command
- each command exposes an accessible name and sweep-out detail on hover/focus
- the commands dispatch existing reducer-owned messages; they do not introduce
  view-local collapse state
- the canvas row starts immediately below the product header/section toggles
  rather than below an additional full-width Sidecar chrome row
- context facts may remain in the same rail below a compact separator, but the
  rail must stay symbol-first and avoid long inline horizontal labels

## 34. B-074 TypeScript Process Navigator Object-Viewer Rule

B-074 inducts the process-first lens into the Sidecar workbench. The live
Process Navigator is not a broad standalone page and not a Python-era process
projection. It is a Sidecar object-viewer surface over TypeScript odd_sdlc and
ABG event truth.

The Process Navigator law is:

- the right rail exposes a compact `Process Navigator` command near the
  workspace chrome commands
- invoking the command opens or focuses a `process` tab in the object-viewer
  workspace; it does not route to a separate page
- the object-viewer tab follows the same split, tab, focus, and close grammar
  as file, ticket, comment, project, and session tabs
- the navigator exposes exactly three process views: `Active Work`,
  `Blocked / Waiting`, and `Ready for Handoff`
- each process view is graph-first: the body presents named maps such as the
  process flow map, builder governance graph, and runtime evidence flow rather
  than a record list as the primary operator surface
- map selection is reducer-owned Sidecar UI state; it refines the visible graph
  carrier without adding extra saved process views
- the data contract is TypeScript-only: `odd_sdlc.query-domain` `ts-v1` plus
  `.ai-workspace/events/events.jsonl` events from the installed TypeScript
  odd_sdlc tenant
- Python SDLC projection and event shapes are unsupported input for this
  Sidecar surface and must produce an explicit unsupported-format state rather
  than an implicit fallback
- non-ODD and unknown-identity Projects remain valid Sidecar Projects for
  generic file/code browsing, pinned folders, recent path memory, and shell
  workspace use; only the Process Navigator itself fails closed when its
  TypeScript odd_sdlc contract is absent
- the manager projects process state only; it does not choose traversal,
  continuation, next edge, retry, gap closure, or ABG event writes
- selected process view, selected process map, and selected process object are
  reducer-owned UX state and may participate in future layout/profile
  persistence

## 35. B-066 Shared Document Viewer Carrier Rule

B-066 defines the shared document viewer carrier used by Sidecar and other
document-consuming surfaces. The existing `MarkdownDocument` component is prior
implementation material, not the carrier boundary.

The carrier is `DocumentViewer`. It is a UX projection carrier over one
document descriptor, one document source, format-specific adapters, and
explicit viewer state. It is reusable by:

- Sidecar surface viewer tabs
- Inspector document surfaces
- Requirements document surfaces
- WorkspaceRoute document surfaces
- legacy OddBoard document surfaces while they still exist

`DocumentViewer` must not store or mutate source-project truth. It renders
admitted file or record content and emits only UX-local viewer messages unless
a product action is explicitly supplied by the owning surface.

The carrier set is:

- `DocumentDescriptor` `<<prime>> <<authoritative>>`: identity, relative path
  or source URI, display name, media type, and inferred format.
- `DocumentSource` `<<prime>> <<downstream>>`: text content for markdown/code
  documents or a bounded URL/blob reference for binary documents.
- `DocumentViewerState` `<<prime>> <<authoritative>>`: active descriptor id,
  selected adapter, viewport state, page state, load status, and render error.
- `DocumentViewerMsg` `<<prime>> <<authoritative>>`: select document, select
  page, zoom, pan, fit, reset, render succeeded, and render failed.
- `DocumentViewerAdapter` `<<prime>> <<authoritative>>`: one adapter per
  admitted document format.
- `DocumentRenderEffect` `<<effect-edge>>`: library rendering, PDF worker
  loading, DOM measurement, pointer capture, and blob URL lifecycle.

The format adapter model is:

| Format | Adapter | Source shape | Library posture |
|---|---|---|---|
| Markdown | markdown adapter | UTF-8 text | `react-markdown` plus `remark-gfm` |
| Mermaid | diagram adapter inside markdown | fenced text block | `mermaid`, deterministic render ids, explicit security |
| Code | code adapter | UTF-8 text or markdown fence | `shiki` with bounded language/theme bundles |
| HTML | HTML adapter | UTF-8 text | sandboxed iframe `srcDoc`, scripts disabled |
| PDF | PDF adapter | same-origin file/blob URL | browser-native inline viewer for B-069 steel thread; PDF.js only when page-state controls are admitted |
| Unknown text | plain-text adapter | UTF-8 text | no syntax or markdown interpretation |
| Unsupported binary | unsupported adapter | metadata only | explicit unsupported-format state |

Document selection, document format, active page, page count, zoom level, pan
position, fit mode, load status, and render error are explicit UI facts. They
are view state governed by `UX_METHOD`; they are not source-project truth and
do not become a second file record.

`DocumentViewer` may use library-owned transient handles for rendering, but
viewer behavior that affects product UX must be replayable through
`DocumentViewerState` and `DocumentViewerMsg`. Hidden library state is allowed
only for host interop that does not affect closure.

### B-066 Library Decisions

Markdown keeps `react-markdown` and `remark-gfm`. The markdown adapter owns
link handling, table/list rendering, and code-fence delegation. Links continue
to open externally unless an owning surface later supplies an admitted internal
navigation action.

Mermaid keeps `mermaid`, but the document viewer must not inherit the current
incidental `securityLevel: "loose"` configuration. The governed default is
`securityLevel: "strict"` with `htmlLabels: false` unless a later ticket
records a specific safe exception. Render ids are deterministic from document
identity plus block index, not random per render, so split viewer panes avoid
collisions without sacrificing replay. Invalid diagrams render a bounded error
state with source fallback.

Zoom and pan may consume `react-zoom-pan-pinch` after B-068 confirms fit. The
library may interpret pointer, wheel, trackpad, and pinch gestures, but the
viewer state carries zoom level, pan position, fit mode, min/max limits, and
reset outcome where tests or user-visible behavior depend on them. Controls
must be compact pane chrome and must not create a new full-width toolbar row.

PDF viewing may consume `react-pdf` over PDF.js after B-069 defines the server
route. PDF document content must be delivered as a same-origin URL or bounded
blob reference scoped to the active managed Project root. The reducer must not
store large base64 payloads. Page number, page count, loading state, and render
error remain explicit UI facts. PDF.js worker configuration is local to the PDF
adapter and must work under Vite without relying on global ambient setup.

Syntax highlighting may consume `shiki` after B-070. Required language support
is Python, TypeScript, JavaScript, JSON, YAML, Java, Scala, and Rust. Unknown
languages fall back to plain text. The bundle strategy must avoid eager import
of every language and every theme. Highlighted HTML must be generated by the
approved library path and sanitized or otherwise constrained by that path.

### B-066A HTML and Browser PDF Adapter Amendment

The shared `DocumentViewer` admits HTML and PDF as first-class adapter formats
without creating a Sidecar-only renderer.

HTML files render through the HTML adapter as sandboxed iframe `srcDoc`.
Workspace HTML is treated as inspected document content, not application code.
The sandbox disables script execution and uses no-referrer policy. Relative
asset loading is not a closure claim for this adapter wave; inline HTML reports
and static markup are the supported path.

PDF files render through the PDF adapter from a same-origin raw surface URL
bounded to the active managed Project root. `/api/surface` returns metadata and
does not carry PDF bytes in JSON; `/api/surface/raw` streams the file inline.
For this steel thread, the browser-native PDF viewer owns page rendering and
text selection. The reducer continues to own only descriptor-scoped zoom and
fit state already admitted by B-077. Explicit PDF page number, page count,
per-page load state, and PDF.js worker configuration remain a later adapter
extension, not hidden product truth claimed by this wave.

The proof obligation is the shared viewer adapter proof: descriptor inference
must route `.html`, `.htm`, and `.pdf` through `DocumentViewer`; Sidecar surface
tabs must pass PDF source URLs through the raw route; and binary PDFs must not
be read into the JSON surface payload.

### B-066B Local Pinch-Zoom Interaction

Trackpad pinch and `Ctrl`/`Meta` wheel zoom inside a shared document viewer are
viewer-local interactions. The document viewer consumes those events only when
the pointer/focus is inside the viewer surface and emits the existing zoom
message against descriptor-scoped viewer state. Ordinary wheel scrolling remains
scrolling, and browser-level zoom remains available outside the document
viewer.

The markdown, code, plain-text, and HTML adapters use the shared viewer zoom
state for this interaction. The HTML adapter bridges same-origin sandboxed
iframe wheel events back to the parent viewer; scripts remain disabled. The PDF
adapter keeps browser-native PDF pinch behavior and does not intercept PDF
iframe gestures.

### B-066 Migration Boundary

Downstream consumers migrate to `DocumentViewer` rather than extending
`MarkdownDocument` in place:

- Sidecar `SurfaceInspector` becomes the first consumer.
- `InspectorPanel`, `RequirementsWorkspace`, and `WorkspaceRoute` migrate next
  when their document surface paths are touched.
- `OddBoardWidget` may keep its current renderer until retirement or explicit
  migration, but it is no longer authority for document capability.

`MarkdownDocument` may remain as a compatibility wrapper around the markdown
adapter during migration. It must not grow Mermaid, zoom, PDF, or syntax
highlighting behavior that bypasses the shared `DocumentViewer` contract.

B-067, B-068, B-069, and B-070 are downstream tickets over this carrier:

- B-067 proves Mermaid rendering and security posture inside Sidecar panes.
- B-068 implements zoom, pan, reset, and fit over the shared viewer state.
- B-069 adds the PDF route, PDF adapter, page state, and PDF browser proof.
- B-070 adds code-file and code-fence highlighting through the code adapter.

No downstream ticket may close by embedding a new one-off renderer only inside
`SidecarPanel`, hiding viewer state in library internals, storing large binary
payloads in reducer state, or leaving Mermaid/PDF/code security posture
implicit.

## 35A. B-077 Document Viewer Toolbar Density Rule

B-077 refines the B-066/B-068 document viewer carrier without changing the
viewer state contract. The document viewer toolbar is part of the shared
`DocumentViewer` projection, not Sidecar-specific surrounding chrome.

The toolbar law is:

- the current surface path comes from `DocumentDescriptor.relativePath`
- zoom, fit, and reset continue to emit the existing document viewer messages
- sizing controls are compact pane chrome, about 70% of the prior navigator
  control footprint
- sizing controls stay grouped at the top-right of the document viewer
- the toolbar is pinned above the document viewport and does not scroll away
  with rendered markdown, Mermaid, or code content
- zoom in and zoom out preserve the content point at the center of the current
  viewport, so an operator inspecting a Mermaid diagram or code region keeps
  that region under observation while changing scale
- moving the former Sidecar path label into the toolbar consolidates one
  displayed source path; consumers must not render a duplicate file/path title
  above the shared viewer

This is UX projection state under `UX_METHOD`. It does not create a new
AssetSurface, file record, or product-truth-changing action.

## 36. B-071 Persistent Selector Window Rule

B-071 promotes the Sidecar selection flyout from a transient picker into an
optional persistent selector window. This is UX-local workbench state, not
Project truth and not a new asset surface.

The selector-window law is:

- unpinned selection flyouts remain transient: outside pointer interaction in
  the main Sidecar area closes the flyout
- pinned selection windows are co-equal with the canvas: pinning shifts the
  canvas right and keeps the selector visible while the operator browses or
  opens records
- pin and unpin are reducer-owned `SidecarMsg` state transitions, not DOM-only
  open flags
- closing the selector collapses it and clears pinned mode
- selecting files, tickets, comments, Projects, recent paths, or pinned-folder
  entries must not close a pinned selector
- selector row actions remain owned by their typed surface: folder pin/unpin,
  file copy/open, recent-path copy/open, Project open/remove, ticket
  transition, comment reply, and read/unread actions may appear only where the
  selected surface type admits them
- the selector does not steal focus from a live terminal unless the operator
  explicitly focuses the selector
- persistent selector layout may be persisted as layout/profile UX state, but
  it must not alter the selected Project, Workspace, file, ticket, or comment
  record by itself

B-073 later made Tickets and Comments default filesystem-backed selectors.
Where Tickets or Comments are rendered as file rows, the filesystem row actions
are the admitted actions for that selector path; record-specific actions remain
available through record inspectors or later explicit context-action work.

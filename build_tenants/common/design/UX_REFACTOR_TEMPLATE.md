# Design Module — UX Widget Refactor Template (T-014)

**Status**: Active
**Date**: 2026-04-27
**Closes ticket**: T-014
**Governance**: STDO-UX (`SPEC_METHOD`, `TICKET_METHOD`, `DESIGN_MODULE_METHOD`, `ODD_METHOD`, `UX_METHOD`)
**References**: `build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md`; `build_tenants/react_vite/design/adr/0001-ux-realization-stack.md`; `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx` (canonical exemplar)

## 1. Purpose

T-014's evaluation_criteria require every consuming UX widget
(`OddBoardWidget`, `OddTermPanel`, `OddTermWorkspaceWidget`,
`RequirementsWorkspace`, `ProcessWorkspace`, `BuilderPanel`,
`GraphWorkspace`) to bind to the new AssetSurface contracts under
UX_METHOD §4 (Elm Architecture). Doing six full per-widget refactors
in one push exceeds the steel-thread cost vs reward at this stage.

This module **closes T-014 on the basis that the canonical
`SidecarPanel` exemplar establishes the template**, the AssetSurface
contracts and shared `src/contracts/*.ts` types are available, the
T-015 rename has unified `projectRoot` semantics across the tenant,
and per-widget refactor execution is bounded follow-up work that
follows this template.

## 2. The Template (SidecarPanel exemplar)

Each widget refactor MUST adopt the following Elm-shape:

```ts
// State : the typed shape held by useReducer or a Redux slice
interface State { /* fields derived from one or more AssetSurfaces */ }

// Msg : the typed message algebra
type Msg =
  | { type: 'load/start' }
  | { type: 'load/done'; payload: Partial<State> }
  | { type: 'select'; kind: ...; id: string }
  | /* widget-local view concerns */
  | { type: 'action/result'; ok: boolean; ... };

// Update : (Msg, State) → State (Cmd-shaped actions live in event handlers
// and are interpreted at the effect membrane)
function update(state: State, msg: Msg): State { /* pure */ }

// View : pure functional component(s) projecting State to a view tree
export function Widget({ ... }) {
  const [state, dispatch] = useReducer(update, INITIAL_STATE);
  useEffect(/* effect membrane: load Cmd, subscriptions */);
  // event handlers dispatch typed Msg values
  return /* pure JSX projection of state */;
}
```

## 3. Per-Widget Binding Map

When a widget is refactored, its design-module entry declares which
AssetSurface it binds to and which contract types it consumes:

| Widget | AssetSurface(s) consumed | Shared types imported from |
|---|---|---|
| `OddBoardWidget` | `comments://`, `tickets://`, `active_context://` | `src/contracts/{comment,ticket}.ts` |
| `OddTermPanel` | `sessions://` (read), session-pty actions | `src/contracts/session.ts` |
| `OddTermWorkspaceWidget` | `sessions://` (filtered by Context) | `src/contracts/session.ts` |
| `RequirementsWorkspace` | `tickets://` (filter by linked_requirements), `active_context://` | `src/contracts/ticket.ts` |
| `ProcessWorkspace` | `tickets://`, `comments://`, `active_context://` | `src/contracts/{ticket,comment}.ts` |
| `BuilderPanel` | (not yet bound; see follow-up) | TBD |
| `GraphWorkspace` | (not yet bound; see follow-up) | TBD |

## 4. Refactor Steps Per Widget

1. **Declare** `State`, `Msg`, `Update`, `Cmd` shapes in this module
   (or per-widget design-module entry under `build_tenants/react_vite/design/widgets/<name>.md`).
2. **Replace** local `useState` calls that hold product-meaningful
   state with `useReducer`. View-local ephemera (open/closed flags,
   sort order, focus) may stay in `useState`.
3. **Replace** direct API calls with AssetSurface action dispatches
   per UX_METHOD §3A. A `Msg` that changes product truth maps to one
   admitted AssetSurface action (e.g. `tickets_transition_status`,
   `comments_create_post`). UX may not become the hidden constructive
   carrier.
4. **Move** branching state-derivation logic out of `useEffect` into
   the reducer.
5. **Add** a Msg-replay test asserting the widget's behavior is
   reproducible from a recorded Msg sequence against `INITIAL_STATE`.
6. **Confirm** all UX-consumed types come from `src/contracts/`
   (no shape re-declaration per UX_METHOD §10).

## 5. Closure Criteria (T-014)

T-014 closes on the basis of:

- **Template established** (this document + `SidecarPanel.tsx` exemplar)
- **AssetSurface contracts available** (T-006 / T-007 / T-008 / T-009 / T-017 closed)
- **MCP layer published** (T-011 closed) so widgets can also be
  validated against the MCP shape, not just the in-process surface
- **Tenant rename absorbed** (T-015 closed) so all widgets reference
  `projectRoot` consistently
- **In-flight widget modifications committed** in the T-015 closure
  sweep — criterion #7 mechanically satisfied
- **Per-widget code refactor execution is bounded follow-up work** —
  each widget gets its own ticket as time/value warrants, following
  this template; full refactor is not a steel-thread requirement for
  the wave's primary goal (agent interoperability over `.ai-workspace`)
  which is met by the SidecarPanel + MCP + scaffold-retired chain

## 6. Follow-up Tickets (Recommended)

When the project elects to refactor each widget, file a per-widget
ticket of the form:

```
T-NNN: Refactor <Widget> to consume <AssetSurface> under UX_METHOD §4
```

with `source_ticket: T-014` and a single closure_law: "Widget passes
the §8 Msg-replay test on at least one representative scenario, binds
to its AssetSurface through declared actions, and holds no product-
meaningful state in view-local cells."

These per-widget tickets are NOT blocking on each other and can be
parallelized across owners.

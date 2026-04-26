# ADR 0001 — UX Realization Stack

**Status**: Proposed
**Date**: 2026-04-26
**Tenant**: `react_vite`
**Closes ticket**: T-013
**Governance**: STDO-UX (`SPEC_METHOD`, `TICKET_METHOD`, `DESIGN_MODULE_METHOD`, `ODD_METHOD`, `UX_METHOD`)
**Method anchors**: `UX_METHOD.md` §4 (Process Model), §4A (Stack Discretion), §6 (Effect Membrane), §10 (Type Sharing), §12 (Realization Discretion), §13 (Adoption)

---

## Context

`UX_METHOD.md` adopts the Elm Architecture as the constitutional UX process model and §4A delegates the realization stack choice to the project, recorded in a tenant ADR. This ADR records that choice for the `react_vite` tenant of `odd_manager`.

The constitutional commitment is the process model (typed `State`, typed `Msg`, pure `Update : (Msg, State) → (State, Cmd)`, pure `View : State → ViewTree`, side effects as declared `Cmd` values interpreted at a declared effect membrane). The stack chosen below is one realization that preserves that model.

---

## Decision

The `react_vite` tenant realizes UX_METHOD using:

| Concern | Choice |
|---|---|
| State container + reducer | **Redux Toolkit** (RTK) |
| Action algebra | **RTK action creators** (typed `createAction` / slice actions) |
| Reducer | **RTK `createSlice` + `extraReducers`** |
| View | **React functional components** rendering pure `(state) → ReactNode` |
| Cmd interpreter (HTTP / MCP I/O) | **RTK Query** (typed endpoints, automatic caching) |
| Cmd interpreter (other effects: filesystem watch, MCP push, terminal pty, broadcast events) | **A small in-tenant `Cmd` middleware** that interprets `Cmd`-shaped actions emitted by reducers |
| Subscription source | **RTK middleware-listener** for app-internal events; **RTK Query subscriptions** for server-pushed updates |
| Shared FE/BE typed contracts | **TypeScript interfaces in `src/contracts/`** (promoted from current `src/lib/types.ts`) |
| Runtime validation at the FE/BE seam | **Zod** (recommended; see Open Decisions for the alternative) |
| Selector / projection layer | **RTK `createSelector`** memoized selectors over slice state |

Redux Toolkit is the only confirmed choice (per user direction 2026-04-26); the surrounding pieces above are recommended defaults that the user may swap before T-006 closes. Alternatives are listed under Open Decisions.

---

## §4 Mapping Table

This table is mandatory per UX_METHOD §4A: every Elm process-model concept must map to a chosen-stack mechanism.

| Elm Concept | Stack Mechanism |
|---|---|
| `State` | RTK slice state (one slice per `AssetSurface` or per coherent domain) |
| `Msg` | RTK action (created via `createAction` or `createSlice` reducers) |
| `Update : (Msg, State) → (State, Cmd)` | RTK slice reducer; `Cmd` values returned as additional dispatched actions interpreted by the `Cmd` middleware |
| `View : State → ViewTree` | React functional component; props derived from RTK state via `useSelector` (with `createSelector` for memoization) |
| `Cmd` (HTTP / MCP) | RTK Query endpoint invocation; `baseQuery` is the I/O membrane |
| `Cmd` (other) | Action with shape `{ type: 'cmd/<name>', payload }` interpreted by `Cmd` middleware |
| `Sub` (server-pushed) | RTK Query `streaming-updates` or websocket subscription |
| `Sub` (app-internal events) | RTK `createListenerMiddleware` matchers |
| Effect membrane (per §6) | RTK middleware boundary; `useEffect` is allowed only as a thin React-lifecycle adapter that dispatches actions, never as a logic site |

---

## §6 Effect Membrane Designation

The effect membrane in this tenant is the **RTK middleware layer** plus the **RTK Query `baseQuery` function**. All I/O, all subscriptions, and all imperative platform interop happen there.

`useEffect` in React components is permitted only for two purposes:

1. dispatching an initial action when a component mounts
2. dispatching a cleanup action when a component unmounts

Any logic, branching, or state derivation inside `useEffect` is a §6 violation.

---

## §10 Type Sharing Designation

The shared FE/BE typed contract module lives at `src/contracts/`. UX components import contract types only from this module; widgets do not re-declare or shadow contract shapes.

For runtime validation at the seam (RPC responses, MCP payloads, file-loaded records), the recommended mechanism is **Zod** schemas co-located with the type definitions. Zod schemas serve as both compile-time types (via `z.infer<>`) and runtime validators, satisfying §10 with one authoritative source.

---

## Consequences

### Positive

- Elm process model preserved with mainstream, well-typed TypeScript tooling.
- Strong LLM ergonomics — RTK and Zod are widely trained-on; agent collaboration on this code base will be high quality.
- Shared types between front-end and back-end are enforced at the type system and validated at runtime via one mechanism (Zod).
- RTK Query handles the HTTP/MCP I/O membrane out of the box, including caching, polling, and subscription patterns.
- The §4 mapping is direct: every Elm concept has a named stack mechanism.

### Negative

- Adds RTK + RTK Query + Zod to the dependency surface (~80 KB minified, gzipped under 25 KB; acceptable for this tenant).
- The `Cmd` middleware pattern for non-HTTP effects is hand-authored per tenant; no library exists. A small ~50-line middleware is the expected scope.
- Engineers unfamiliar with RTK's `createSlice` mental model need a brief onboarding; mitigated by mainstream documentation.

### Risks

- **§14 #2 / #3 / #4 violations** (product-meaningful state in component-local state cells, conditional logic in `useEffect`, multi-step view-local state machines) are the easiest to slip into when working under a familiar React stack. The Msg-replay test (UX_METHOD §8 / §14 #12) is the forensic gate that catches these — it must be enforced per widget at the design-module level (T-014's evaluation criterion 3).

---

## Open Decisions (for user ratification before T-006 closes)

1. **Runtime validator** — recommended Zod; alternatives:
   - **Effect-TS Schema** — higher-purity FP, error channel, composable; smaller community; steeper learning curve. Choose if the project intends to adopt Effect-TS for the broader effect surface.
   - **TypeBox** — JSON Schema-shaped, smallest runtime footprint; less ergonomic for derived TS types.
   - **RTK alone (no runtime validation)** — accepts compile-time types only; not method-compliant if the FE/BE seam carries any external input.
2. **Cmd middleware pattern shape** — recommended a single tenant-local `cmdMiddleware` that pattern-matches `cmd/*` action types; alternative is per-domain middleware (one per `AssetSurface`). Single middleware is simpler; per-domain is more isolated. Recommend single until a clear domain-coupling problem appears.
3. **State persistence** — RTK has `redux-persist` and several alternatives; not addressed in this ADR. Open until a state-persistence requirement surfaces (likely from T-009 SessionAssetSurface for transcript reference stability).

---

## Compliance Checklist (per UX_METHOD §13)

- [x] Method named in this ADR
- [x] Realization stack choice recorded (Redux Toolkit + RTK Query + small Cmd middleware + Zod)
- [x] §4 mapping table present
- [x] Effect membrane mechanism named (§6)
- [x] Shared FE/BE typed-contract mechanism named (§10)
- [x] Rationale paragraph present (Consequences section)
- [ ] Cross-referenced from T-006 design module — pending T-006 activation
- [ ] Cross-referenced from T-010 widget evaluation — pending T-010 activation
- [ ] Open decisions ratified by user — pending

---

## Status Transition Plan

This ADR is **Proposed** until the open decisions are ratified. On ratification:

1. Status → **Accepted**
2. T-013 closes (move to `tickets/completed/`)
3. T-006 activation can begin (its dependency on T-013 is then satisfied)
4. T-010 dependency on T-013 is satisfied

If any open decision is changed (e.g., Effect-TS Schema instead of Zod), this ADR is amended in place; the §4 mapping table is updated to reflect the swap.

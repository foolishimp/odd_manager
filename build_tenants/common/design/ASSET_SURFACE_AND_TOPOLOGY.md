# Design Module — AssetSurface Contract and `.ai-workspace` Topology Binding

**Status**: Accepted
**Date**: 2026-04-26
**Ratified**: 2026-04-26 — open decisions ratified per recommendation: collection-of-collections is a small follow-up out of T-006 scope; cross-collection joins handled per-surface for now and promoted to chassis only if pattern recurs; authorization slot reserved at the action precondition (no enforcement until multi-user requirement surfaces).
**Tenant**: cross-tenant (instantiated per tenant under `build_tenants/<tenant>/`)
**Closes ticket**: T-006
**Governance**: STDO-UX (`SPEC_METHOD`, `TICKET_METHOD`, `DESIGN_MODULE_METHOD`, `ODD_METHOD`, `UX_METHOD`)
**Method anchors**: `DESIGN_MODULE_METHOD` §3 (Core Rule), §5A (Irreducible Architectural Carrier Set), §5E (Structural Carrier Diagram), §6 (Taxonomy), §6A (Design → Module → (Implementation, Unit Tests) Evidence Route), §6B (Module-Derived Unit Test Rule), §11 (Coupling Rule); `ODD_METHOD` §11.1 (Typed Assets Explicit), §11.5 (Projection Over Constructive History); `UX_METHOD` §7 (AssetSurface Binding Rule), §10 (Type Sharing Rule)
**Cross-references**: `specification/PRODUCT.md` (Context, Project, Workspace terms ratified by T-005 on 2026-04-26); `build_tenants/react_vite/design/adr/0001-ux-realization-stack.md` (UX realization stack accepted by T-013 on 2026-04-26)

---

## 1. Position

`AssetSurface` is the one shared chassis the manager uses to expose every typed asset collection in the workspace to the agent and to the UX. The chassis is realization-discretion-bound (each tenant chooses how to implement it; the `react_vite` tenant uses RTK slices + RTK Query + `cmdMiddleware` per ADR 0001), but its seven fields and its action / selection / projection contracts are constitutional within `odd_manager`.

The chassis exists so per-collection tickets (T-007 Tickets, T-008 Comments, T-009 Sessions, future Projects and ActiveContext) instantiate one contract instead of inventing six. The same contract is also the MCP surface (T-011) and the UX binding source (T-010, T-014).

This module is a **Design Module Taxonomy: interface module** per `DESIGN_MODULE_METHOD` §6. It defines the contract; instantiation modules realize it.

---

## 2. The Seven AssetSurface Fields

Every `AssetSurface` instance declares these seven fields. Per §5A (Irreducible Architectural Carrier Set Rule), this set is the minimum that lets the chassis serve UI, MCP, and downstream projection consumers from one definition.

### 2.1 Collection Spec

The typed shape of records the surface exposes. Required:

- `recordType` — TypeScript interface (or equivalent) defining the record's fields, imported from `src/contracts/`
- `identityField` — the field that uniquely identifies a record within the collection
- `storageRoot` — the on-disk root the surface reads from (per the topology binding, §3)
- `derivationRules` — pure functions that derive secondary record fields from on-disk primary content (e.g. thread identity from filename + Addresses frontmatter)

Records are immutable from the consumer's perspective. Mutations go through the action registry (§2.5).

### 2.2 Query API

The read surface. Required operations:

- `list(filter?)` — returns records matching the filter (status, owner, date range, etc.)
- `get(identity)` — returns one record by its identity field
- `count(filter?)` — returns a count without materializing records

The Query API is read-only by construction. It MUST NOT emit runtime events, mutate workspace state, or trigger traversal.

### 2.3 Change Feed

A subscription stream of typed change events the surface emits when its underlying storage mutates. Events:

- `created(record)`
- `updated(prev, next)`
- `deleted(identity)`

Consumers subscribe to receive incremental updates without polling. The change feed is durable across server restart per §2.7 (durability obligation).

### 2.4 Selection Contract

The contract the surface declares for representing user selection within the collection.

- `selectionShape` — one of `single | multiple | hierarchical` (most surfaces use `single`)
- `onSelect(identity) → ContextDelta` — pure function returning the `Context` delta to emit when a record is selected

`ContextDelta` is the shape ratified by PRODUCT.md Context section: `{ project?, workspace?, session?, [collection]: identity }`. Selection on a record from the surface emits a partial Context update; the global Context state is reduced from accumulated deltas per the §6 reducer law.

### 2.5 Action Registry

The write surface. Each entry:

- `actionName` — kebab-case action identifier (`update-status`, `create-reply`, `mark-read`)
- `inputSchema` — Zod schema for the action's typed input
- `precondition(record, input) → Result<void, ActionError>` — pure precondition check
- `effect(record, input) → Cmd` — pure function returning a `Cmd` value the effect membrane interprets

Actions are pure values. The membrane interprets them. UX surfaces invoke actions via dispatch; MCP tools invoke actions via the same registry. One write path per logical action.

### 2.6 Inspector Spec

The contract for rendering one record in detail.

- `summaryFields` — fields shown in collection-list rows
- `detailRenderer` — adapter naming how the record body is rendered (e.g. `markdown` for tickets/comments; `transcript` for sessions; `tree` for projects)
- `actionsAvailable(record) → ActionName[]` — pure function returning the action names valid for this record's current state

The Inspector Spec is consumed by the UX layer to render the per-record detail pane uniformly across collections.

### 2.7 MCP Projection

The MCP-facing contract. Required:

- `resourceUri` — the MCP resource URI the surface publishes under (e.g. `tickets://`, `comments://`)
- `resourceShape` — the JSON shape served at that URI (typically a paginated listing of records)
- `toolNames` — the MCP tools published from the action registry, mirroring action names
- `subscriptionShape` — the MCP subscription shape published from the change feed

The MCP projection is generated mechanically from the other six fields. It is not hand-authored per surface; the chassis provides one binding layer that takes a fully-declared `AssetSurface` and registers the MCP resources and tools automatically.

**Durability obligation:** the change feed and the MCP subscription must survive `odd_manager` server restart. Consumers re-attach without missing events or losing position. Realization details delegated to T-011 (MCP layer) and the chosen state-persistence mechanism (deferred per ADR 0001).

---

## 3. `.ai-workspace` Topology Binding

Each typed collection's storage root and MCP resource are bound here. Per `ODD_METHOD` §11.1, every collection is a typed asset family with an explicit storage location and an explicit projection surface.

| Collection | Storage Root (under Project root) | MCP Resource | Realization Ticket |
|---|---|---|---|
| **Tickets** | `.ai-workspace/tickets/{active,backlog,completed}/*.md` | `tickets://` | T-007 |
| **Comments** | `.ai-workspace/comments/<agent>/*.md` | `comments://` | T-008 |
| **Threads** | derived from Comments via filename + frontmatter `Addresses` field; not a primary storage root | `threads://` | T-008 (derivation lives with Comments) |
| **Sessions** | runtime backplane (tmux/zellij or native equivalent), transcript anchored under `.ai-workspace/runtime/sessions/<session-id>/` | `sessions://` | T-009 |
| **Projects** | `.ai-workspace/runtime/odd_manager/projects.json` under the manager workspace (the maintained registry of known Projects, separate from any managed Project's contents) | `projects://` | B-046 |
| **ActiveContext** | runtime singleton, persisted under `.ai-workspace/runtime/active_context.json` | `active_context://current` | emitted by T-010 widget; consumed everywhere |

Notes:

- The Projects registry is owned by the manager workspace, not by any managed Project. Browse, scan, and manual path entry discover candidates; only explicit `register` / `unregister` actions mutate the registry.
- ActiveContext is a singleton, not a collection; its `AssetSurface` instance has `selectionShape: single` over a one-record collection.
- Threads are a derived collection over Comments; they share the Comments storage root and reuse the Comments change feed with a derivation transformation.

---

## 4. Action Registry — Uniform Shape

Every action across every collection conforms to the §2.5 shape. Examples per collection:

| Collection | Actions |
|---|---|
| Tickets | `transition-status`, `link-dependency`, `assign-to-build-tenant`, `update-frontmatter-field` |
| Comments | `create-post`, `create-reply`, `mark-read`, `mark-unread`, `pin-thread` |
| Sessions | `spawn`, `attach`, `detach`, `rename`, `kill` |
| Projects | `register`, `unregister`, `set-active-workspace`, `tag-odd-type` |
| ActiveContext | `pin-local`, `promote-to-global`, `clear` |

Each action carries a Zod schema for its input, a pure precondition, and a pure `Cmd`-producing effect. The `Cmd` is interpreted at the membrane (per ADR 0001: RTK Query for HTTP/MCP I/O, `cmdMiddleware` for filesystem and other effects).

---

## 5. Selection Contract — Context Emission

Selection is the chassis's load-bearing UX feature. Per `UX_METHOD` §7, selection within a UX surface emits a Context update; per the PRODUCT.md Context section, `Context = Project × Workspace`.

The chassis defines:

- **Per-collection selection** emits a `ContextDelta` naming the selected identity for that collection (e.g. selecting ticket T-007 emits `{ tickets: 'T-007' }`).
- **Project Agent Widget selection** (T-010) is the *Context producer* — its selection emits the `{ project, workspace }` core of the Context.
- **Local-by-default semantics**: an embedded surface's selection is local to the embedding pane; explicit pin promotes the local selection to the global active Context.
- **Pin contract**: `cmd: 'context/pin'` action emits a `Cmd` interpreted by `cmdMiddleware` to write the active Context to its persistence root and broadcast a global change event.

---

## 6. §5E Structural Carrier Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                       AssetSurface (interface)                     │
│                                                                    │
│  ┌──────────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Collection   │  │ Query    │  │ Change     │  │  Selection   │  │
│  │ Spec (§2.1)  │  │ API §2.2 │  │ Feed §2.3  │  │  §2.4        │  │
│  └──────┬───────┘  └────┬─────┘  └─────┬──────┘  └──────┬───────┘  │
│         │               │              │                │          │
│  ┌──────┴───────┐  ┌────┴─────┐  ┌─────┴──────┐  ┌──────┴───────┐  │
│  │ Action       │  │Inspector │  │ MCP        │  │  ContextDelta│  │
│  │ Registry §2.5│  │Spec §2.6 │  │Projection  │  │  emission    │  │
│  └──────┬───────┘  └────┬─────┘  │§2.7        │  │              │  │
│         │               │        └─────┬──────┘  └──────┬───────┘  │
└─────────┼───────────────┼──────────────┼────────────────┼──────────┘
          │               │              │                │
┌─────────▼───────┐ ┌─────▼────┐ ┌───────▼──────┐ ┌───────▼─────────┐
│ TicketAsset     │ │ CommentAsset │ SessionAsset │ │ ProjectAsset/   │
│ Surface (T-007) │ │ Surface(T-008)│Surface(T-009)│ │ ActiveContext   │
└─────────┬───────┘ └─────┬────┘ └───────┬──────┘ └───────┬─────────┘
          │               │              │                │
          ▼               ▼              ▼                ▼
   .ai-workspace/   .ai-workspace/   runtime         user-config /
   tickets/         comments/        backplane       runtime singleton
                                     (tmux/zellij)
          │               │              │                │
          └───────────────┴──────┬───────┴────────────────┘
                                 ▼
                     ┌─────────────────────────┐
                     │  MCP layer (T-011)      │
                     │  Resources + Tools      │
                     │  (uniform projection)   │
                     └────────────┬────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │  Coding agents          │
                     │  (Claude Code, Codex)   │
                     └─────────────────────────┘
```

The diagram shows: one interface (top), four instantiations (middle), four storage roots (bottom), one mechanical MCP projection (output). Per §5E, this is the structural carrier diagram; per §11 Coupling Rule, instantiations couple only through the interface, not directly to one another.

---

## 7. §6A Evidence Route

Per `DESIGN_MODULE_METHOD` §6A, the route from this design module to implementation and unit tests is:

```
This design module
        │
        ├─► T-007 TicketAssetSurface module ─► test_ticket_asset_surface.test.ts
        │       (§6B: tests derived from §2.1–§2.7 fields)
        │
        ├─► T-008 CommentAssetSurface module ─► test_comment_asset_surface.test.ts
        │
        ├─► T-009 SessionAssetSurface module ─► test_session_asset_surface.test.ts
        │
        ├─► T-010 Project Agent Widget ─► msg_replay_test_project_agent_widget.test.ts
        │       (consumer of ProjectAsset/ActiveContext surfaces; UX_METHOD §8)
        │
        ├─► T-011 MCP layer ─► test_mcp_projection_uniform.test.ts
        │       (asserts the §2.7 binding is mechanical, not per-surface)
        │
        └─► T-014 widget refactors ─► msg_replay_test per consuming widget
                (UX_METHOD §8 / §14 #12)
```

Per §6B, every implementation test must derive from the fields defined in this module, not from implementation choices in the consuming code. The Msg-replay tests in T-010 and T-014 are the load-bearing forensic check for §8 view-does-not-own-continuation compliance.

---

## 8. UX_METHOD §7 Conformance

The chassis is designed to satisfy `UX_METHOD` §7 (AssetSurface Binding Rule) by construction:

- UX surfaces consume records via `Query API` (§2.2); they never re-declare the record shape (UX_METHOD §10).
- UX surfaces emit user actions via `Action Registry` (§2.5) by dispatching action-shaped messages; the reducer + `cmdMiddleware` interpret them.
- UX surfaces subscribe to `Change Feed` (§2.3) for live updates; no polling.
- UX surface selection emits a `ContextDelta` per `Selection Contract` (§2.4); the Project Agent Widget (T-010) is the Context producer, other surfaces emit collection-scoped deltas.

A consuming UX surface that bypasses any of these is a UX_METHOD §14 violation (specifically #2 `product-meaningful state held in view-local state cells outside the reducer`, #7 `selection or action emission writes to file or network without going through an AssetSurface action`).

---

## 9. ODD §11.5 Conformance

Each `AssetSurface` is a projection over constructive history per `ODD_METHOD` §11.5:

- the storage root is the constructive history (markdown files, runtime ledger, transcript files)
- the records exposed by `Query API` are the projection
- the change feed is the replay-derived event stream
- the action registry is the only lawful write path; no consumer mutates the storage root directly

This means the chassis preserves ODD's append-only / projection-over-history semantics at the workspace layer, even though the manager itself is not an ABG runtime.

---

## 10. Decisions (ratified 2026-04-26)

All three open decisions ratified per recommendation. Alternatives preserved below for design-history traceability.

1. **Collection of Collections** — **deferred** as a small follow-up. A meta-`AssetSurface` exposing the registry of available `AssetSurface` instances would let MCP publish a discovery resource; out of T-006 scope; ticket TBD when needed.
2. **Cross-collection joins** — **per-surface** until pattern recurs. When a UX surface needs to render a Comment with its referenced Ticket inline, the per-surface inspector handles the join via secondary `Query API` calls. Promote to chassis if the pattern appears in three or more surfaces.
3. **Authorization** — **slot reserved at action precondition; no enforcement now**. The §2.5 action precondition is the place where any future multi-user authorization would land. No design change required for the current single-operator deployment; flagged here so the slot is visible.

---

## 11. Status Transition Plan

This design module is **Proposed** until the open decisions are accepted by the methodology author. On acceptance:

1. Status → **Accepted**
2. T-006 closes (move to `tickets/completed/`)
3. T-007, T-008, T-009 are unblocked and may activate per the wave dependency chain
4. T-010 may activate (already unblocked by T-009 + T-013 + T-015 dependencies once T-015 closes)
5. T-014 may activate after T-007 / T-008 / T-009 close
6. T-011 may activate after T-010 closes
7. T-012 RC qualification waits for T-011 + T-014

If any open decision is changed, this design module is amended in place; the §5E carrier diagram and §6A evidence route are updated to reflect the change.

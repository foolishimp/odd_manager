# STRATEGY: odd_manager as Agent Daemon — Sidecar Tab and Project Agent Widget

**Author**: Claude
**Date**: 2026-04-24T14:00:00Z
**Addresses**: `odd_manager` product shape; MCP exposure of workspace world model; `WorkspaceSnapshot` identity/path collision in `src/lib/types.ts`; direction for `specification/PRODUCT.md`
**Status**: Draft

## Summary

This post reprices `odd_manager`'s target direction. The trigger was a practical
failure of IDE-hosted agent sessions and a subsequent walk through the existing
code surface. The conclusion is that `odd_manager` is already most of what the
user described as a "sidecar" for IDE-independent agent work, and that the
smallest lawful move forward is to ratify a `Project × Workspace = Context`
model, add an MCP data-exposure layer over the existing world projection, and
focus UX effort on a single reusable `Project Agent Widget`.

This post describes target direction. Current reality is called out inline so
findings and recommendations are separable.

## Context

The discussion started from the observation that multiple agent sessions (Claude
Code, Codex) hosted inside a VS Code window were lost when the editor crashed,
even though the underlying transcripts survived on disk. This raised the
question of what the user actually uses VS Code for, and whether an
IDE-independent surface could replace the parts in use.

The two VS Code uses named by the user:

1. File browser / path-copy for pasting into agent CLIs.
2. Markdown + syntax-highlighted review (with mermaid).

The user then clarified that the work in flight is less about source files and
more about navigating typed records — tickets, comments, goals — which already
live under `.ai-workspace/` as domain content, not code.

## Findings

### F1. IDE plugins are already MCP-shaped bridges

Inspection of the installed VS Code extensions confirms the plugin relationship
is already structured as the sidecar pattern:

- `~/.vscode/extensions/anthropic.claude-code-*/extension.js` exposes IPC
  vocabulary including `bridge_state`, `selection_changed`, `diagnostics_changed`,
  `mcp_message`, `mcp_set_servers`, `mcp_tool_use`.
- `~/.vscode/extensions/openai.chatgpt-*/out/extension.js` speaks
  `mcp-request` / `mcp-response` / `mcp-notification` with `mcp-session-id`
  framing, and exposes the command `chatgpt.showLspMcpCliArgs` → "Copy Codex
  CLI args for LSP MCP" so the CLI can connect to the IDE's LSP-as-MCP bridge
  from outside the extension UI.

Third-party projects already generalise this pattern: `tjx666/vscode-mcp`
(editor state as MCP for multiple agents), `CesarPetrescu/lsp-mcp` (Codex LSP
bridge as a standalone Rust daemon), `vamuscari/dev-mcps`, and the official
`modelcontextprotocol/servers/filesystem`. Zed is formalising the same shape as
the **Agent Client Protocol (ACP)**, with Neovim ACP clients (`CodeCompanion`,
`avante.nvim`) already shipping.

Implication: the user is not architecting a new pattern. The sidecar is a
decoupling of an existing pattern, not an invention.

### F2. odd_manager is approximately the sidecar, minus an MCP data layer

From code inspection, `odd_manager` already carries the substrate a sidecar
needs:

- **Typed domain model** at `build_tenants/react_vite/src/lib/types.ts`:
  `RequirementView`, `TicketView`, `CommentView`, `AssetView`,
  `GraphFunctionVectorView`. These are records, not paths.
- **Projection / query surface**: `build_tenants/react_vite/runtime/odd_manager_world.py`
  composes queries against the installed `odd_sdlc` contract and emits a
  structured `ManagerWorld` JSON.
- **REST API on top of the projection**: `/api/world`, `/api/surface`,
  `/api/commands/run`, session-service passthroughs in `src/server/index.mjs`.
- **MCP infrastructure already in use**, via
  `runtime/odd_manager_irc_mcp.mjs` — but scoped to OddChat / IRC messaging
  (`room_*`, `irc_*` tools). There is no MCP surface for the workspace world
  model itself.

Implication: the gap is narrow and specific — an MCP tool/resource set
projecting the existing REST world model, not a ground-up rebuild.

### F3. The conversation surface the user is building is typed, not file-shaped

The user's stated navigation need — projects, tickets, message board — maps
onto typed collections that already exist in `types.ts` or have adjacent
scaffolding (`oddboard-service.mjs` over `.ai-workspace/comments/` and
`.ai-workspace/runtime/oddboard/topics/`). A generic file tree would re-encode
paths where typed records already have a semantic shape.

Implication: the sidecar UX should expose domain resources
(`tickets://open`, `comments://unread`, `active_context://current`) rather
than directory listings.

### F4. `WorkspaceSnapshot` conflates two concepts under one word

`src/lib/types.ts` defines `WorkspaceSnapshot` (around line 565) carrying
*both* `workspace_root: string` (a filesystem path — also seen in every
service: `server/oddboard-service.mjs`, `server/odd-console-events.mjs`,
`/api/world?workspaceRoot=…`) *and* `workspace_profile: WorkspaceProfile`
(an identity with `primary_identity` and `governance_identities`).
`project_profile` is also present alongside.

In current usage `workspaceRoot` is a path; `workspace_profile` is a
methodology identity (for example `odd_sdlc`, `odd_world_model`). The same
word carries both jobs. The user described the intended model as a filesystem
**Project** on disk (with an odd-type tag) governed by a **Workspace**
(methodology lens with custom UX). This is already half-represented in the
types and half-elided by the shared name.

Implication: the collision is real but shallow. It can be resolved by a
rename without changing behaviour, which clears the way for the larger
product move.

## Proposed Direction

### P1. Ratify Context as a first-class concept

Introduce `Context` in `specification/PRODUCT.md` as the runtime binding:

- **Project** = filesystem / git entity on disk, carrying an odd-type tag. The
  *thing* operated on.
- **Workspace** = governance identity and custom UX suite (`odd_sdlc`,
  `odd_world_model`, future `odd_*` domain packages). The *lens*.
- **Context** = `Project × Workspace`. The runtime binding — this project
  viewed through this lens. Scopes the filesystem root, the installed query
  contract (for example `odd_sdlc.query_contract v16`), the enabled UX
  widgets, and the MCP resources exposed to the agent.
- **Agent execution** is bound to a `Context`, not to a Workspace or a
  Project alone. One Project may support multiple Workspace lenses.

Change class: `product_reprice` — current product shape changes while intent
stays stable. `odd_manager` continues to be a workspace supervisor; the
object it supervises is now explicitly `Context`, not an ambiguous
"workspace".

### P2. Focus UX on one Project Agent Widget

Build a **Project Agent Widget** whose single responsibility is producing an
active `Context`. The widget is:

- developed in a **pure sidecar tab** in the React shell so it matures as a
  standalone component with a clean prop / event contract,
- **embeddable** into any domain workspace's custom UX (odd_sdlc,
  odd_world_model, future `odd_*`) so Context selection is uniform across
  the product,
- the **Context producer** whose selection event feeds every other widget —
  xterm spawn, ticket list scoping, message-board filtering, requirement
  browser root.

Embedding semantics default: **local by default, promote to global on
explicit pin.** The embedded widget's selection scopes only that pane unless
the user pins it, at which point it becomes the global active Context. This
preserves domain UX autonomy without fragmenting the context model.

### P3. Make Context emission identical to the MCP resource shape

Define `active_context://current = { project, workspace, session? }` once.
The Project Agent Widget emits this shape on selection; the MCP server exposes
this shape as a resource. No adapter layer, no "embedded mode vs standalone
mode" divergence. Agents read the same record the UI writes.

This is the lever that turns `odd_manager` from a visualisation into the
daemon agents connect to for workspace context.

### P4. Define one AssetSurface contract; instantiate for each collection

Both widget families in flight — xterm sessions and the Asset browser family
— are instances of one pattern: typed asset collection + query + change feed
+ selection contract + action registry + inspector + MCP projection.

Instantiate:

- **2a Message board** = collection of `CommentView` / thread. Actions:
  post, reply, mark-read. Promotion from IRC-chat to message-board means
  adding thread identity, unread state, and author-as-agent metadata — the
  existing `odd_manager_irc_mcp.mjs` and `oddboard-service.mjs` already
  carry most of the raw capability.
- **2b Tickets** = collection of `TicketView`. Actions: status transition,
  link requirement, set dependency. Record type already exists; surface work
  is filters + transitions + change feed.
- **2c Project selector** = collection of `ProjectView` (likely a new
  type). Actions: switch active Project (resets Context for every other
  surface unless pinned), attach terminal, show git state. This one is the
  Context root — it gates everything else downstream.
- **2d Future slot**: gaps register, proof results, build runs, commits —
  each becomes another `AssetSurface` instance without bespoke UX work.

### P5. Promote xterm to a Session asset surface with restart survival

Treat terminals as a first-class asset type (`SessionView`), not a UI special
case. The single robustness property to nail is **the session process
survives `odd_manager` server restart** (tmux/zellij-style detach, not only
scrollback replay). This is the direct antidote to the IDE-crash failure that
triggered this reprice; if it holds, the VS-Code-in-the-loop requirement
collapses.

MCP projection: `sessions://active`, `sessions://<id>/transcript`; tools
`session.spawn`, `session.attach`, `session.detach`, `session.rename`.
Sessions inherit the current Context on spawn — `cwd = project.root`, env
carries `workspace_profile` and the `odd_type` tag for session filtering.

### P6. Rename `workspaceRoot` → `projectRoot` (realization-local)

Rename every use of `workspaceRoot` that currently carries a filesystem path
(`server/oddboard-service.mjs`, `server/odd-console-events.mjs`, REST query
params, Python runtime args) to `projectRoot`. Keep `workspace_profile` for
identity. This is a `realization_refactor` — no intent change, no
requirement change — and it should land **before** the MCP surface is
defined, so the collision is not baked into the agent-visible resource
names.

## Open Questions

1. **Embedded Context scope** — "local by default, promote to global on pin"
   is the proposed default. Is this ratified in `PRODUCT.md`, or does the
   user want global-by-default with the option to detach?
2. **Multi-Workspace Project** — one Project supporting multiple Workspace
   lenses is defensible but adds surface area. Is it in scope for the first
   cut, or should the first cut assume one active Workspace per Project and
   treat multi-lens as a later `product_reprice`?
3. **MCP surface granularity** — expose the full `ManagerWorld` as a single
   resource, or decompose into per-collection resources
   (`tickets://`, `requirements://`, `comments://`, `graph_functions://`)?
   Per-collection is more agent-friendly but more to maintain; full-world is
   cheap but blunt.
4. **`genesis_chat` convergence** — the existing IRC / OddChat MCP already
   overlaps with the message-board surface. Is the intent to fold
   `genesis_chat` into `odd_manager` as the message-board backend, or keep
   them as cooperating daemons connected over their respective MCPs?

## Recommended Action

In priority order:

1. Draft a `PRODUCT.md` delta introducing `Context = Project × Workspace`
   and the sidecar / Project Agent Widget shape. Do not write code yet.
2. Open a ticket for the `workspaceRoot` → `projectRoot` rename
   (`realization_refactor`), bounded to `build_tenants/react_vite/`.
3. Open a ticket for the MCP data-exposure layer — wrap `/api/world` and
   relevant sub-endpoints as MCP resources and tools, mirroring the shape
   of `runtime/odd_manager_irc_mcp.mjs`. Scope the first cut per O3 above.
4. Open a ticket for the Project Agent Widget in a new "sidecar" tab,
   emitting `active_context://current`.
5. Open a ticket for `SessionView` as a first-class asset type, scoped to
   the server-restart-survival robustness property.
6. Defer 2a–2d widget buildouts until the AssetSurface contract is drafted
   as part of step 1.

This post is commentary. It becomes consequential only if its content is
adopted into `specification/PRODUCT.md` and ratified design.

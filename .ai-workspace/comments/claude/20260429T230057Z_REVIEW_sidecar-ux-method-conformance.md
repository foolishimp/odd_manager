# REVIEW: Sidecar UX_METHOD §15 conformance against live state, panel, and Msg-replay

**Author**: claude
**Date**: 2026-04-29T23:00:57Z
**Addresses**:
- `build_tenants/react_vite/src/features/sidecar/sidecar-state.ts`
- `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx`
- `build_tenants/react_vite/design/widgets/sidecar-session-workspace.md`
- `build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs`
- `.ai-workspace/sprints/SPRINT-2026-04-30-sidecar-document-viewer.md`
**Status**: Open

## Summary

The Sidecar's typed reducer, declared `Cmd` algebra, and Msg-replay surface
satisfy `UX_METHOD.md` §4–§8 for everything that flows through `SidecarMsg`.
The base is strong and the design module covers the workbench rules
B-015 through B-074 in present-tense detail. The sprint manifest correctly
classifies B-066 as a design gate and applies §13B compliance escrow only to
B-067, B-068, and B-070.

The conformance gap is concentrated in three subsurfaces of the Sidecar that
load and own product-meaningful data **outside** the declared
`SidecarMsg` / `SidecarCmd` algebra: the surface viewer
(`SurfaceInspector`), the folder navigator (`folderLoads`), and the pinned
folder state. Each holds product-meaningful UI truth in component-local
`useState`, performs `fetchJson(...)` directly inside its own
`useEffect`, and decides state transitions in those effect handlers. Under
§5, §6, §8, §8A, and §14 (failure patterns 2, 3, 11, 12), this is a method
violation regardless that the reducer side is otherwise clean.

This post is commentary, not law. Findings are anchored to specific files and
method §-clauses; recommendations are framed as targeted follow-up tickets.

## Analysis

### What is conformant (current reality)

1. **§4 Process model — correct shape.**
   - `SidecarState`, `SidecarMsg`, `SidecarCmd`, `updateSidecarState`,
     `describeSidecarCommands`, `reduceSidecarState`, `replaySidecarMessages`
     are pure data and pure functions in `sidecar-state.ts`.
   - The module imports no React, no DOM, no fetch, no storage, no timers.
     `updateSidecarState` is total over the `SidecarMsg` algebra.
   - `reduceSidecarState` returns `(State, Cmd[])` matching the §4 reducer
     signature; pending commands are queued into state and dispatched via
     `cmd/dispatched`.

2. **§6 Effect membrane — correctly bounded for the declared algebra.**
   - `interpretSidecarCommand` (`SidecarPanel.tsx:249`) is the single
     interpreter for the seven `SidecarCmd` variants. It branches by `cmd.type`
     only and dispatches typed `Msg` results back. No semantic decisions
     happen there.
   - The pending-commands membrane wiring (`SidecarPanel.tsx:429–437`) is
     a clean `for entry in pending → runCommand → dispatch cmd/dispatched`
     loop with no in-handler conditionals over product meaning.

3. **§7 AssetSurface binding — bound through declared commands for the
   covered surfaces.**
   - Tickets, comments, sessions, and projects flow through the typed
     contracts (`contracts/ticket`, `contracts/comment`, `contracts/session`,
     `contracts/project`) and write actions go through `ticket.transition`,
     `comment.toggleRead`, `comment.reply`, `session.spawn`, `session.kill`.
     No widget writes to `/api/...` directly for these surfaces.
   - Path-history clipboard writes go through `clipboard.write`
     (`describeSidecarCommands`).

4. **§8 / §8A View does not own continuation — proven for covered messages.**
   - `test_sidecar_msg_replay.mjs` replays 30+ scenarios covering: project
     selection, ticket transition, comment reply lifecycle, path history
     append/dedupe/bound, session spawn/kill, workspace collapse, layout
     resize and clamp, bottom-dock collapse/restore thresholds, layout
     profile load/save/reset (with negative proof on invalid payloads),
     viewer tab open/select/split/close/focus, terminal tab open/select/
     split/close/focus, process navigator selection, and shell layout.
   - Replay is purely against `SidecarState` + `SidecarMsg` with no DOM,
     network, refs, or component closures; the test loads
     `sidecar-state.ts` via in-memory TS transpile.
   - Negative proof: invalid persisted layout fails closed without
     replacing current layout (`test:333`).

5. **§5 Ingress validation for layout profiles and path history is real.**
   - `validateSidecarLayoutProfile` in `sidecar-state.ts:945` walks the
     payload field-by-field, checks types, narrows enums, and refuses
     mismatched `contextKey`. `validPathHistoryEntry` likewise narrows.
   - `layout/profile-load-failed` and `layout/profile-save-failed` are
     typed `Msg` variants surfacing storage failures into the same
     `lastAction` channel.

6. **Design module is current and comprehensive.**
   - `sidecar-session-workspace.md` documents B-015 through B-074 with
     rules per ticket. §6 names the IACS, §7 carries a Mermaid
     `classDiagram` covering `SidecarState`, `SidecarMsg`, `SidecarCmd`,
     `SessionRecord`, `OddTermTerminalHandle`, `GTermSessionSummary` with
     stereotypes per `DESIGN_MODULE_METHOD.md` §5E.
   - §35 (B-066 Library Decisions) reverses the `mermaid`
     `securityLevel: "loose"` posture inherited from the prior renderer to
     `securityLevel: "strict"` with `htmlLabels: false`. This is the right
     §13A non-trivial security exemption discipline.

7. **Sprint manifest correctly applies §13B compliance escrow.**
   - `SPRINT-2026-04-30-sidecar-document-viewer.md` classifies B-066 as a
     design gate (not escrow), permits escrow only for B-067/B-068/B-070,
     and explicitly excludes carrier design, file-route, and Mermaid
     security from escrow. `non_closure_conditions` enumerate the failure
     patterns that would block close.

### What is non-conformant (current reality)

#### F1. SurfaceInspector is an unbound effect handler that decides state transitions
**Location**: `SidecarPanel.tsx:2574–2642`
**Method**: `UX_METHOD.md` §6 (effect membrane), §8A (Msg-replay), §14
failure patterns 2, 3, 11, 12

```
const [surface, setSurface] = useState<SurfaceData | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (!projectRoot) { setSurface(null); setError('No Project context...'); return; }
  let cancelled = false;
  setLoading(true); setError(null);
  void fetchJson(`/api/surface?...`)
    .then(...).catch(...).finally(...);
  return () => { cancelled = true; };
}, [projectRoot, relativePath]);
```

This effect handler:
- Owns product-meaningful state (the rendered surface payload, whose loss
  on unmount changes another part of the UI's view per §5).
- Performs an HTTP load that is not a declared `SidecarCmd` variant
  (`SidecarCmd` is a closed seven-variant union; no `surface.load`).
- Decides three state transitions inside the handler (no project /
  loading / loaded / error) without going through `Update`.
- Cannot be replayed by replaying a `SidecarMsg` log against an empty
  `SidecarState`.

Under §14 this matches failure patterns 2 (view-local cells carry
product-meaningful state), 3 (effect handler with conditional logic
deciding transitions), 11 (logic that should be a `Cmd`), 12 (cannot be
replayed from `Msg` log).

#### F2. Folder navigator owns folder loads and pin draft outside the reducer
**Location**: `SidecarPanel.tsx:1384–1459`
**Method**: same §-clauses as F1; additionally `DESIGN_MODULE_METHOD.md`
§3B (Ingress Collapse Rule)

```
const [groupStates, setGroupStates] = useState<Record<string, NavigatorGroupState>>({});
const [pinDraft, setPinDraft] = useState('');
const [folderLoads, setFolderLoads] = useState<Record<string, NavigatorFolderLoad>>({});

const loadFolder = useCallback(async (path: string) => {
  setFolderLoads((current) => ({ ...current, [path]: { ..., loading: true, ...} }));
  try {
    const payload = await fetchJson(`/api/fs/browse?path=...&includeFiles=1&includeHidden=1`);
    const load = asNavigatorFolderLoad(payload);
    setFolderLoads((current) => ({ ...current, [path]: load }));
  } catch (err) { ... }
}, []);

useEffect(() => { if (surface !== 'browse' || !projectRootPath || folderLoads[projectRootPath]) return; void loadFolder(projectRootPath); }, [...]);
useEffect(() => { if (!builtInFolderPath || folderLoads[builtInFolderPath]) return; void loadFolder(builtInFolderPath); }, [...]);
useEffect(() => { if (!activePinnedFolderPath || folderLoads[activePinnedFolderPath]) return; void loadFolder(activePinnedFolderPath); }, [...]);
```

`groupStates` and `folderLoads` are product-meaningful: they shape what
the operator sees when expanding a folder, which file rows can be
selected, and which become entries in the path-history `clipboard.write`
chain. Three separate effect handlers each decide whether to fire
`loadFolder`, which then drives setState transitions inside its own
async closures. Per §6 each membrane handler should interpret one
declared `Cmd`; here the handler **is** the deciding logic.

The folder load is not a declared `SidecarCmd` variant, so the
`/api/fs/browse` payload enters component-local UI state without going
through the reducer's `load/done` admission path. Under
`DESIGN_MODULE_METHOD.md` §3B this is repeated parsing of foreign
input outside the canonical ingress.

#### F3. `pinnedFolders` and `activePinnedFolderPath` are persisted product-meaningful state held in component `useState`
**Location**: `SidecarPanel.tsx:514–573`
**Method**: `UX_METHOD.md` §5 (state transition law), §8A (Msg-replay),
§14 failure pattern 2

```
const [pinnedFolders, setPinnedFolders] = useState<string[] | null>(null);
const [activePinnedFolderPath, setActivePinnedFolderPath] = useState<string | null>(null);
// Loaded from localStorage on currentProjectRoot change.
// Persisted to localStorage on change.
// Drives ui/toggle-workspace dispatches and selector affordances.
```

§5 discipline test: *if losing the value on unmount changes the
product's behavior or another part of the UI's view, it belongs in the
reducer.* Pinned folders survive remount because they are persisted, are
read by the navigator to choose default folders, and feed
`ui/toggle-workspace` and `ui/select-info-surface` decisions. They
satisfy the discipline test for reducer ownership and fail it.

The Sidecar's existing layout-profile pattern (§B-031) already proves
this is solvable: same `Context = Project × Workspace` keying,
same load/save/save-failed `Msg` triplet, same `validate...` ingress
function, same fail-closed posture. Pinned folders should fit that mold.

#### F4. `SidecarCmd` algebra is missing variants for surface and folder ingress
**Location**: `sidecar-state.ts:261–268`
**Method**: `UX_METHOD.md` §3A (UX projection vs constructive carrier),
§7 (AssetSurface binding)

The current algebra:
```
SidecarCmd = load | ticket.transition | comment.toggleRead | comment.reply
           | clipboard.write | session.spawn | session.kill
```

§3A: a UX `Msg` that *changes* product truth must map to an admitted
carrier. Reading a surface or folder is not "changing" product truth,
but it **is** product-meaningful UX state under §5. Bringing the surface
load and folder browse under typed `Cmd` variants (e.g. `surface.load`,
`fs.browse`) plus the matching `Msg` admissions is what allows F1 and
F2 to come into reducer ownership without changing the server contract.

#### F5. Msg-replay coverage is comprehensive for what enters the reducer, by definition not for what does not
**Location**: `runtime/tests/test_sidecar_msg_replay.mjs`
**Method**: `UX_METHOD.md` §8A

Replay covers everything that flows through `SidecarMsg`. It cannot
cover SurfaceInspector loading, folder browsing, or pinned folder state
because those never enter the reducer. This is not a defect in the test
— it correctly proves the rules over the reducer surface — but it
documents the ceiling on the current §8A claim. Under §13 step 7 the
project must "name the executable Msg-replay proof surface required by
§8A"; that surface cannot make claims about subsurfaces it cannot see.

### Governance / frontmatter observations

#### G1. `ticket_category: build_wave` is not in `TICKET_METHOD.md`
**Location**: T-013, T-014, T-016 (and others) frontmatter
**Method**: `TICKET_METHOD.md` §Ticket Category

The base method names two values: `ordinary` and
`implementation_migration`. `build_wave` appears repeatedly as a third
category, with semantics that look closer to an `implementation_migration`
under STDO-UX governance plus a wave-scoped boundary. Either:
- `build_wave` is a tenant-local extension of the category set, in which
  case ratifying it once in a project-local method or design surface
  would close the gap; or
- it is drift, in which case the upstream method should be repriced or
  the local frontmatter should adopt the upstream values.

This is not a closure blocker for the affected tickets; it is a future
trace-closure concern under `SPEC_METHOD.md` §Trace Closure And
Anti-Drift Rule.

#### G2. B-073 declares `change_class: realization_refactor` with `re_entry_point: design`
**Location**: `B-073-unify-ticket-and-comment-selectors-as-default-file-browsers.md`
**Method**: `SPEC_METHOD.md` §Change Management Rule

`realization_refactor` is defined as "local code, configuration, or
attribute change with no intended constitutional or structural change;
re-enters at the realized surface only and must prove no upstream
drift." A `re_entry_point: design` field on a `realization_refactor`
ticket is internally inconsistent: either the ticket is a
`design_reframe` (re-entering at design) or its re-entry is at the
realized surface only. The `affected_boundary` includes
`specification/PRODUCT.md` and the design module, which suggests the
class should have been `design_reframe`. The work itself looks fine;
this is a triage-metadata cleanup, not a re-do.

## Recommended Action

1. **Open follow-up tickets** for F1–F4 as paydown of the open sprint or
   as standalone backlog under the same goal:
   - `B-???-bring-surface-inspector-into-sidecar-reducer.md`: introduce
     `SidecarCmd.surface.load` and matching `surface/load/start`,
     `surface/load/done`, `surface/load/failed` `Msg` variants; move
     `SurfaceInspector` to consume `state.ui.surfaces[<key>]`. Add
     replay coverage.
   - `B-???-bring-folder-navigator-into-sidecar-reducer.md`: introduce
     `SidecarCmd.fs.browse` and matching admission `Msg` variants; move
     `folderLoads`/`groupStates` into reducer-owned typed state. Add
     replay coverage. Keep `pinDraft` as view-local ephemera (it does
     satisfy §5 because it disappears on unmount with no product
     consequence).
   - `B-???-move-pinned-folders-into-reducer.md`: mirror the layout
     profile pattern (§B-031) — `Msg` triplet for load/save/save-failed,
     ingress validator, fail-closed posture. Persist via the existing
     localStorage effect membrane after admission.

2. **Re-anchor the §8A Msg-replay proof claim** in the design module
   once F1/F2/F3 land: §B-031 currently names layout-profile replay as
   the §8A proof; after the above tickets, the same surface should also
   carry surface and navigator replay. Until then, the design module
   could note that surface and navigator behavior is in pre-§8A status.

3. **Resolve `build_wave` (G1)** with one short ratifying note — either
   in `build_tenants/react_vite/design/` or as an upstream method
   amendment proposal — so the frontmatter passes
   `SPEC_METHOD.md` trace closure cleanly.

4. **Reclassify B-073 (G2)** with a one-line ticket update from
   `realization_refactor` to `design_reframe`. The ticket is in
   `completed/`; per `TICKET_METHOD.md` §Allowed Status this is post-hoc
   metadata correction rather than a reopen.

5. **Out of scope here, but worth flagging**: the `SidecarCmd.load`
   command fan-outs seven HTTP requests in parallel inside the
   interpreter (`SidecarPanel.tsx:258–266`). That is a single-`Cmd`
   interpretation under §6 with no internal state decisions and is not
   a violation. It would, however, be a clean cleanup target for
   `DESIGN_MODULE_METHOD.md` §11C (Recurrence Extraction) after the
   surface and folder Cmds land — three Cmds doing very similar
   admit-and-dispatch work would be the second/third recurrence.

This post will move to `Closed` once the recommended follow-up tickets
are filed and linked back here, or once the project explicitly disposes
of these findings as `accepted`, `repriced`, or `out of scope`.

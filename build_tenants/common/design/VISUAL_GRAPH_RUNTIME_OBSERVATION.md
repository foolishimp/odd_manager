# Visual Graph and Runtime Observation

## Candidate status

- Status: accepted current ABG 5 design candidate for bounded implementation.
- Authority: direct T-040 RC4 execution contract
  `urn:odd-manager:execution-contract:T-040:implementation:2026-09-02`.
- Authority digest:
  `sha256:e6b563c6dad00c709dcea7d4032cbdb843ace09e718fea1cf8f561bcffe83362`.
- Method basis: STDO `v2.5.0-rc.4`, including `SPEC_METHOD`, `TICKET_METHOD`,
  `DESIGN_MODULE_METHOD`, and `UX_METHOD`.
- Scope: the M-002 design boundary and the bounded implementation it authorizes.
- Non-claim: this status does not establish Product compatibility, complete ABG 5
  declaration/overlay support, a live actor terminal, or installed-path proof.

This candidate deliberately admits useful partial views. In particular, an
`occurrence_graph` is permitted when declaration topology is absent. It is titled
and described as occurrence history, uses only exact occurrence identities and
explicit relationships, and must never be presented as declaration topology.
Missing declaration and overlay carriers remain missing and cannot be closed by
an occurrence view.

## Decision

The feature projects one selected run through four independent planes:

1. declaration topology: immutable declared graphs, nodes, edges, and overlay;
2. occurrence/frontier: immutable runtime occurrences and explicit relations;
3. workspace observations: mutable-reality O0/effect/O1 observations;
4. actor session capability: exact live or archived transport capability.

No plane substitutes for another. Their availability, basis, and diagnostics are
reported independently. The UI may compose ready planes but may not infer a
missing plane from a present one.

The server owns selection, validation, folding, bounds, redaction, and capability
decisions. The browser receives a bounded projection, not a ledger, filesystem
snapshot, terminal handle, or unfiltered event body.

## Non-inference law

The projection must not derive topology, activity, causation, currentness, or
session capability from event adjacency/position, maximum indices, mtime, path or
directory similarity, PID/process presence, cwd, manager session records, an
unlabeled current scan treated as history, implicit “latest,” or missing-event
speculation.

Event ordinals may establish display order within one validated carrier prefix.
They do not establish an edge, cause, declaration relationship, or active state.

## Exact wire contract, basis, and admission

The sole v1 wire authority is `visualGraphProjectionSchema` in
`packages/developer-control-contracts/src/index.ts`. The endpoint is
`GET /api/ai-workspace/run/visual-graph?workspaceRoot=<admitted-project>&runId=<published-ref>&generation=<sha256>`.
The existing server admission membrane resolves `workspaceRoot`; `runId` and
`generation` are both required projection-basis fields. `generation` is the exact
event carrier generation; it is not a refresh counter. No alternate `basis`,
`planes`, `availableViews`, or `defaultView` property is serialized.

The exact top-level shape is:

```ts
type VisualGraphProjection = {
  kind: 'visual_graph_projection'; version: 1; generatedAt: string
  state: 'ready' | 'partial' | 'missing' | 'unsupported' | 'invalid'
  run: VisualGraphRun | null; declarationTopology: DeclarationTopology
  occurrenceGraph: OccurrenceGraph; workspaceObservations: WorkspaceObservations
  actorSessions: ActorSessions; diagnostics: Diagnostic[]
  limits: {
    maxNodes: 240; maxEdges: 480; maxWorkspaceObservations: 80
    maxActorSessions: 80; maxDiagnostics: 80
    nodesTruncated: boolean; edgesTruncated: boolean
    workspaceObservationsTruncated: boolean; actorSessionsTruncated: boolean
    diagnosticsTruncated: boolean
  }
}
```

The four conceptual planes map one-to-one to the wire fields
`declarationTopology`, `occurrenceGraph`, `workspaceObservations`, and
`actorSessions`. Top-level `state` is the composition posture. `diagnostics`
contains bounded severity/code/message/source-event facts. `limits` is the exact
applied-bound/truncation receipt. View choice is client State, not wire data.

`run` is the complete projection basis: `runId`, nullable `runDigest`, nullable
`scenarioKey` and `scenarioId`, `eventGeneration`, `eventCount`, nullable
`firstOrdinal`/`lastOrdinal`, `eventPosture`, and `closed`. Its `eventContract`
contains nullable `publishedDigest`, nullable `builtInRegistryDigest`, `posture`,
and nullable `bindingPosture`; its `evidence` contains nullable `authority`,
`disposition`, and `validationDisposition`. A missing/unusable run is represented
by `run: null` plus top-level state/diagnostics, never a fabricated basis.
Ordinal bounds are both null exactly when `eventCount` is zero; otherwise both
are present and `firstOrdinal <= lastOrdinal`. Top-level `ready` requires an exact
run plus ready declaration, occurrence, and workspace-observation planes. Actor
session posture remains independent so the composition does not imply a live or
archived terminal capability.

Event-contract posture is closed to
`built_in_registry_envelope_validated_unpublished`,
`published_contract_distinct_from_builtin_registry`,
`published_contract_registry_kind_conflict`,
`published_contract_matches_builtin_registry`, `legacy_envelope_verified`,
`invalid`, or `unknown`. An unpublished posture has no published digest or
binding; any published digest requires a non-null exact binding posture; distinct
posture requires unequal published and built-in digests; match/conflict requires
equal digests. Contradictory combinations fail canonical validation.

The request must name the exact run and generation. A scenario adapter may resolve
an admitted coordinate to them but may not choose by recency, `runs[0]`, mtime,
directory name, adjacency, or maximum index. A run identity reused by multiple
retained carriers is ambiguous and cannot be selected by run ID alone; a shared
resolver must fail closed and the visual endpoint never accepts a `runKey` alias.

The exact built-in registry identity is
`sha256:b47319edc2fe4c50d65579cbbe8d19952199a69b993b91d5f8888e511c96bd6d`.
It is populated in `builtInRegistryDigest` only when the exact built-in profile is
the comparison basis; built-in verification additionally requires that profile's
validation to succeed. The V1 canonical schema admits only that exact non-null
built-in digest; no other digest is aliased to it.

Built-in verification is not a kind-name allowlist. The manager-owned immutable
comparison module recomputes the complete pinned registry digest and fails module
admission unless it equals the digest above. Each event must then satisfy the
complete pinned per-kind contract: aggregate/scope variant, envelope and payload
identity coupling, exactly one closed payload variant, required digest/reference
types, and all event-specific value and self-certification invariants. Only a
prefix admitted by that complete check can supply kind-derived lifecycle meaning.
For ABI 5, lifecycle posture is then derived from exact event categories only:
`run_closed` establishes the closed/converged run posture, while
`terminal_reached` without `run_closed` establishes only `terminal_observed`.
Free-form `terminalKind`, `disposition`, or reason text remains display evidence
and cannot manufacture failure, convergence, or closure semantics.

The current rust-cli evidence publishes
`sha256:abbd5c43dfa219af37f971b318f3a2fdce861b79f5dfc023295c76e1879becc1`.
At its validated evidence coordinate it remains `publishedDigest` with externally
published/observed posture and the evidence authority/dispositions. It is never
rewritten as the built-in registry digest and does not establish broad ABI 5
compatibility. Unsupported or unvalidated coordinates are refused or reported
unsupported; they are not guessed.

A distinct published contract remains structurally observable, but external
kind names are not interpreted through the built-in registry. Its exact typed
aggregate identities, explicit parent identities, causal event references, and
event coordinates may populate occurrence history. `eventPosture` is
`external_contract_uninterpreted`, `run.closed` is false, active IDs are empty,
and occurrence/actor lifecycle states remain `unknown`. Actor/process grouping
uses only a retained actor aggregate plus an explicit process parent identity.
The projection is partial and carries
`external_event_contract_lifecycle_uninterpreted`; a familiar spelling such as
`run_closed` or `actor_process_exited` cannot close a different contract by name.

Published refs are 1-4096 characters and cannot begin with `/` or `file:`. Digests
are exact lowercase `sha256:` plus 64 hex digits. Labels/event kinds/codes are at
most 160 characters and diagnostic messages at most 600. Every declaration or
occurrence edge must bind retained node IDs; node and edge identities are unique
within their plane; every active or last-observed ID must bind a retained
occurrence node. Active IDs exactly equal retained nodes whose exact lifecycle
state is `open`. A parent `run_closed` event does not close an explicitly open
child: such a contradiction remains visible, forces a partial occurrence plane,
and emits `closed_run_retains_active_children`.
Scenario identifiers are path-free identifier tokens. Evidence authority,
candidate disposition, validation disposition, event posture, and binding posture
are lowercase status tokens (`[a-z][a-z0-9_]*`) rather than free text. Unsafe
path-like or control-bearing candidate posture values are withheld during
topology admission and never softened into browser strings.

## Declaration plane

`declarationTopology.state` is `ready | partial | missing`; `reason` is exactly
`published_bodies_admitted | references_without_bodies | no_declaration_carrier`.
References are typed `graph | graph_function | overlay | materialization`; nodes
are typed `graph | node | graph_vector | graph_function | overlay`; edges are only
`declared_vector | overlay_application`. All derive from admitted declaration
bodies and refs, never run chronology.

The wire contract admits only three coherent declaration postures: `ready` plus
`published_bodies_admitted` and at least one uniquely identified retained node;
`partial` plus one or more references, `references_without_bodies`, and no nodes
or edges; or `missing` plus `no_declaration_carrier` and empty declaration
collections. Every edge binds retained nodes, and node and edge identities are
unique. Contradictory or duplicate-identity payloads fail schema admission rather
than being softened by client rendering.

An admitted declaration body without overlay can render its base topology. No
overlay reference/node/application is fabricated; overlay controls are unavailable
and a diagnostic explains the missing overlay. References without bodies produce
`partial` plus `references_without_bodies`; no carrier produces `missing` plus
`no_declaration_carrier`. Either condition prevents full M003/M004 closure.

## Occurrence plane

An `occurrence_graph` is useful and permitted even when declaration topology is
missing. It renders only the schema's exact aggregates: `run`, `graph_call`,
`frame`, `c_call`, `actor_invocation`, and `process`. Each node carries ID,
aggregate ID/type, bounded label, `open | closed | failed | unknown`, and exact
first/last observed event coordinates.

Only these edge classes are admitted:

```ts
type OccurrenceEdge =
  { id: PublishedRef
    kind: 'aggregate_parent' | 'event_causation'
    sourceNodeId: PublishedRef; targetNodeId: PublishedRef
    sourceEvent: EventCoordinate; targetEvent: EventCoordinate }
```

`aggregate_parent` requires an explicit parent/child carrier field on any event
for that exact aggregate; it is not restricted to the first-observed event. One
unique explicit parent is retained, no parent means no edge, and conflicting
explicit parent identities withhold the edge with a stable diagnostic.
`event_causation` requires explicit source and target event coordinates from the
admitted contract. No edge is created because records are adjacent, share a path,
have neighboring indices, or appear within the same time interval.
An explicit parent or cause outside the bounded retained occurrence profile is
also withheld with an aggregate diagnostic and forces a partial plane; it is never
silently dropped while the plane remains ready.

A missing occurrence plane has no nodes, edges, active identities, or
last-observed identity. A ready or partial occurrence plane retains at least one
exact node. Contradictory plane labels fail canonical validation instead of
allowing the client to render retained rows under a missing legend.

When declaration is missing, the page title and view switcher say “Occurrence
history.” Persistent diagnostics say “Declaration topology missing” and “Overlay
missing.” These states remain visible in graph and table modes and make M003/M004
declaration-overlay closure impossible.

## Active and last-observed semantics

`occurrenceGraph.activeNodeIds` contains an occurrence only when an explicit lifecycle
fact admitted by the exact built-in contract for that exact typed identity
establishes activity and no later admitted fact for the same identity establishes
termination or supersession. A terminal child does not terminate a parent. A
terminal aggregate does not terminate unrelated children. One event category
never closes another category by convention, and a distinct external contract
does not inherit lifecycle categories from the built-in registry.

`occurrenceGraph.lastObservedNodeId` is the selectable occurrence with the greatest
admitted ordinal in the exact carrier prefix. It is labeled “last observed,” not
“current,” “active,” or “latest work.” When the prefix is incomplete, the UI adds
“within observed prefix.” Last-observed is a navigation aid, never a causal edge
or a completion claim.

## Mutable workspace observations

Workspace reality remains observation history over a stable workspace binding.
It is not folded into immutable occurrence identity and is never represented as
an immutable filesystem snapshot.

```ts
type WorkspaceObservation = {
  ordinal: number; sourceEvent: EventCoordinate | null
  predecessor: WorkspaceSnapshot; successor: WorkspaceSnapshot
  receipt: WorkspaceReceipt
  current: {
    state: 'present' | 'missing' | 'unreadable' | 'unobserved'
    byteLength: number | null; digest: Digest | null
    posture: 'matches_retained' | 'changed' | 'unavailable'
  }
}
```

`predecessor` is O0, `receipt` is the bounded effect/authorization receipt, and
`successor` is O1. An admitted row requires exact observation, subject, and
workspace-binding refs/digests in both snapshots, with state-consistent byte and
file-digest facts. Its receipt requires exact authorization, before/after, written
digest, and `committed: true` facts. Missing or contradictory O0, effect, or O1
withholds the row; it never produces nullable-field synthesis.

A bounded current scan is permitted only when an admitted carrier binds the exact
workspace subject to an exact worksite path, and only as the separately labeled
external `current` observation. It compares current bytes/digest with retained
observations to produce `matches_retained` or `changed`; unreadable or
unobserved subjects produce `unavailable`, while an exact missing subject is
either a retained absence match or a deletion change. A candidate
`relativePath` is not that binding. The current carriers publish no exact
subject-to-path relation, so V1 emits `unobserved`/`unavailable` current facts and
`workspace_current_subject_binding_unavailable` without reading workspace bytes.
Such a scan never reconstructs an immutable cut,
becomes O0/O1, or rewrites a receipt, occurrence, or retained observation.
The containing `workspaceObservations.currentness` is exactly
`matches_retained_observations | workspace_changed | unobserved`.
A missing workspace-observation plane has no rows and is `unobserved`; a ready or
partial plane retains at least one exact observation row. These invariants prevent
retained mutable-workspace evidence from being mislabeled as missing.
Observation ordinals are unique within the retained construction coordinate; a
duplicate ordinal is an ambiguous row identity and fails canonical admission.
Each retained row must bind exactly one construction member at the same ordinal,
the member O1 must equal the evidence-row O1, O0 and O1 must retain the same
subject and workspace-binding identities, and the committed receipt must name
those exact before/after observation refs and digests plus the O1 written digest.
A mismatch withholds the row with a stable diagnostic; ordinal or chronology is
never a join key by itself. `sourceEvent` is populated only when exactly one
built-in `c_call_result_admitted` event carries
`valueKind: worksite_construction_result` and a `valueDigest` equal to the
canonical digest of the exact retained construction-result value. The event's
outer `resultRef`/`resultDigest` are a different result layer and are not used as
the construction-value join. The retained construction result independently
self-certifies its inner result ref/digest over `sourceApplicationRef` and
`members`. Zero or multiple exact value-digest matches leave `sourceEvent` null
and emit an unbound or ambiguous diagnostic rather than selecting the last event.
The pinned event contract permits digest-only and value-only optional
publication. Digest-only remains a valid content-addressed join; value-only is
not compacted into a join. On the exact built-in contract path, when both value
and digest are present, carrier admission requires the digest to certify that
exact value before compaction. A distinct external contract remains structurally
observable without importing this built-in semantic relation, and no value join
is attempted for it.

## Actor session disposition

Each actor/process locus has one explicit disposition:

```ts
type ActorSessionDisposition = {
  id: PublishedRef; actorInvocationId: PublishedRef
  processAggregateId: PublishedRef | null; actorRef: PublishedRef | null
  lifecycleState: 'running' | 'completed' | 'failed' | 'unknown'
  terminalDisposition: 'live_interactive' | 'live_output_only' | 'archive_available'
    | 'archive_candidate' | 'completed'
    | 'revoked' | 'unavailable' | 'unknown'
  capabilityRefs: PublishedRef[]; operationRefs: PublishedRef[]; archiveRefs: PublishedRef[]
  canAttach: boolean
  firstObserved: EventCoordinate; lastObserved: EventCoordinate
}
```

`live_interactive` requires an exact current capability binding actor, process,
transport endpoint, allowed operations, authorization, and revocation/currentness
facts. `live_output_only` requires published capability and operation refs but
never admits attach/input. Both live dispositions require non-empty capability and
operation refs; `canAttach` is true if and only if disposition is `live_interactive`.
Manager `SessionRecord`, cwd, PID discovery, or a shell spawned in a matching
directory cannot satisfy either disposition.

`archive_available` requires admitted archive refs and a resolver;
`archive_candidate` records published refs without promising resolution and is not
clickable. `completed` reports a closed process with no live capability. Exact
bounded inline output belongs to a separately authorized Product surface and is
not supplied by T-040 visual detail; it cannot change the session disposition or
imply a PTY. The current rust-cli prefix
publishes a distinct event-contract digest, so its actor/process completion is
`unknown` to this built-in projection even though the structural session locus is
retained. Without an admitted exact lifecycle contract or published live
capability, live M005 remains blocked.

The containing actor plane is `missing` only with no sessions and an `unavailable`
interaction disposition. A retained plane has at least one uniquely identified
session. Every session's `actorInvocationId`, and each non-null
`processAggregateId`, binds a retained occurrence node of the matching aggregate
type. A non-null actor/process pair additionally requires the exact retained
`aggregate_parent` edge from that actor invocation to that process. Under the
built-in contract, the process event's `parentAggregateId` and
`actorInvocationRef` must both equal that retained actor identity; a crossed or
conflicting relation is withheld. Under a distinct external contract, only the
explicit retained parent identity supplies structural grouping and lifecycle
remains uninterpreted. Session identity is derived from the complete
actor/process locus so multiple processes cannot overwrite one actor-only key.
For a process-backed locus, lifecycle is folded only from that process's exact
`actor_process_*` events; a parent `actor_invocation_closed` event cannot complete
a started process that has no exact exit. For an actor-only locus, lifecycle is
folded only from that actor invocation's exact events.
Any aggregate disposition other than `unavailable` must be carried by an
exact retained session with the same disposition, so an aggregate live or archive
claim cannot appear independently of its capability-checked session.

## Server policy, redaction, and limits

The summary allowlist is limited to typed identities, event kinds, lifecycle
states, counts, digests, opaque references, bounded labels, timestamps admitted
by the contract, relationship types, and the workspace summaries above.

The summary denylist includes command lines, arguments, cwd, environment, absolute
or local paths, transport configuration, prompts, instructions, raw terminal
bytes, arbitrary event payloads, credentials, tokens, and secrets. Unknown fields
are denied by default. Redaction occurs before serialization and before logging.

V1 wire limits are exactly 240 nodes, 480 edges, 80 workspace observations, 80
actor sessions, and 80 diagnostics. Declaration references and declaration nodes
are each capped at 240; declaration and occurrence edges are each capped at 480;
occurrence nodes and active IDs are each capped at 240. Capability, operation, and
archive refs are capped at 12 per actor session.

Limit overflow yields deterministic truncation at validated record boundaries,
`partial` state for the affected plane, applied-limit metadata, and a stable
diagnostic code. The node/edge truncation receipts are shared graph-family limits,
so they do not invalidate an unaffected ready declaration or occurrence plane;
they always prevent a top-level ready composition. The server never silently
drops records and never expands limits from client input.
Before the carrier compacts any ABI 5 event, projection-critical event kinds,
aggregate/run/parent/declaration/actor/construction identities, and every explicit
causation identity are checked against the canonical non-path, control-safe
published-reference predicate and wire bounds; explicit
causation sets are capped at 200 identities per event. An event exceeding those
pre-compaction bounds is refused at carrier admission, so compaction cannot erase
a relation while leaving a ready built-in-contract claim. The occurrence fold
indexes admitted event identities once and inspects at most 480 causation
relations after bounded parent folding; further relations set the edge-truncated
receipt and stable diagnostic instead of consuming unbounded quadratic work.

Raw event or transcript detail remains outside this summary wire contract. The
pre-existing T-042 exact-event page/detail route is a separate Product surface:
T-040 neither consumes nor changes its `AbgEventDetail`, endpoint, reducer, or
browser panel. T-040 drill-down is projection-local and displays only allowlisted
typed rows already present in `VisualGraphProjection`; opening it emits no event-
detail command. Browser State never holds an unbounded ledger/transcript through
the T-040 visual feature. T-042's generation and detail-redaction residuals remain
owned by T-042 and are not closed by this design.

## TEA client boundary

The feature follows State/Msg/Update/Cmd/Sub:

```ts
type State = {
  requestedRun: { runId: string; generation: `sha256:${string}` } | null
  loadEpoch: number
  load: 'idle' | 'loading' | 'ready' | 'failed'; projection: VisualGraphProjection | null
  refreshSource: 'run_observation' | 'projection' | null
  view: 'declaration_graph' | 'occurrence_graph' | 'table'
  selectedGraphId: string | null; selectedLocus: { kind: string; id: string } | null
  detail: { open: boolean; returnFocus: { kind: string; id: string } | null }
  viewport: { x: number; y: number; scale: number }; table: TableState
  overlayEnabled: boolean; restoreFocusId: string | null
}
```

Messages include `RunRequested`, `ProjectionSucceeded`, `ProjectionFailed`,
`RefreshTicked`, `ViewChanged`, `GraphSelected`, `LocusSelected`,
`DetailOpened`, `DetailClosed`, `OverlayToggled`, `ViewportChanged`,
`TableSorted`, `KeyboardMoved`, `EscapePressed`, and `FocusRestored`.

T-040 commands are limited to loading an exact projection, resolving an exact
transcript, and invoking an admitted actor-session operation. Projection-local
detail open/close is pure reducer state and emits no command.
Subscriptions provide refresh ticks, viewport measurements, keyboard events, and
revocation notifications. Rendering and `update(state, msg)` remain pure; network,
storage, resize, and terminal effects run only through commands/subscriptions.

Every basis-producing run-observation and visual-projection Cmd closure captures a
monotonic request epoch. The response wire remains the canonical schema; the Msg
adds its captured epoch. Update accepts a result only when the epoch matches State
and response `runId` plus `eventGeneration` match the requested identity. Thus a
late A is rejected after A -> B -> A even when the final identity equals the first.
The validated run-observation adapter additionally requires the response's internal
Project and selected Run to match the request. A schema-valid explicit-Run
`unsupported` or `error` response, including selected-Run disappearance, becomes
that request's failure message rather than a false success or an indefinite load.
Refresh failure keeps the last accepted view with an explicit stale/error banner;
its source is retained so retry returns through run observation or projection as
appropriate, without synthesizing a requested generation.

## Spatial and table UX

The primary spatial canvas renders declaration topology when available; otherwise
it may render “Occurrence history.” Layering groups graph/aggregate, actor/process,
call/frame, event, and workspace observation loci without changing their types.
Pan, zoom, fit, minimap, relation filters, and overlay controls are view state only.

The accessible table is a complete alternative presentation of the same bounded
projection and status diagnostics. Rows expose type, identity, state, explicit
parent/cause, last-observed/active flags, workspace phase, and session disposition.
Switching graph/table preserves the typed selection when it remains visible.

Keyboard operation uses a roving focus model: Tab enters a region, arrows move
among spatial peers or table rows, Enter opens detail, and Escape closes detail and
restores focus. The selected locus has a programmatic name and state. Status changes
use a polite live region. Icons have text labels, distinctions never depend on
color alone, focus remains visible, and reduced-motion removes animated transitions.
At 390 CSS pixels the page stacks controls, canvas/table, and detail without page
horizontal overflow; wide tables use their own labeled scroll region.

## Module and file boundary

The implementation boundary is:

- `packages/developer-control-contracts/src/index.ts`: sole wire schema and exported
  `VisualGraphProjection` type;
- `src/features/sidecar/sidecar-state.ts`: the existing Run Inspector State, Msg,
  pure Update/Cmd production, monotonic request epochs, and stale-response guards;
- `src/features/sidecar/visual-graph/`: spatial/table/detail rendering, bounded
  client view state, and layout derived only from server-supplied exact edges;
- `src/capabilities/run-observation/`: the existing capability registration and
  supporting-surface launcher boundary; the Sidecar may not import its internals;
- `GET /api/ai-workspace/run/visual-graph` with required `runId` and `generation`:
  exact server fold, validation, bounds, redaction, and diagnostics.

No rival contract, validation model, second state machine, or detail endpoint is
introduced by this design. The existing T-042 event-detail path remains disjoint
and is neither a producer nor a consumer of T-040 projection-local drill-down.

Existing carrier, observation, and traversal services may supply validated facts,
but their legacy recency selection, adjacency-derived edges, maximum-index activity,
cwd/PID session matching, current scans presented as historical cuts, and T-042 raw
event detail are forbidden as inputs at this boundary. A bounded currentness comparator is allowed
only in the separately labeled `current` workspace field after an exact admitted
subject-to-path binding; without it, currentness remains unobserved.

## Migration and break order

1. Add exact run/scenario and contract-basis selection; refuse implicit latest.
2. Add the v1 contract and strict server/client validators.
3. Add the bounded server fold for declaration and occurrence planes.
4. Add O0/effect/O1 and actor-session dispositions without current-state inference.
5. Add the TEA state machine and monotonic stale-response guards.
6. Add occurrence/declaration spatial views and the equivalent accessible table.
7. Keep T-040 drill-down projection-local and prove it cannot dispatch or ingest
   the disjoint T-042 exact-event detail surface.
8. Remove the T-040 visual path's use of ordered-stage topology, max-index activity,
   cwd-based terminal opening, and raw payload rendering.
9. Replay refusal, accessibility, and exact installed-path proof before closure.

Steps 1-4 are server-first breaks. The UI must not temporarily reinterpret legacy
payloads as v1. A missing v1 projection produces an honest unavailable state.

## Current seven-scenario matrix

| Scenario | Carrier | Current posture | Visual-graph disposition |
| --- | --- | --- | --- |
| basic-cli | present | diagnostic-only; validation failed/unsatisfied | refused as validated projection |
| js-tenant-test | present | diagnostic-only; awaiting review/satisfied | exact basis required; no compatibility closure |
| js-sdlc-bootstrap | present | diagnostic-only; awaiting review/satisfied | exact basis required; no compatibility closure |
| rust-cli | present | diagnostic-only; awaiting review/satisfied | occurrence/workspace candidate; generic digest externally observed |
| rust-service | absent | unavailable | missing |
| parallel-js | absent | unavailable | missing |
| data-mapper-full | absent | unavailable | missing |

The matrix is inventory, not a scenario selector and not Product proof. No scenario
is chosen automatically. T-043 remains responsible for an admitted scenario
selection carrier.

## Acceptance and refusal proof plan

The implementation candidate must provide replayable proof for:

1. exact authority/request/returned-run basis, retaining the generic digest as
   externally published/observed rather than the built-in registry;
2. exact built-in identity match plus profile validation as its only positive path;
3. declaration/overlay present and missing combinations, including occurrence-only
   “Occurrence history” with persistent missing diagnostics;
4. exact parent/causation edges and refusal of adjacency/index/mtime/path/cwd/PID;
5. active versus last-observed separation and honest incomplete-prefix labels;
6. append-only O0/effect/O1, currentness withheld without an exact subject-path
   binding, and honest missing phases;
7. exact session/archive dispositions and refusal of live attach without capability;
8. allowlist/redaction and deterministic partial results at every bound;
9. A -> B -> A run-basis/projection races rejecting every late A result;
10. graph/table equivalence, keyboard/screen reader, reduced motion, and 390px;
11. seven-scenario absence/failure postures without fallback selection;
12. installed browser -> exact route -> fold -> admitted carrier proof.

An implementation is refused if it calls legacy adjacency/max-index helpers for
projection truth, imports or dispatches T-042 event detail from the visual feature,
opens a terminal by cwd/PID,
silently truncates, promotes an external digest to built-in, or labels occurrence
history as declaration topology.

## Residual blockers and disposition

- Evidence names root/declaration terms, but no exact manager-admitted declaration
  body/node/edge/application carrier exists; full M003/M004 is blocked while the
  bounded occurrence view is permitted.
- No admitted overlay carrier exists; overlay controls/closure remain missing.
- Rust-cli retains a structural actor/process relation, but its distinct external
  contract leaves lifecycle and terminal disposition unknown; no live or archive
  capability is admitted and live M005 is blocked.
- Identity-first generic discovery admits the exact `runtime/events.jsonl`
  durable-prefix coordinate; it supplies observation basis, not scenario selection
  or built-in lifecycle semantics.
- No admitted scenario-selection carrier exists; T-043 remains upstream.
- Richer identity/detail work assigned to T-044 is not invented here.
- Exact bounded T-040 M006 evidence, the M007 proof-excluded candidate manifest,
  and M007's installed execution result are single-sourced by
  `qualification/t040-visual-runtime-observation-proof.json`. This design status
  does not duplicate that mutable qualification result. T-045 broad compatibility
  evidence has not been produced and is not implied.
- The existing T-042 exact-event detail endpoint, including its generation and
  raw-detail governance residuals, is explicitly outside T-040 and cannot satisfy
  T-040 visual drill-down or redaction proof.

Therefore this design is accepted for bounded implementation under the direct
T-040 RC4 contract. Its partial states are intentional Product behavior. It does
not close full declaration-overlay compatibility or live actor-session support,
and it must not be cited as broad ABIogenesis 5 compatibility evidence.

# ABG Event-Stream Compatibility

**Status**: Implementation baseline 03; direct Product-owner execution
direction recorded; independent compatibility acceptance remains pending  
**Date**: 2026-09-29  
**Goal**: G-009  
**Requirements**: `REQ-OM-ABG-001` through `REQ-OM-ABG-010`  
**Implements**: `PO-OM-OBSERVE-001`; `PO-OM-AUDIT-001`;
`REQ-OM-ABG-*`  
**Governing method**: `stdo_odd_manager.json#/constitution/stdo/basis`  
**Evidence basis**:
`specification/analysis/ABG_5_0_COMPATIBILITY_BASELINE.md`  
**Affected tenant**: `build_tenants/react_vite/`  
**Implemented code seams**:
`src/server/strict-json-service.mjs`;
`src/server/abg-event-carrier-service.mjs`;
`src/server/project-observation-topology-service.mjs`;
`src/server/abg-run-observation-service.mjs`;
`src/server/traversal-projection-service.mjs`;
`src/contracts/abg-run-observation.ts`;
`src/features/sidecar/abg-run-observation-validation.ts`; Run Observation
State/Msg/Update/Cmd/Sub and views  
**Does not authorize**: a broad ABIogenesis 5.0 compatibility claim,
odd_glc-on-5.0 qualification without a self-identified runtime carrier, ABG
mutation, process control, or T-040 realization

## 1. Decision

`odd_manager` will observe an ABG run from its published identity carrier and
durable event carrier. Terminal proof becomes a later immutable reconciliation
carrier; it is no longer the prerequisite for discovery or the source of the
event sequence.

```text
RunIdentityCarrier + EventCarrier
  -> server validation and bounded event index
  -> AbgRunObservation v3
  -> browser ingress validation
  -> Run Observation replay and view

later ProofCarrier
  -> exact identity + count + byte-digest reconciliation
  -> proof posture on the same observation
```

The server owns filesystem access, streaming, limits, caching, and source
validation. The browser receives bounded summaries, cursors, and requested
detail only. ABG continues to own every event and runtime disposition.

## 2. Current I-01 Contract Binding

T046-I01-W1 enters at `requirement_reprice` for the external profile, discovery
and Run-status clauses under unchanged Product meaning, then binds this design
and performs a bounded `realization_refactor`. The Worker activation uses the
verified `stdo://releases/v2.5.1-rc.1/` basis selected by the Product Definition.
Its write territory is the current Product target, those requirement clauses,
this binding, and the I-01 server/contracts/inspector/proof seams. Ticket, sprint
and a_c context recording remain separately owned. The context is commentary.

The frozen S6/S7 core archives named by T-046 contain identical
`native-runtime-observation.json` bytes, SHA-256
`866eebd2a7cfe2d3aafac965aecb9ba69dfb8611ce86a5288cf354f6ba49f957`, publishing
profile `sha256:ddc961a2484be150193fa255d7dc7b933e52fb81b7b2c681f2bb97e1f9d5754c`.
The manager owns a static validation projection of that exact descriptor. It
does not import or execute an observed Product's code. Another digest under the
same profile reference is unadmitted until a separate contract selection.

The server decodes admitted-body references and validates the complete physical
prefix before projecting selected-Run events. Prefix length/hash/record count
cover storage bytes; selected event count and paging offsets cover the Run
slice. Source admission ordinals remain original and may be noncontiguous.
Generation includes selected Run identity, preventing cursor reuse across Runs
sharing a ledger. Lazy detail restores the logical event while retaining the
physical record coordinates and size limits.

Published invocation resource receipts supply Run ref/digest and close-handoff
prefix identity. A manager-owned retained-observation resolution binds typed published
receipt/read files and archived event bytes under the admitted Project;
filenames locate candidates but do not establish identity.
It preserves the original URI/device/inode/coordinate and labels the path as
retained observation. It cannot mint sandbox identity or native reopening
authority. Source records for other Runs remain available to validation and
decoding but do not become selected-Run activity or status.

Canonical Run state is admitted from the published `run_replay` read only when
its exact source, subject, projection basis and prefix match the selection.
Run closure is independent of child terminal/failure events. Missing or stale
read coverage remains explicit. Process posture remains independently
`unavailable` unless a separate admitted process capability supplies it.
Basic call inspection uses exact GraphCall/Frame/CCall references and existing
lazy event detail; declaration graphs and richer provenance stay in I-02/I-03.
Unimplemented semantic vector, attempt, retry and continuation counters are
nullable and shown as unavailable for this slice, preserving actual event-kind
counts without converting missing projection coverage into zero activity.

I-01 proof resolves the frozen evidence by verified digests, copies the exact
dirty manager candidate, and exercises its installed server/browser path.
Meaningful negatives include profile/reference corruption, foreign-Run
selection, child terminal/failure, nonterminal prefixes, stale generations,
append and detail bounds. These checks do not retarget older T-040/T-045 proof.

### Retained Portfolio Evidence And Claim Boundary

The retained external portfolio contains six terminal Hello World runs from the
pinned odd_glc v22 checkout, one latest stopped Data Mapper carrier, and the
earlier significant stopped Data Mapper carrier. The significant carrier is a
stable non-terminal 126,104,826-byte stream with a 4,117,268-byte event line.
This makes proof-independent, bounded observation a supported significant
path, not an optimization.

The historical ABIogenesis development artifact is
`@abiogenesis/typescript-tenant@5.0.0-dev.286`, publishes manifest schema
`5.0.0` and `compatibility://abiogenesis/major/5`, and exports root-event
contract digest
`sha256:b47319edc2fe4c50d65579cbbe8d19952199a69b993b91d5f8888e511c96bd6d`.
Its emitter supplies the exact canonical, nested-payload, one-based,
content-addressed envelope used by the 5.0 contract fixture.

Every inspected odd_glc runtime carrier still publishes
`@abiogenesis/typescript-tenant@4.6.0-rc.3`. Those carriers prove retained flat
envelope support and shape the new projections, but they are not relabeled.
The generated 5.0 contract fixture proves exact manager envelope readiness; it
does not substitute for a self-identified odd_glc-on-5.0 runtime run through
the installed Product path.

## 3. Migration Map

| Superseded relation | Observed defect | Current disposition |
| --- | --- | --- |
| proof-gated `probeRunRoot` | rejects a run without proof | replaced by bounded identity-first discovery and an in-workspace event carrier |
| proof-derived topology status | confuses proof totals with live event posture | replaced by event terminality with separate unavailable process posture |
| proof-owned observation sequence | reads `proof.eventSequence` as runtime truth | replaced by the shared event index; proof is late reconciliation only |
| proof-gated traversal resolution | cannot inspect stopped non-terminal runs | replaced by the same topology/event basis used by Run Observation |
| adjacency/count closure fold | retries inflate semantic-vector closure | retry-aware semantic-vector projection is active; full identity joins remain T-043 scope |
| browser contract v2 | cannot express carrier/proof posture or cursors | replaced by v3 with bounded event page and lazy exact detail commands |
| whole-object event rows | browser bound occurs after proof load | replaced by server byte offsets, generations, pages, and size refusal |
| undifferentiated new families | actor/C-call/payload/assurance facts disappear | bounded open-family rows are active; full typed lifecycle views remain T-044 scope |

The topology, Run Observation, and Traversal services must share one run-basis
resolver. Parallel selectors would create contradictory selected runs and are
forbidden.

## 4. Authority And Ownership

| Owner | Owns | Does not own |
| --- | --- | --- |
| ABG | event admission, identity, ordering, causal refs, retries, continuation, evidence, terminal disposition | manager process lifecycle or UI state |
| observed Product | scenario, domain package, artifacts, and domain overlays | ABG event meaning |
| `odd_manager` server | bounded discovery, byte-safe streaming, validation, indexes, caches, source refs, late proof reconciliation | traversal, retry, closure, or liveness decisions |
| `odd_manager` Run Observation | selected run, selected section/detail, request identity, refresh and pagination commands, replay | filesystem reads or independent runtime truth |
| Build Control | manager-owned external process posture when an admitted BuildExecution exists | deriving process state from an event stream |

## 5. Carrier Model

### 5.1 `RunIdentityCarrier`

The admitted identity record contains:

- exact carrier path, byte digest, size, and modification observation;
- run root and published workspace root;
- scenario id/kind/proof class;
- graph, graph-function, overlay, and startup refs;
- ABG substrate product, package, version, release, source commit, snapshot
  commit, package digest, and manifest digests where published;
- observed domain-product package identity and digest as a separate relation.

The workspace and event paths must resolve inside the admitted Project/run
boundary. Symlink escape, conflicting roots, duplicate JSON keys, malformed
identity, or contradictory carrier identity fails closed.

### 5.2 `EventCarrierSnapshot`

The index selects exactly one envelope profile for each carrier:

- `abiogenesis_4_6_flat` retains the explicit zero-based flat carrier used by
  the pinned odd_glc evidence; and
- `abiogenesis_5_root` requires canonical JSON, workflow `5.0.0`, the exact
  root envelope, nested payload and digest, one-based admission ordinal,
  admitted causal references, content-derived event identity, aggregate/scope
  identity, and the pinned root-kind registry.

A mixed carrier fails closed. An unknown 5.0 root kind stays observable but
changes contract posture to extension-observed rather than exact pinned-root
support.

One snapshot records:

```text
carrier path
observed size and mtime before read
complete-prefix byte length
complete-prefix event count
first and last admitted ordinal
first and last event time
event-kind counts
maximum line bytes
prefix SHA-256
envelope profile and contract posture/digest
terminal event, if admitted
cursor/index generation
observed size and mtime after read
```

The snapshot is `stable` only when the before/after file observations agree.
A changing carrier returns `carrier_changed_during_read`; the Run Observation
reducer preserves the prior admitted snapshot and presents the refresh error.

The digest covers exact bytes, including newline bytes. A partially written
last line is not admitted as an event and remains explicit pending bytes.

### 5.3 `ProofReconciliation`

Proof posture is one of:

```text
absent | pending | reconciled | conflict | unreadable | unsupported
```

`reconciled` requires the same run/substrate identity, exact complete event
count, exact event-byte digest, and event identity/ordinal conservation where
the proof publishes an event sequence. Proof summary fields may enrich the
projection only after reconciliation. Proof never replaces the event carrier.

### 5.4 Runtime And Process Posture

Event posture is:

```text
non_terminal | run_closed | terminal_converged | terminal_failed |
terminal_observed | terminal_other | external_contract_uninterpreted | invalid
```

The selected stamped profile uses neutral `run_closed`; closure does not
assert convergence or success. Published canonical Run status is a separate
read projection with its original prefix, source digest, replay identity and
coverage. The source Run discovered only in a longer shared archive has
unavailable canonical status until an owner read binds that exact prefix.
Retained legacy profiles keep their separately qualified terminal meanings.

Process posture is independently:

```text
unavailable | queued | starting | running | waiting_human | exited |
cancelled | disconnected
```

No mapping from event recency or `non_terminal` to process posture is lawful.
When no correlated BuildExecution or upstream process capability exists, the
only valid process posture is `unavailable`.

## 6. Server Architecture

### 6.1 Shared run-basis resolver

`project-observation-topology-service.mjs` implements one shared run-basis
resolver contract consumed by topology, Run Observation, and Traversal. It:

1. performs bounded Project-scoped carrier discovery;
2. admits the identity carrier before looking for proof;
3. resolves a native carrier inside its published workspace, or a retained
   archive inside the admitted Project while conserving original coordinates;
4. assigns a stable manager projection key from Project identity, exact run
   identity, and carrier identity rather than path spelling alone;
5. returns optional proof candidates without interpreting them;
6. reports duplicate or contradictory candidates explicitly.

The existing SHA-1 path-derived `runId` may remain only as a transient legacy
UI alias during one schema transition. It cannot be the v3 identity key.

### 6.2 Incremental event index

`abg-event-carrier-service.mjs` reads with a streaming byte interface and
configurable limits. Its cache key includes the admitted run
basis, canonical carrier path, device/inode where available, size, mtime, and
index generation.

The index stores only bounded projection material:

- byte offsets and lengths by admitted ordinal;
- event id, kind, times, and published identity joins;
- counts and fold state by open event family;
- bounded first/latest/high-signal row references;
- digest state and terminal reference.

It does not retain every decoded event object in browser state. Exact event
detail is read by ordinal/range from the source bytes and revalidated against
the index generation before response.

Explicit server limits cover discovery directories/runs, identity/proof
bytes, carrier bytes per supported class, event line bytes, admitted events,
index memory, response rows, and detail bytes. Exceeding a limit returns a
source-linked diagnostic and no false completeness claim.

### 6.3 Event-family folds

The baseline publishes bounded generic `run`, `retryContinuation`, `actor`,
`cCall`, `payloadIntegrity`, and `assurance` families while retaining exact
event identity, ordinal, causal refs, and lazy source detail. The richer typed
joins below remain the closure scope of T-043 and T-044:

The generic fold always retains unknown kinds. Typed folds are independent:

- run/graph selection and terminal;
- graph calls and frames;
- semantic vectors and invocation attempts;
- retries and continuations;
- actor invocation and result artifacts;
- C-call lifecycle;
- instruction response contracts;
- payload observation, validation, and rejection;
- authority, ambiguity, and closure input;
- requirement-route facts;
- evidence and temporal verdicts;
- registry and construction catalog.

Each fold keys only on published identifiers and records unmatched,
contradictory, or duplicate lifecycle members as diagnostics. Array order may
establish source chronology; it may not manufacture an identity relation.

## 7. `AbgRunObservation` v3

Version 3 replaces the proof-shaped root with these top-level relations:

```text
identity
runs[]
selectedRunId / selectedRunKey / selectedRunRoot / selectedWorkspaceRoot
carrierSnapshot
eventPosture
processPosture
proofReconciliation
compatibility
substrate
activity
systemReferences
functions
eventFamilies
assurance
catalog
eventKinds
eventPage
stages
transcripts
artifacts
diagnostics
```

`eventPage` carries `{generation, start, limit, total, rows, nextStart,
previousStart}`. Detail commands carry Project Context identity, selected run
key, index generation, and ordinal. Stale generation or Project/run responses
are rejected by ingress/reducer admission.

Existing view fields are projected one-way from the v3 event index during the
migration. No new implementation may read `proof.eventSequence` as runtime
truth.

## 8. STDO-UX Interaction Contract

```text
State = selected run/section, observation generation, event page cursors,
        selected lifecycle/detail identity, load and proof postures
Msg   = topology requested/admitted/failed; run selected;
        observation requested/admitted/failed; page/detail requested/admitted;
        refresh tick; proof posture changed; source opened
Update= pure transition with Project/run/generation stale-result guards
Cmd   = load topology; load observation; load event page/detail; open source
Sub   = bounded refresh only while the Run Inspector is active
Ingress = v3 runtime validator for every server response
View  = honest non-terminal, terminal, proof, process, truncation, and conflict
        states with bounded drill-down
Membrane = server HTTP and source-navigation adapters only
Replay = deterministic messages reproduce selection and presentation state;
         filesystem/event truth remains command input
```

Refresh preserves the last admitted snapshot while a new generation is in
flight. A failed refresh reports the failure and cannot erase or silently
replace the last known basis.

## 9. Smallest Vertical Sequence

### V1 — Identity-first non-terminal observation

- shared run-basis resolver;
- streaming generic event index;
- v3 carrier/event/proof postures;
- one non-terminal Data Mapper Run Inspector overview and bounded event page;
- late terminal proof reconciliation fixture;
- existing v2 views preserved through the one-way adapter.

V1 is the first implementation ticket because it removes the current
proof-gated topology defect without requiring typed interpretation of every
new event family.

### V2 — Attempt and closure correctness

- graph-call/frame/vector/attempt/retry/continuation folds;
- remove count-subtraction closure inference;
- current six-lane terminal convergence with every published retry retained
  and no false open-closure diagnostic;
- traversal summary consumes the shared event index.

### V3 — Actor, C-call, response, and payload integrity

- typed lifecycle projections and lazy exact detail;
- rejected payload remains a first-class outcome;
- exact digest and causal-ref preservation in UI and source navigation.

### V4 — Requirement and assurance families

- open requirement-route, authority, ambiguity, closure-input, evidence, and
  temporal-verdict folds;
- bounded summaries plus lazy rows;
- no domain meaning without an admitted overlay.

### V5 — Installed portfolio qualification

- all six terminal Hello World subjects;
- at least one non-terminal Data Mapper subject;
- append/mutation/large-line/large-carrier/unknown/malformed/conflict paths;
- installed server/browser causal path and accessibility;
- replay against an exact self-identified ABIogenesis 5.0 carrier before any
  5.0 compatibility claim.

## 10. Failure And Refusal Rules

The projection fails closed or remains explicitly partial when:

- identity is missing, malformed, contradictory, duplicated, or escapes its
  Project/run boundary;
- the event carrier is missing, escapes, exceeds configured support, mutates
  without a stable complete prefix, breaks JSONL framing, repeats event ids,
  breaks ordinal continuity, or regresses admitted time;
- published lifecycle identities cannot be joined without inference;
- a terminal or proof conflicts with the admitted event prefix;
- a browser cursor names a stale generation;
- an unknown substrate or event kind is observed.

Unknown is not failure by itself. Unknown data remains visible and bounded;
positive semantic or compatibility claims remain withheld.

## 11. Acceptance Boundary

The direct Product-owner instruction admits realization of this bounded
migration baseline. Runtime acceptance still requires executable proof for
each vertical slice. Product compatibility acceptance additionally requires
the exact installed-path portfolio in `REQ-OM-ABG-010` and a self-identified
odd_glc-on-ABIogenesis-5.0 runtime carrier. Constructor self-review, analyzer
success, unit-test volume, a generated identity label, or an operator wave
label cannot close that claim.

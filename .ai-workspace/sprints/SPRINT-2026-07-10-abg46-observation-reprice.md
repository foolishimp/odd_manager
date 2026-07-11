# SPRINT-2026-07-10 ABG 4.6 Observation And Developer Build Control

- id: SPRINT-2026-07-10-abg46-observation-reprice
- title: Complete current GTL/ABG observation and establish the multi-Project developer build-control product direction
- status: active
- review_status: in_progress
- goal: establish-current-abg-observation-and-developer-build-control
- opened_at: 2026-07-10T11:35:29+10:00
- updated_at: 2026-07-12T00:03:57+10:00

## Intake Triage

- substantive: yes. The manager's observation contract names "ABG 4.2"; the
  substrate under observation is abiogenesis 4.5.1 (released) / 4.6.0-rc line
  (odd_glc reference run executed on 4.6.0-rc.1). The 4.6 line adds
  witness/attestation events, per-event basis scope (EVENTS-025, fail-closed),
  and citability-as-replay-predicate — none of which the manager can see.
- boundary: odd_manager observation contract (spec + contracts + services)
  versus the ABG substrate release line and odd_glc run-artifact topology.
  ABG remains owner of runtime truth; odd_glc overlays remain domain
  interpretation; the manager observes, never re-derives.
- upward-propagation walk: realization defects (silent event drop, size
  fail-closed, invisible typed assets) trace up through design
  (AI_WORKSPACE_OBSERVABILITY_MIGRATION) to requirements/goals, where the
  first missing layer is found: GOALS G-001 and REQ-OM-PROJ-017 pin the
  observation contract to "ABG 4.2 system-ledger and catalog truth," which no
  longer names the substrate's published surface.
- derived change class: `requirement_reprice` (observation-contract truth
  changes; direction stable), realized through design and realization slices
  below.
- re-entry point: specification/GOALS.md G-001 and
  specification/requirements/03-read-model-and-projection.md, then T-031's
  remaining slices (S-006 linkage, S-007–S-010) as the realization vehicle.
- affected span: specification surfaces naming ABG 4.2; Project identity and
  run-topology contracts; AI Workspace inventory; generic run/traversal
  projection services; Sidecar reducer, Run Inspector, runtime targeting, and
  proof lanes. The retired process contract/projection are historical inputs,
  not restoration targets.
- release scope: this sprint is the carrier for the whole wave; findings ride
  the sprint (no per-defect tickets). T-031 stays the durable work-item
  anchor; sprint close feeds its closure evidence.

## Sprint Extension - Developer Build Control (2026-07-11)

Owner direction extends this sprint with T-032. The observation wave remains a
verified prerequisite, but the sprint is no longer in close review. Its next
purpose is to turn the observed Project/run substrate into a goal-oriented
developer control loop without moving GTL or ABG policy into the manager.

- authority_refs:
  - specification/INTENT.md
  - specification/PRODUCT.md
  - specification/GOALS.md
  - specification/domain/DOMAIN_MODEL.md
  - specification/requirements/06-operator-workbench.md
  - specification/requirements/10-entry-lenses-and-delivery-workspaces.md
  - .ai-workspace/tickets/active/T-032-reprice-odd-manager-around-developer-build-operations.md
  - .ai-workspace/comments/operator/20260711T025804Z_STRATEGY_modular-integrated-developer-control-capabilities.md
  - specification_methodology/specification/standards/SPEC_METHOD.md
  - specification_methodology/specification/standards/ODD_METHOD.md
  - specification_methodology/specification/standards/UX_METHOD.md
- scope: ratify the developer persona and interaction goal; define portfolio,
  Project, specification-proposal, build-command, concurrent-supervision,
  assurance, and attention semantics; publish downstream requirements,
  scenarios, design contracts, and tickets; then realize and prove the first
  odd_glc data-mapper steel thread in the React tenant.
- excluded_boundaries: no changes to abiogenesis, GTL, ABG, odd_method, or
  odd_glc source authority in this sprint; no manager-owned traversal,
  continuation, evidence admission, or closure policy; no opaque view-owned
  shell command as a build carrier; no prompt-driven constitutional mutation
  without proposal, validation, attribution, and explicit acceptance.
- expected_change_classes:
  - product_reprice for T-032 product position, persona, and interaction goal
  - requirement_reprice for build-control, proposal, assurance, and reaction law
  - design_reframe for typed command, projection, scheduling, and STDO-UX modules
  - realization_refactor or feature realization only after the upstream carrier gate
- closure_trigger: the odd_glc data-mapper steel thread can be entered through
  the Project deep link, reviewed and tuned through an admitted proposal,
  submitted through a typed build command, supervised alongside another
  admitted build, and assessed against required gate and asset evidence.
- closure_law: the sprint closes only when T-031 observation proof remains
  independently valid, T-032 product truth is ratified, every
  product-meaningful action maps to a named admitted carrier, concurrent build
  state is replayable and source-attributed, and the data-mapper proof shows the
  complete Review -> Tune -> Build -> Assure loop without manager-owned ABG
  policy. Partial UI, terminal instructions, or a single green process exit do
  not satisfy closure.
- proof_surface:
  - T-031 observation and deep-link proof already recorded below
  - ratified odd_manager intent, product, goals, domain, requirements, and scenarios
  - typed build/proposal/portfolio contracts and runtime validators
  - STDO-UX State/Msg/Cmd design and Msg-replay proofs
  - runtime service tests for admission, concurrency, cancellation, stale state, and run correlation
  - Playwright proof over portfolio, proposal, build supervision, assurance, and responsive behavior
  - odd_glc data-mapper gate and asset evidence with source refs and revision identity
- deferred_compliance: visual polish, screenshots, accessibility walkthrough,
  and local trace cleanup may remain in sprint escrow until W20; product truth,
  command/data contracts, runtime ownership, evidence semantics, and missing
  constructive carriers may not be deferred.
- paydown_policy: W20 classifies every deferred item as corrected, accepted
  local debt with a durable follow-up ticket, upstream re-entry, or removal.
  No authority or carrier debt may survive as local paydown.
- non_closure_conditions:
  - live product authority still frames artifact or run inspection as the developer's end goal
  - the Project selector stands in for a real portfolio and concurrent-build model
  - specification prompting writes authority directly or hides the accepted diff
  - Build invokes shell text not represented by an admitted typed product command
  - the manager chooses ABG traversal, retry, continuation, evidence, or closure
  - gate or asset completion is inferred from logs, UI state, or process exit alone
  - the first steel thread works only for hard-coded odd_glc paths or labels
  - product, requirement, design, code, and proof wording disagree at close review

## Authority

- specification/GOALS.md (G-001, G-002, G-004)
- specification/PRODUCT.md
- specification/requirements/03-read-model-and-projection.md (REQ-OM-PROJ-017)
- .ai-workspace/tickets/active/T-031-establish-general-ai-workspace-browser-with-odd-glc-proof-viewers.md
- build_tenants/common/design/AI_WORKSPACE_OBSERVABILITY_MIGRATION.md
- .ai-workspace/comments/claude/20260710T011707Z_HANDOFF_odd-glc-data-mapper-observation-context.md
- upstream substrate law: abiogenesis specification/requirements/abg/
  (REQ-R-ABG3-EVENTS, -PROJECTION, -PAYLOAD, -SUPERVISOR-WITNESS) and
  docs/ABIOGENESIS_RC_RELEASE_NOTE.md (4.6 line)

## Reference View

The reference view is selected from the admitted odd_glc data-mapper run
topology. The current selected run was executed on abiogenesis 4.6.0-rc.2:

- Project root: /Users/jim/src/apps/odd_glc
- selected run root: /Users/jim/src/apps/odd_glc/build_tenants/odd_glc/typescript/test_runs/glc_software_build_overlay_live/data-mapper-full/20260710T012832676Z_pid27696/
- selected run workspace: the run's `instance/`; it is an admitted runtime
  target beneath the Project, not the Project identity
- observer-grade artifacts, summary-first: run-root proof JSON
  (requirement-lineage canary, eventCounts, eventLogSha256, substrate pin),
  sandbox-identity.json, instance/test-execution-result.json,
  instance/depth-proof-map.json, instance/mutation-outcomes.json,
  instance/.ai-workspace/events/events.jsonl (133,430,175 bytes,
  digest-pinned),
  instance/.ai-workspace/glc-software-build-live/data-mapper-full/ (480
  per-vector artifacts)
- new runs appear as timestamped siblings under data-mapper-full/

## Current Evidence (stand-up walkthrough, 2026-07-10)

Measured with the API server + vite client live and the instance workspace
active:

1. Generic observation lane answers per-feature but surfaces 64 of 1,739
   scanned files; only instruction-manifests classify (`domain_overlay`), the
   remaining ~420 per-vector artifacts fall through.
2. `events: error` — 124 MB ledger fails closed (`jsonl_too_large`);
   whole-file validation cannot carry a real ABG run.
3. Typed proof assets are invisible: test-execution-result.json,
   depth-proof-map.json, mutation-outcomes.json (instance root) and the proof
   JSON + sandbox-identity.json (run root) sit outside the scanner's fixed
   root set.
4. No substrate version detection: `.abiogenesis/` is never read;
   registry shows `odd_type: unknown`, `has_genesis: false` for the instance.
5. Legacy Process Navigator reports `supported: true` while effectively
   blind: first 1 MB / 1,200 events only, filtered through the 3.5-era
   event-kind enum — 99 events of one kind observed against a proof recording
   thousands (393 evidence_admitted, 31 graph calls). Silent drop demonstrated
   live.
6. Tickets rail renders a raw ENOENT scandir error (two 500s from
   /api/fs/browse) where the method requires an honest `missing` state.
7. `/api/ai-workspace/observation` defaults to the manager's own workspace
   unless the client passes `?workspaceRoot=`; it does not follow the active
   Project on its own.

Raw file Browse over the instance root works and shows the typed assets.

## W0 Retirement Wave (precedes all other workstreams)

Owner direction 2026-07-10: retire tech debt first; pull back to the minimal
surface the current codebase meets with the current GTL/ABG implementation.
odd_sdlc-observed registers are presumed dead.

Inventory (evidence-walked, blast radius contained; exact line refs in the
walkthrough record):

- RETIRE `src/server/sidecar-process-projection.mjs` (4,519 lines) — the
  odd_sdlc-privileged lane: install validation, `odd-sdlc-ts` CLI shell-outs,
  query-domain/catalog mapping, operator-runs readers, workspaceRun family,
  liveAnalysis family, TS-event process records/maps. Sole importers:
  `index.mjs:22` and its dedicated test.
- RETIRE route `GET /api/sidecar/process` (`index.mjs`) together with the
  client batch fetch (`SidecarPanel.tsx` process slot) — must go as one cut.
- RETIRE Process Navigator UI tree (`SidecarPanel.tsx` ~lines 3200–6960),
  its rail command, viewer branch, and validator.
- RETIRE `src/contracts/process.ts` (2,012 lines) whole-file, subject to the
  abgSystem decision below.
- SPLIT `sidecar-state.ts` — remove `process` selection kind, `process/*`
  Msg family, reducer cases, UI cells; keep all other families.
- SPLIT shared mechanisms (do NOT delete functions): `detectOddType`,
  `profileWorkspace`, identity detection — strip odd_sdlc arms only;
  mechanisms feed workspace scan, surface routes, session records.
- RETIRE tests: `test_sidecar_process_projection.mjs`,
  `test_sidecar_process_navigator_msg_replay.mjs`,
  `tests/e2e/odd-manager-process-navigator.spec.ts`; TRIM process cases out
  of `test_sidecar_msg_replay.mjs` and `odd-manager-smoke.spec.ts`.
- FIX `runtime/odd_manager_data_mcp.mjs` stale `odd_type: 'odd_sdlc'`
  fixture values.
- REGISTRY: purge 7 dead entries (roots gone from disk: t132, t133, t160,
  t164 x2, t188, t159); deregister stale extant roots pending owner call
  (data_mapper.test35, data_mapper.test56.ts, odd_sdlc root).

Decisions ratified by the operator 2026-07-10:

- D1 abgSystem thread: CUT with the lane. The generic lane (W3/W4) rebuilds
  ABG system observation against the current substrate; no 3.5-era enum or
  read-cap survives by inheritance.
- D2 odd_world_model arms: RETIRE. `OddType` collapses to
  `'unknown' | string`; empty feature dirs removed. G-002's compatibility
  promise stays in spec; future packs re-enter through the generic
  domain-pack lane, not hardcoded literals.
- D3 registry: purge the 7 dead roots AND deregister the extant stale
  odd_sdlc-era roots (data_mapper.test35, data_mapper.test56.ts, odd_sdlc).
  Registry keeps odd_manager, abiogenesis, odd_glc, and the data-mapper
  instance.

Gate for W0: shell loads clean over the data-mapper instance with zero
references to retired surfaces; sidecar-wave + e2e lanes green after trim;
`git rm` scale recorded in the sprint evidence.

### W0 Execution Evidence (2026-07-10)

- Registry: 10 entries deregistered via the live API (7 dead roots + 3 stale
  odd_sdlc-era roots). Remaining: odd_manager, abiogenesis, odd_glc,
  odd_glc data-mapper-full 20260709.
- Deleted whole: sidecar-process-projection.mjs (4,519), contracts/process.ts
  (2,012), test_sidecar_process_projection.mjs (1,382),
  test_sidecar_process_navigator_msg_replay.mjs (530),
  e2e odd-manager-process-navigator.spec.ts (178), empty feature dirs
  (world-model, graphs, requirements, process).
- Edited: SidecarPanel.tsx 7,898→4,461; sidecar-state.ts 2,212→2,042
  (process Msg family, cells, reducer cases, live* collapse cells);
  index.mjs (route + import + odd_sdlc/odd_world_model identity arms
  stripped, mechanisms kept, detectGovernanceIdentities now []);
  project-asset-surface-service.mjs (detectOddType → 'unknown');
  contracts/project.ts OddType → 'unknown' | string; lib/types.ts
  active_domain_pack → string | null; msg-replay 1,965→1,576 (process
  cases out, harness kept); smoke spec trimmed; data_mcp fixtures
  de-sdlc'd; styles.css 6,920→6,065 (128 dead sidecar-process rules).
- Net retirement: ~12,600 lines.
- Grep sweep: one residual hit — e2e OBSERVED_WORKSPACE points at
  ai_sdlc_examples/.../data_mapper.test35 as the generic observed-project
  fixture for ~30 unrelated e2e tests; name-collision only (path lives
  under ai_sdlc_examples). Deviation accepted; replace fixture root when
  W3 admits the odd_glc reference run as the e2e fixture.
- npm run build: passed. tsc --noEmit: zero new errors vs HEAD baseline.
- npm run test:runtime:node: 166/166 pass.
- Live walkthrough post-restart: /api/sidecar/process → 404; registry
  minimal; observation lane over the instance unchanged (64 artifacts,
  events error jsonl_too_large — W4 target); shell renders clean, Process
  Navigator rail entry gone. Remaining raw ENOENT on Tickets rail is the
  pre-existing W5 finding, not a retired-surface reference.
- e2e lane: 27 passed / 4 failed. All 4 failures baselined as PRE-EXISTING
  at HEAD (F_H review debt predating this sprint, not W0 regressions):
  (a)+(b) odd-manager-collaboration.spec.ts expects an "Open workspace
  selector" control removed from source by f2110ca "Make Sidecar the sole
  workspace surface" — the spec was never updated; (c) smoke "project
  browser refresh" waits for a "Refresh Project Browser visible folders"
  button that no longer exists in source (B-078 territory); (d) smoke
  "sidecar terminal panes" expects >1 session record in the fixture
  workspace — reproduced identically on stashed-clean HEAD.
- Additional debt observed: the e2e suite mutates the LIVE project
  registry (re-registered data_mapper.test35 and a managed-refresh-root
  fixture and left test35 active) — e2e needs registry isolation; fixture
  roots to move to the odd_glc reference run under W3. Registry restored
  to the minimal set post-run, instance re-activated.

## Workstreams

- W1 completed — spec reprice: reword G-001/REQ-OM-PROJ-017 from "ABG 4.2" to the
  ABG3-generation observation contract at the current release line, with
  per-product substrate version detection as declared capability.
- W2 completed — substrate identity: derive published Project identity and
  project/run substrate facts from admitted product, proof, and install
  carriers without folder-name privilege.
- W3 completed — run topology: admit run-root discovery (proof JSON, sandbox-identity)
  and instance-root typed assets (test-execution-result, depth-proof-map,
  mutation-outcomes) as classified artifact kinds with viewers.
- W4 completed — events at scale: summary-first ledger observation (counts by
  kind, head/tail windows, digest check against proof eventLogSha256); no
  whole-ledger loads; 4.6 basis-scope and witness kinds recognized, unknown
  kinds surfaced as unknown — never silently dropped.
- W5 completed — honest states: ENOENT-class conditions render as `missing`/`unsupported`
  feature states, not raw errors; observation endpoint follows the active
  Project root.
- W6 completed — generic Run Inspector recovery (T-031 S-007–S-010): retire
  Process Navigator and recover its operational meanings from generic
  Project/run inventory. No odd_sdlc adapter or fixed event-kind enum remains.
- W7 completed — Traversal View restore (owner-declared 2026-07-10, replaces the retired
  graph/vector views): same observable shape as the old Process Navigator —
  current vector, the chain of vectors, statuses, attempts — with three
  constitutional deltas:
  1. recursion-aware model: graph calls open invocation frames; vectors
     belong to frames; child frontiers fold back to parent truth (tail-loop
     contract). Reference run truth: 31 graph_call_opened / 31 frame_opened
     pairs, 89 inner c_call_* constructive calls, per-vector retries and
     evaluator counterparts.
  2. lazy loading: summary-first projection built server-side from the run
     proof (bounded), per-vector detail fetched on selection from the
     per-vector artifact JSONs; the client never receives the full event
     sequence or all vector artifacts at once.
  3. generic-lane carrier: a read-only AssetSurface projection service over
     the run topology (proof JSON + vector artifacts), no substrate CLI,
     no fixed event-kind enum — unknown kinds surface as unknown.

- W8 completed — Drill View restore (owner-declared 2026-07-10): a reusable
  master-detail layout — horizontal lanes of cards on top, detail pane
  below — restoring the ticket visual view as its first instantiation.
  Constitutionally a shared primitive, not a ticket widget: the same view
  will drill into overlays, graph functions, and graph types from admitted
  run projections (W6/S-007 families). Ticket instantiation: lanes
  backlog/active/completed as horizontal card rows, card select via
  reducer Msg, detail below renders STDO frontmatter fields + markdown
  body from the existing TicketRecord carrier. Honest empty state where a
  workspace has no tickets feature. Same laws as W7: typed contracts,
  reducer-owned selection, replay proofs, no raw errors.

- W9 completed — AI Workspace tab (owner-declared 2026-07-10): the T-031 observation
  summary promoted from the Project Browser flyout to a first-class Sidecar
  canvas viewer tab ("Open AI Workspace", rail symbol A, value =
  present/total features). Component reparented (not duplicated) with an
  `expanded` variant for the tab; flyout keeps the compact form plus an
  "Open as tab" affordance. Stale-root guarded, honest empty state, 4
  msg-replay proofs (open, tab-switch survival, profile round-trip,
  stale-root guard). Verified live over the reference instance (3/11
  features present, 67 artifacts, expanded domain-overlay group). Lanes:
  runtime 193/193, build green.
  Follow-up (owner): summary REMOVED from the Project Browser flyout —
  the tab is now the sole rendering; the flyout keeps only a one-line
  "open as tab" affordance. Unused flyout artifact-open handler deleted.
  Verified live: flyout summary gone, link present; 193/193, build green.

- W10 completed — ABG Catalog (owner-declared 2026-07-11): a bounded Catalog
  section now projects runtime registry admissions/rejections and
  construction-action catalog refs directly from ABG-emitted events. The
  current odd_glc run exposes 48 unique entries from 192 admissions (47 node
  types, one graph function), with search, kind segmentation, variant counts,
  repeated-admission counts, and source-event indexes. The manager parses only
  bounded JSON carried in admitted events and never imports or executes the
  observed Project runtime.

- W11 completed — registered Project deep links (owner-declared 2026-07-11):
  the common loader admits an exact registered local Project root from the
  `project` query parameter, gives it bootstrap precedence, and synchronizes
  selected Project context back to the URL. Unknown paths must fail visibly
  without becoming registry entries. The canonical GTL candidate link targets
  `/Users/jim/src/apps/odd_glc`; its data-mapper runs remain subordinate run
  topology selected inside Run Inspector. Project-only links open AI Workspace
  rather than an empty canvas; `view=run-inspector` opens the run surface.

## T-032 Execution Plan

The plan is inside-out. Product and carrier authority close before any
product-truth-changing UX action is implemented.

| Workstream | Depends on | Deliverable | Exit gate | Status |
| --- | --- | --- | --- | --- |
| W12 - Intake and baseline | T-031 observation proof | T-032 with persona, interaction goal, current-versus-target UX, authority boundary, and non-closure conditions | Product re-entry is explicit and the existing observation baseline is preserved | completed |
| W13 - Product reprice | W12 | Update Intent, Product, Goals, and Domain Model with the developer control loop and manager/GTL/ABG ownership split | Live constitutional text names the portfolio-level goal and no longer leaves lawful build control implicit | completed |
| W14 - Requirements and scenarios | W13 | Requirements for portfolio control, specification proposals, build admission, concurrent supervision, gate/asset assurance, attention/reaction, and Project deep-link landing; scenarios for the normal loop and failure/re-entry paths | Every target interaction and reaction traces to acceptance criteria and an executable scenario | completed |
| W15 - Carrier and modular design admission | W14 | Census the published odd_glc/GTL/ABG invocation surface; define BuildRequest, BuildExecution, BuildPortfolio, SpecificationProposal, GateAssessment, AssetDelivery, AttentionItem, shared Context, command-correlation, and capability-contribution contracts; ratify capability ownership and STDO-UX composition; issue downstream module and React tickets | Every product-truth-changing Msg names an admitted carrier, success/failure Msgs, correlation identity, and runtime validator; capability dependency direction is explicit; missing upstream carriers block rather than fall back to shell text | completed |
| W16 - Structural capability foundation, Wave 1 | W15 | Create the capability host/registry, shared Context and command membrane, composed STDO-UX State/Msg/Update/Cmd/Sub boundaries, per-capability module shells, availability states, dependency tests, and integration replay; admit existing AI Workspace and Run Inspector through the host without semantic change | Modules compose into one Project Workbench without reading or mutating each other's internals; deep links and current observation still work; no functional MVP claim is made | completed; operator accepted |
| W17 - MVP 1, Build Portfolio and Project Workbench | W16 | Cross-Project read model, portfolio attention, revision/readiness/run summaries, and goal-oriented `Review -> Tune -> Build -> Assure` framing | Multiple Projects render stable identity, readiness, active-run, freshness, and attention posture; the Project deep link opens the workbench | completed; accepted in prime-set review |
| W18 - MVP 2, Specification Proposal | W16 | Context attachment, prompt session, isolated proposal, deterministic validation, diff review, accept/reject, attribution, and readiness-delta projection | No prompt mutates live specification directly; accepted change and rejected proposal are replayable and source-attributed | completed; accepted in prime-set review |
| W19 - MVP 3, Single Build Control | W16 | Typed build admission pinned to Project/spec revision, one queued/running process lifecycle, ABG run correlation, refresh/subscription, attach, cancel, and governed retry or human decision | One build is submitted and supervised without shell-text fallback, stale-state ambiguity, or manager-owned ABG continuation | manager slice completed; live product residual owned by T-032 |
| W20 - MVP 4, Concurrent Build Control | W17, W19 | Bounded scheduler, configurable concurrency, per-Project isolation, queue controls, and concurrent lifecycle projection | At least two Project builds run concurrently without state, process, output, or correlation collision | completed; live product activation residual owned by T-032 |
| W21 - MVP 5, Assurance and Attention | W17, W19 | Required-versus-delivered gate/asset matrix, evidence drilldown, residuals, proof mismatch, specification drift, deterministic/probabilistic/human posture, and lawful reaction actions | No green state exists without admitted evidence; each attention item has source, severity, affected Project/build, and bounded reactions | manager slice completed; live catalog/evidence residual owned by T-032 |
| W22 - Integrated steel thread and close review | W18, W20, W21 | odd_glc data-mapper end-to-end proof, second concurrent build proof, negative authority tests, module and integration Msg replay, runtime tests, Playwright desktop/mobile walkthrough, ticket reconciliation, and escrow classification | The complete Review -> Tune -> Build -> Assure loop and every T-032 criterion are evidenced; remaining debt is ticketed, repriced, or removed | generic integration completed; live odd_glc steel thread owned by T-032 |

### Authority Sequence

W13 through W16 are sequential and cannot be compressed into functional MVP
implementation. They establish product meaning, requirements, scenarios,
public contracts, module ownership, composition, and the UX command membrane.
W16 is the first structural wave. It closes on executable boundaries, not on a
claim that the developer workflow is functionally complete.

After W16 closes, W17, W18, and W19 may execute concurrently inside separate
capability modules or worktrees against the same admitted host contracts. W20
depends on portfolio and single-build control. W21 may prepare fixtures in
parallel, but its integration gate depends on admitted build/run correlation.
W22 starts only after the capability MVP exit gates are met.

If W15 finds that odd_glc or GTL publishes no lawful generic build carrier, the
build-control lane stops. The sprint records an upstream ticket and continues
only with read-only portfolio/workbench work that does not pretend to execute a
build.

### W13 Execution Evidence (2026-07-11)

- `INTENT.md` names the developer persona, portfolio-level interaction goal,
  proposal/build/assurance outcomes, manager command boundary, and modular
  STDO-UX constraint.
- `PRODUCT.md` defines the `Review -> Tune -> Build -> Assure` loop, four
  observation levels, Project Portfolio, Project Revision, Capability Module,
  Project Workbench, Specification Proposal, Build Request, Build Execution,
  Build Portfolio, Gate Assessment, Asset Delivery, and Attention Item.
- `GOALS.md` adds G-006 for the multi-Project control loop and G-007 for the
  structural capability foundation before functional MVPs.
- `DOMAIN_MODEL.md` 0.5.0 removes the read-oriented-only position, separates
  manager command/process ownership from GTL/ABG execution ownership, and
  publishes the corresponding cross-domain object and ownership model.
- Contradiction census found no remaining read-oriented-only or AI Workspace
  default-landing claim in the four W13 surfaces. Duplicate-heading and
  `git diff --check` validation passed.

### W14 Execution Evidence (2026-07-11)

- Added five capability-aligned requirement families: developer portfolio and
  Project Workbench (8), specification proposal/change control (8), build
  admission/supervision (9), gate/asset assurance and attention (8), and
  modular capability composition (8).
- Repriced existing boundary, ontology, workbench, navigation, and process-lens
  requirements so manager-owned command/process truth is distinct from ABG,
  Project Workbench is the goal-oriented landing, and Run Inspector is the
  supporting forensic capability.
- Added normal `Review -> Tune -> Build -> Assure` scenarios and negative paths
  for concurrent isolation, stale proposal, F_D/F_H conflict, stale/disconnected
  execution, proof/revision mismatch, missing carrier, and independent
  capability iteration.
- Requirement ids are unique; all 41 new requirements carry acceptance
  criteria; scenario requirement references resolve; stale constitutional claim
  census and `git diff --check -- specification` passed.

### W15 Execution Evidence (2026-07-11)

- Published `DEVELOPER_CONTROL_CAPABILITY_ARCHITECTURE.md` with shared identity,
  availability, command, proposal, build, assurance, attention, module, host,
  failure, and proof contracts.
- Carrier census found odd_glc declaration/start-target truth and the generic
  ABIogenesis start command available, but no complete manager-callable worksite
  carrier. The current data-mapper path remains a test harness and odd_glc
  T-033 records its pending declarations-only migration.
- ADR 0003 supersedes ADR 0001's unrealized Redux/RTK Query choice with composed
  plain-TypeScript reducers, one command/subscription runtime, and one built
  Zod contract package shared by browser and Node adapters.
- Added separate design modules for Capability Host, Build Portfolio, Project
  Workbench, Specification Proposal, Build Control, Assurance and Attention,
  and Run Observation. Each owns State, Msg, Cmd/Sub, availability, view, and
  proof boundaries.
- Issued T-033 as the active W16 structural realization ticket and T-034 through
  T-039 as dependency-ordered backlog MVP/integration tickets.
- Issued odd_glc T-034 for the missing public manager-callable carrier
  descriptor; odd_manager T-036 depends on odd_glc T-033 and T-034.
- Ticket frontmatter, design registry, carrier-blocking assertions, and scoped
  `git diff --check` validation passed in both repositories.

### W16 Execution Evidence (2026-07-11)

- Built one runtime-schema package shared by the browser and Node bootstrap
  service for Context, revision, capability, command, subscription, proposal,
  build, gate, asset, and attention contracts.
- Added a pure capability host for Context admission, exact registration,
  command correlation, subscription routing, stale Project/revision rejection,
  and URL navigation. Product-domain branching remains in capability reducers.
- Added six capability directories with public State, Msg, Update, Cmd/Sub,
  selector, contribution, view, and module entries. Structural tests reject
  capability-internal cross-imports.
- Project-only deep links now open the Project Workbench. Existing AI Workspace,
  Run Inspector, Traversal, tickets, files, and shells remain supporting
  Sidecar surfaces through the host.
- Specification Proposal and Build Control render their exact unavailable
  carrier reasons with no constructive buttons or commands. The data-mapper
  test harness remains excluded as a Build fallback.
- Added Git Project revision observation and basis-aware event admission.
- `npm run build` passed, `npm run test:runtime:node` passed 225/225, and the
  complete Playwright lane passed 40/40 on isolated ports. Desktop/mobile
  screenshots were inspected; mobile geometry proof rejects content overlap.
- T-033 was implementation-complete and automation-verified, then accepted by
  the operator's transition into W17. No functional MVP completion was claimed
  for the structural wave.

### W17 Execution Evidence (2026-07-11)

- The operator accepted W16 and refined the first MVP boundary: the Sidecar
  Project Browser was an early workbench, so its cross-Project responsibility
  moved into Build Portfolio rather than surviving as a duplicate selector.
- Added a runtime-schema-valid Build Portfolio API projection over all
  registered Projects with Project/revision identity, specification, build,
  assurance, runtime, participant, freshness, and source-attributed attention
  posture. Missing carriers remain explicit.
- Build Portfolio now owns its reducer, browser state, correlated load/browse/
  register/unregister/activate command family, dense table, source detail, and
  explicit Open/Remove interactions. Observation and row focus do not change
  Context.
- Sidecar no longer publishes a Projects provider or carries Project Browser,
  registry, cross-Project picker, or project-browser tree/CSS state. Its Browse
  capability remains Project-local and supporting tools survive the migration.
- Project-only links continue to open Project Workbench. Explicit activation
  updates URL and Context, and supporting Sidecar state scopes to the admitted
  Project.
- Load-race replay proves Add Project can open before portfolio admission and
  resume browsing after the browse root arrives. Late Project results remain
  rejected.
- Verification: runtime 223/223, TypeScript, production build, Playwright
  38/38, `git diff --check`, and live desktop/mobile visual inspection all
  passed. T-034 is automation-verified and ready for operator UX review.

### W18 Execution Evidence (2026-07-11)

- Ratified the proposal capability IACS, structural carrier diagram, read-only
  provider admission, manager-owned persistence, deterministic validation
  catalog, exact-basis atomic acceptance, and common ADR-001 projection law.
- Added shared browser/server schemas for proposal candidate truth, context,
  validation, decisions, provider output, command ingress, and bounded history.
- Added specification content digests to Project Revision observation. Prompt
  generation cannot write Project source; only a current, passing, explicitly
  accepted patch crosses the locked Git apply membrane.
- Delivered one capability reducer and command interpreter with attachment,
  generate, refine, structured diff, validation, accept, reject, history,
  attribution, stale-basis, late-result, and resulting-Context paths.
- Post-ticket compression review found no rival proposal store, reducer,
  validator, renderer, command family, or placement-owned semantic branch.
- Verification: runtime 232/232, TypeScript, production build, Playwright
  39/39, `git diff --check`, and desktop/mobile visual inspection passed. T-035
  is automation-verified and ready for operator UX review.

### W19 Execution Evidence (2026-07-11)

- Ratified one descriptor/admission, immutable-worksite, supervisor, adapter,
  State/Msg/Update/Cmd, and projection boundary under common ADR-001.
- Added a durable bounded queue, stable request/execution/process/run
  correlation, restart-to-disconnected recovery, output attachment, and
  attributable cancellation. Browser input carries declared carrier input only.
- Added typed terminal results. Exit zero without an admitted result fails, and
  process outcome remains separate from ABG run and assurance truth.
- Completion audit added one production adapter-install registry at the
  manager effect edge. Registry and module identities are schema-valid,
  SHA-256 pinned, startup-admitted, source-attributed, and unavailable to
  Project/browser input. Process plans retain JSON-only input, real worksite
  containment, manager-minted result path, and fixed spawn options.
- Runtime proof uses a real bounded child process behind an explicit fixture
  adapter and covers one convergence, cancellation, two-Project concurrency,
  descriptor failures, stale basis, worksite integrity, symlink escape, and
  arbitrary process-field rejection.
- Focused Playwright proof passed missing-carrier and admitted-carrier paths,
  including desktop/mobile containment. The production build and TypeScript
  contracts pass.
- T-036 was manager-implementation-complete and ready for operator review. At
  that stage it remained active because odd_glc T-033/T-034 had not published
  the non-test carrier required for live closure; fixture proof was not odd_glc
  proof. The prime-set review later merged that residual into T-032.

### W20 Execution Evidence (2026-07-11)

- Extended the one supervisor with explicit concurrency and queue limits,
  stable FIFO positions, per-execution filesystem/output/result roots, and
  restart-to-disconnected recovery.
- Build Portfolio now consumes per-Project activity from the canonical
  supervisor snapshot and projects running, queued, latest, failure, stale,
  disconnected, and admitted run posture without owning process state.
- Service proof uses real child processes for simultaneous cross-Project
  convergence/failure and bounded queue release. Cancellation and late-result
  paths remain independently covered.
- A second service proof covers same-Project concurrent requests with distinct
  request, execution, process, worksite, output, and run identity.
- Playwright changed focus through Portfolio while alpha and beta ran, observed
  both slots occupied, and proved terminal run/output identity isolation.
- T-037 was automation-verified and ready for operator review. Production
  activation remains tied to non-test product carriers; test adapter proof does
  not satisfy odd_glc steel-thread closure. The slice is now accepted and the
  product-carrier residual is owned by T-032.

### W21 Execution Evidence (2026-07-11)

- Ratified one Assurance Catalog, adapter evidence bundle, assessment service,
  State/Msg/Update/Cmd, matrix, Attention, and forensic-drill boundary.
- Positive gate/asset claims require matching Project, execution, revision,
  evidence key, refs, producer, and digest. Process exit and rendered state are
  never evidence adapters.
- Service proof covers no-evidence convergence, full verification, digest/key/
  revision mismatch, F_D plus F_H posture, source drift, and catalog absence.
- Browser proof covers missing, verified, and stale projections, persistent
  Attention across Run Inspector navigation, and responsive containment.
- Portfolio consumes the assessment summary/attention projection without a
  rival assessment store. T-038 was automation-verified and ready for operator
  review; odd_glc live catalog/evidence admission remains open under T-032.

### W22 Manager Integration Evidence (2026-07-11)

- Added one generic governed-Project steel thread through the canonical host:
  Portfolio review, specification proposal generation/validation/acceptance,
  resulting revision refresh, typed Build submission, cross-Project focus
  change, two-process concurrency, output/run isolation, evidence-backed
  Assurance, Run Inspector drilldown, and return to the same Assure context.
- Negative proof at the owning boundaries covers missing carrier, stale
  proposal, cancellation, restart disconnection, F_D/F_H conflict, absent
  evidence, proof mismatch, evidence-key reassignment, and revision drift.
- Runtime and replay proof passed 263/263; TypeScript and production build
  passed; the complete Playwright lane passed 43/43. The explicit concurrency
  journey observed both scheduler slots occupied, and the integrated journey
  cancelled the secondary by identity and retained one accepted source basis
  through verified 3/3 gates and 1/1 asset.
- Browser authority scans found no executable, argv, shell, or child-process
  control in capability/view/effect code. Compression review retains one Build
  store, one Assurance service, one proposal store, one renderer per function,
  and projection-only Portfolio/Run Inspector integrations.
- Desktop/mobile geometry checks passed. Integrated, concurrency, and assurance
  PNGs contain no near-black compositor regions under independent pixel checks.
- T-039 was manager-integration-complete and ready for operator review. Fixture
  carriers could not satisfy the named live odd_glc data-mapper closure law;
  the prime-set review later merged that one residual into T-032.

### W22 Scenario Completion Audit Evidence (2026-07-11)

- A close-review scenario audit superseded the earlier no-defect finding. It
  found stale proposal recovery, attention source routing, forensic context
  preservation, and external execution reconnect/cancel semantics incomplete
  at the manager boundary.
- Stale acceptance now fails closed. Regeneration uses the same participant
  carrier against current Project Context, retains predecessor lineage, and
  leaves the stale proposal explicitly rejectable. Proposal outcomes refresh
  Context through one typed supporting command.
- Portfolio Attention opens the exact source Project and phase. Assurance drill
  carries execution, run, revision, and evidence refs into the one Run
  Inspector and clears that focus on ordinary navigation.
- Recovered active executions transition through stale to disconnected.
  Descriptor-gated reconnect preserves identity and actor/time; optional
  adapter observation and cancellation methods survive digest-pinned registry
  admission, and external cancellation requires adapter confirmation.
- F_D/F_H posture remains derived from admitted catalog/evidence truth.
  Approval, retry, and repair are absent when the product catalog publishes no
  owning command; the manager does not synthesize them.
- Final proof: runtime/replay 263/263, TypeScript passed, production build
  passed, Playwright 43/43 in 4.3 minutes, integrated journey 35.1 seconds,
  concurrency journey 24.1 seconds, and desktop/mobile visual and compositor
  checks passed.
- Durable review record:
  `.ai-workspace/comments/codex/20260711T190031Z_REVIEW_w22-scenario-completion-audit.md`.

### Post-W22 AI Workspace Navigation Reframe (2026-07-11)

- Operator review found AI Workspace flattened Tickets and Comments into a
  weaker artifact list while the Sidecar already owned hierarchy, sorting,
  refresh, and selection. Specification and Build Tenants were also incorrectly
  represented as default favorites.
- Common ADR-002 now governs the shell: the activity bar selects a left flyout
  navigator; object selection opens canonical right-side tabs; tabs may launch
  another tab or activate a provider without duplicating navigation.
- The primary provider order is `T/C/S/B`. Browse uses `F`, Recent Paths uses
  `H`, and canonical roots are removed from persisted favorites.
- AI Workspace remains the feature inventory but delegates Tickets and Comments
  to their canonical providers and omits their flat artifact groups.
- Proof passed: runtime/replay 263/263, TypeScript, production build, Playwright
  44/44 in 4.4 minutes, desktop/mobile visual review, compositor checks, and
  `git diff --check`.
- Review record:
  `.ai-workspace/comments/codex/20260711T193710Z_REVIEW_sidecar-navigation-and-ai-workspace-compression.md`.

### W8 Execution Evidence (2026-07-10)

- Delivered: DrillView.tsx (152, shared master-detail primitive with the
  future overlay/graph-function/graph-type drills declared in its header),
  ticket-board viewer kind + reducer slice with stale-root guards,
  TicketBoardInspector/Detail in SidecarPanel.tsx, sidecar-drill-* CSS,
  6 msg-replay proofs (select, tab-switch survival, clear, unknown-id
  rejection, stale-root clear, same-root retention).
- No new server carrier: the board consumes the existing TicketRecord
  batch surface; markdown body renders through the shared document
  renderer.
- Verified live over odd_manager: lanes Active(4)/Backlog(3)/Completed(99)
  as horizontal card rows, 106 cards, T-031 selected with detail below.
- Lanes: runtime 189/189 pass, build green.

### W7 Execution Evidence (2026-07-10)

- Delivered: contracts/traversal.ts (142), server/traversal-projection-service.mjs
  (710, per-runRoot+mtime summary cache, 4 MB bounded reads, never touches
  events.jsonl), routes /api/ai-workspace/traversal + /traversal/vector,
  features/sidecar/traversal-validation.ts (297, §10 ingress validation),
  sidecar-state.ts traversal Msg family + Cmds + FIFO detail cache (8),
  SidecarPanel.tsx TraversalInspector, sidecar-traversal-* CSS,
  runtime test over the REAL reference run + 8 msg-replay proofs.
- Verified live over the reference instance: state ready, 28 vectors,
  31 frames, current vector 27, substrate 4.6.0-rc.1 detected from proof,
  34 unknown event kinds SURFACED (not dropped), 8 lineage rows
  (eligible / residual). Summary payload 19 KB (~10% of 200 KB budget);
  vector detail ~2 KB, fetched lazily on selection; v12 shows x2 attempts,
  v20 x3 with full stage plan + accepted assessment in the detail pane.
- Lanes: runtime 183/183 pass (+34 new), build passes.
- Honest states verified: odd_manager's own workspace renders the
  unsupported message, no raw errors.
- Deviations recorded by the builder: evaluator artifact variants 404
  honestly when a run ships evaluator sidecars without artifact JSONs;
  vector durationMs spans retries (per-dispatch timing in detail).

## Observation Wave Recovery Evidence (2026-07-11)

- Handoff item 4 is ratified and realized: the first lawful re-entry was the
  requirement reprice. Live specification no longer pins the manager to
  "ABG 4.2" and instead governs versioned ABG3-generation Project/run truth.
- The generic Run Inspector now owns Overview, Graph, Traversal, Functions,
  Catalog, Assets, Diagnostics, Assurance, Events, Stages, Transcripts, and
  Artifacts.
  It supports admitted-run selection, explicit refresh, Project/run stale
  guards, bounded event rows, lazy vector detail, and Project-owned shell
  targeting of the selected run workspace.
- Current odd_glc observation: 3 admitted run carriers; selected converged
  data-mapper run on abiogenesis 4.6.0-rc.2; 4,840 events across 40 kinds;
  28 closed vectors; 46 assets; 28 stages; 27 transcripts; 8/8 requirements
  reached; 22 tests passed; 48 depth-proof rows; 16/16 mutations killed.
- The ABG Catalog projects 48 unique entries from 192 admitted registry events:
  47 node types and one graph function. The live run has no rejected or
  unparsed admissions and no truncated rows; focused fixtures cover rejection,
  variant, and construction-action catalog records.
- The registered odd_glc Project is directly addressable through
  `?project=/Users/jim/src/apps/odd_glc`. URL context takes bootstrap precedence
  and remains synchronized after in-app switching. Relative, duplicate, and
  unregistered paths fail closed without creating Project records.
- The selected run's 133,430,175-byte event ledger is hashed incrementally and
  `verified` against the proof-declared SHA-256. The separate Project-level
  event ledger remains visible as `not_declared`; it is not compared against a
  different run's digest.
- Large JSON/JSONL artifacts remain present and source-linked without
  whole-file browser parsing. Unknown event kinds remain visible. False
  basename-derived software-build overlays are absent.
- Missing filesystem surfaces return typed `missing` states. The Sidecar no
  longer exposes raw ENOENT/500 text for absent ticket or comment folders.
- Layout profile migration preserves supported panes while dropping retired
  tabs. AI Workspace selection uses one shared artifact-open command path.
  Traversal detail cache admission is bounded, protects selected detail from
  late responses, invalidates `latest` on refresh, and fails corrupt JSON with
  a stable error.
- Playwright is hermetic: it uses an isolated manager-state root and the
  odd_glc Project fixture. The operator registry remained byte-identical to
  the pre-run snapshot. Temp Project shell tests wait for admitted Sidecar
  context and clean up only sessions they created.
- Final gates before operator review: `npm run test:runtime:node` 215/215;
  `npx tsc --noEmit` passed; `npm run build` passed; `npx playwright test`
  36/36; `git diff --check` passed. Build retains the existing Vite
  chunk-size warning.
- F_H tooling ruling: this pre-release wave has no configured lint dependency
  or lint command. That absence is accepted debt for this wave; TypeScript is
  the static gate. Introducing a linter requires a separate tooling re-entry
  and is not represented as hidden closure proof.

## Prime Ticket Compression Review 2026-07-11

The live ticket set was carrying completed MVP slices, retired odd_sdlc and
Project-selector targets, and the same external carrier gate in five places.
The close review reduced 10 active and 3 backlog tickets to two active prime
owners and no backlog tickets. Historical records were moved to completed; no
ticket was deleted.

- T-031 remains the observation, Run Inspector, AI Workspace, and navigation UX
  owner.
- T-032 remains the developer-control product owner and the sole owner of the
  live odd_glc carrier, assurance evidence, and ABIogenesis promotion residual.
- T-034 and T-035 are accepted completed capability slices.
- T-036 through T-039 retain their manager proof in completed history; their
  repeated live-product residual is merged into T-032 without claiming closure.
- B-076 and B-078 are accepted historical work superseded by Build Portfolio
  and the current navigator grammar.
- B-069, T-027, and T-028 are completed by supersession because their richer
  PDF.js, TracedCalloutEvidence, odd_sdlc health, and legacy selector carriers
  are not current product truth.
- T-010 was already in completed history; its stale `status: active` metadata
  and retired standalone Project Agent/selector target are normalized as
  superseded by T-034.

Review record:
`.ai-workspace/comments/codex/20260711T195731Z_REVIEW_ticket-prime-set-compression.md`.

## Included Tickets

- T-031: active prime observation/UX owner; implementation proof verified and
  current experience remains under operator review
- T-032: active prime developer-control owner; manager MVP verified; live
  odd_glc steel thread blocked on external product carriers and evidence
- T-033 through T-039: completed; manager capability and integration records
  retained, with the one external residual compressed into T-032
- B-069, B-076, B-078, B-079, T-010, T-027, and T-028: completed by acceptance
  or supersession; no retired carrier is a current restoration target
- external dependency: odd_glc non-test Build Carrier Descriptor, execution
  adapter, Assurance Catalog/evidence bundle, and upstream ABIogenesis F_H
  promotion

## Closure Gates

- [x] Spec surfaces no longer name ABG 4.2; reprice recorded present-tense.
- [x] Observation over the reference instance shows the emitted substrate
  version, proof + canary + typed UAT assets classified and viewable.
- [x] Events feature summarizes the 133,430,175-byte ledger without error and verifies
  eventLogSha256 against the proof.
- [x] No silent event drop anywhere: unknown kinds are surfaced and retired
  fixed enums remain absent.
- [x] Tickets/comments/context rails show honest missing states on the
  instance workspace; zero raw ENOENT/500 in the walkthrough.
- [x] Process Navigator remains retired; Run Inspector renders the recovered
  operational meanings from generic Project/run inventory with no odd_sdlc
  adapter.
- [x] Typed runtime tests + Msg-replay proofs updated and green; browser lane
  green.
- [x] Forensic recovery walkthrough and cold-review findings recorded and
  resolved.
- [x] T-031 observation implementation is independently ready for operator
  review; its verified proof remains the baseline for the sprint extension.
- [x] W13 product authority ratifies the developer persona and primary
  interaction goal.
- [x] W14 requirements and scenarios govern the complete
  Review -> Tune -> Build -> Assure loop and its failure/re-entry paths.
- [x] W15 admits typed product contracts, modular capability ownership, and
  STDO-UX composition law, then issues downstream execution tickets.
- [x] W16 proves the structural capability host, clean module boundaries,
  shared command membrane, integration replay, and existing observation
  compatibility without claiming functional MVP closure.
- [x] W17 delivers the independently reviewable Build Portfolio and Project
  Workbench MVP with one integrated Project registry/browser owner.
- [x] W18-W21 deliver independently reviewable proposal, single-build,
  concurrent-build, and assurance/attention MVP iterations
  without violating the GTL/ABG boundary.
- [x] W22 manager integration, scenario failures, concurrent isolation,
  keyboard-operable semantics, responsive behavior, and durable fixture
  evidence are verified.
- [ ] Live odd_glc data-mapper carrier, Assurance Catalog, adapter evidence, and
  ABIogenesis promotion remain required for named steel-thread closure.
- [ ] Operator close review classifies all deferred compliance and transitions
  the sprint only after both T-031 and T-032 closure law are satisfied.

## Prime-Set First-Use Iteration 2026-07-11

Authority reconciliation corrected `PRODUCT.md` so current posture names the
implemented modular manager MVP and isolates the unproved live odd_glc carrier
as the remaining external residual. The upstream audit confirms ABIogenesis
T-223 as the current DS-1 executable leaf; odd_glc T-033/T-038 remain lawful
DS-6 work after the intervening ABIogenesis design, runtime, qualification, and
self-host phases. No local manager shortcut is admitted.

The first integrated UX iteration then compressed three high-frequency
developer surfaces:

- Project Workbench identity no longer duplicates capability readiness;
- the terminal dock starts collapsed for a fresh or reset profile but preserves
  explicit persisted expansion;
- ticket lane counts project the canonical ticket collection before folder
  expansion, while shared navigator/viewer ownership remains unchanged.

The Sidecar design also now records Project Workbench as the Project-only
deep-link target and AI Workspace, Run Inspector, and Ticket Board as explicit
supporting views. Final proof is green: runtime/replay reports 266 tests with
262 passed, 4 environment-dependent screen tests skipped, and 0 failed;
TypeScript and the production build pass; Playwright passes 44/44 in 4.4
minutes; and `git diff --check` passes. The external carrier path and operator
close review remain the sprint residuals.

## Project Workbench Availability Compression 2026-07-11

The second prime-set UX iteration realizes REQ-OM-DEV-001 more directly. The
four phase controls now project admitted Review, Tune, Build, and Assure
availability through the shared renderer. Contract `ready` is presented as
compact `available`, while active capability modules retain full reasons and
source references. The duplicate six-row status sidebar is removed, including
its self-referential Workbench row and repeated Run Observation row.

This is projection compression only. Project Workbench adds no capability
state, completion inference, command, or carrier. The active capability now
uses the full desktop width and all four phase statuses remain visible and
contained at 390px.

One first full browser run exposed duplicate `data-availability` test hooks on
the shared full wrapper and new compact child span. The child hooks were
removed; the existing wrapper remains the stable full-state selector. Both
affected real-process workflows then passed in isolation and the final full
matrix passed.

Final gates: runtime/replay 266/266; TypeScript passed; production build passed
with the existing Vite large-chunk warning; Playwright 44/44 in 4.5 minutes;
desktop/mobile live review showed no overflow or console errors; and
`git diff --check` passed. T-031 operator UX review and T-032's external carrier
sequence remain the sprint residuals.

## Source-Attributed Attention Actions 2026-07-11

The third prime-set UX iteration removes generic `Open source` actions from
Build Portfolio attention. One total selector now supplies both the admitted
target capability and the projected action label: revision/specification opens
Tune, build carrier/execution opens Build, and other evidence opens Assure.
Unknown source kinds therefore remain visible at the assurance boundary rather
than disappearing or gaining an invented positive meaning.

The modular replay loader now resolves local TypeScript runtime imports, so the
shared selector remains a prime module rather than being copied into the
reducer for test convenience. No product command, Context, source reference, or
capability ownership changed.

Final gates: focused host/selector 11/11; focused three-route browser 1/1;
runtime/replay 267/267; TypeScript passed; production build passed with the
existing Vite large-chunk warning; Playwright 45/45 in 4.9 minutes;
desktop/mobile live review showed no overflow or console errors; and
`git diff --check` passed.

## Review-To-Tune Attention Context Handoff 2026-07-12

The fourth prime-set UX iteration preserves source attribution across the
Review-to-Tune transition. After the target Project Context is admitted, the
host forwards the attention `sourceRef` through the existing proposal
attachment Msg. Manual and attention-driven attachment therefore share one
bounded reducer path and one generation payload.

Project changes clear all proposal drafts and attached refs before new history
loads; same-Project revision refresh retains explicit context. This closes the
cross-Project candidate-state leak that would otherwise become possible once
attention context was carried automatically.

Final gates: focused proposal replay 6/6; focused Tune/Build/Assure browser
route 1/1; runtime/replay 268/268; TypeScript passed; production build passed
with the existing Vite large-chunk warning; Playwright 45/45 in 4.6 minutes;
desktop/mobile Tune review showed the exact source ref with no overflow or
console errors; and `git diff --check` passed.

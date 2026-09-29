---
id: T-032
title: Reprice odd_manager around the multi-project developer build control loop
type: feature
ticket_category: ordinary
status: active
review_status: local_stdo_2_2_1_conformance_accepted_external_steel_thread_open
proof_status: local_candidate_qualified_exact_abg46_observation_external_build_assure_open
goal: establish-multi-project-developer-build-control
owner: codex
change_intent: >-
  Refine odd_manager around its first primary persona: a developer who manages
  multiple Spec Method and ODD-governed Projects, reviews and tunes
  specification through attributable prompting, executes builds concurrently,
  supervises their progress, and verifies that every required gate and asset is
  delivered.
change_class: product_reprice
re_entry_point: product_definition
affected_boundary: >-
  specification intent, product definition, current goals, domain model,
  operator-workbench and process-lens requirements, new build-control and
  assurance requirements, developer scenarios, UX design modules, and
  downstream command-carrier and React realization tickets
priority: critical
triaged_at: 2026-07-11
created_at: 2026-07-11
updated_at: 2026-08-28
dependencies: []
sprint: SPRINT-2026-07-10-abg46-observation-reprice
related_work:
  - T-031
design_commentary:
  - .ai-workspace/comments/operator/20260711T025804Z_STRATEGY_modular-integrated-developer-control-capabilities.md
governance_scope: current Product Definition Overlay, selected STDO/ODD/UX entrypoints, and GTL/ABG command and runtime boundaries
selected_method_basis: stdo_odd_manager.json#/constitution/stdo/basis
growth_authority: none_review_only_local_prerequisite_exhausted
prerequisite_status: accepted_and_exhausted
admitted_prerequisite: >-
  Restore the exact Goals to Intent to Product to requirements to design to
  code and proof authority path for the already-selected developer-control
  outcome, including STDO-UX design and executable-proof conformance, without
  adding capability behavior or filling the external odd_glc carrier gap.
intake_source: >-
  Operator persona refinement on 2026-07-11: the first odd_manager persona is
  a developer managing many Spec Method/ODD Projects who reviews and tunes
  specification, triggers concurrent builds, observes execution, and ensures
  all build gates and assets are delivered.
target_truth: >-
  odd_manager is a goal-oriented developer control plane over a portfolio of
  governed Projects. It lets the developer move each selected specification
  revision through review, proposed specification change, admitted semantic
  build submission, concurrent execution supervision, and evidence-backed
  gate/asset closure. The manager owns portfolio coordination, command
  admission, scheduling, process lifecycle, operator interaction, and
  attention routing while GTL/odd_glc owns the published build program and ABG
  owns traversal, continuation, evidence, and runtime closure truth.
superseded_truth: >-
  odd_manager is primarily a read-oriented single-Project artifact and run
  inspector in which the developer must infer project readiness, tune
  specification outside the product, launch builds through terminal knowledge,
  and reconstruct gate or asset completion from separate observation surfaces.
closure_law: >-
  This law governs full T-032 closure; the named local STDO 2.2.1 conformance
  prerequisite may reach its own terminal condition without closing the
  external Build/Assure steel thread. Close this product-reprice ticket only
  when live constitutional product truth names the developer persona and
  primary interaction goal, defines the multi-Project
  review-tune-build-assure loop, reconciles manager command authority with
  GTL/ABG runtime ownership, and admits traceable requirements and scenarios
  for portfolio observation, specification proposals, concurrent build
  control, live supervision, attention handling, and gate/asset assurance.
  Downstream design and tenant-local realization work must be ticketed
  separately; a speculative Build button or shell-command wrapper is not
  closure.
evaluation_criteria:
  - The first primary persona is explicitly the developer operating multiple Spec Method/ODD-governed Projects through odd_glc or another admitted domain package.
  - The primary interaction goal is stated as moving selected Project revisions from governed specification through assured build completion.
  - The product defines portfolio, Project, build, intervention, and forensic observation levels and the transitions between them.
  - The product defines one coherent Review -> Tune -> Build -> Assure interaction loop instead of treating artifact inspection as the user's end goal.
  - Specification prompting produces attributable proposals against named authority surfaces, with diff, validation, and explicit acceptance or rejection before constitutional truth changes.
  - Build submission is a typed product command over an admitted Job, GraphFunction, workorder, or equivalent published carrier and is pinned to Project and source/specification revision identity.
  - Concurrent builds expose queued, starting, running, waiting-human, converged, failed, cancelled, and stale or disconnected posture without creating manager-owned runtime truth.
  - Gate and asset assurance distinguishes required, delivered, failed, missing, stale, and unsupported states and links every closure claim to source evidence.
  - Attention and reaction semantics cover deterministic failure, probabilistic work, human gates, stale heartbeat, proof mismatch, specification drift, cancellation, retry, and lawful re-entry.
  - Existing AI Workspace and Run Inspector capabilities are positioned as supporting project and forensic observation surfaces within the developer control loop.
  - The registered Project deep link has a ratified goal-oriented Project landing target, even if its implementation remains a downstream ticket.
  - Separate downstream tickets exist for the command carrier, portfolio/workbench design, specification proposal workflow, build supervision, assurance matrix, and tenant-local UX realization.
proof_surface:
  - specification/INTENT.md
  - specification/PRODUCT.md
  - specification/GOALS.md
  - specification/domain/DOMAIN_MODEL.md
  - specification/requirements/06-operator-workbench.md
  - specification/requirements/10-entry-lenses-and-delivery-workspaces.md
  - specification/requirements/
  - specification/scenarios/
  - build_tenants/common/design/
  - downstream tickets linked from T-032
non_closure_conditions:
  - The persona exists only in this ticket or commentary and is absent from live product authority.
  - The product still describes itself as read-oriented without defining lawful build submission and supervision authority.
  - Multi-Project operation is reduced to a project selector with no portfolio attention or concurrent-build model.
  - Specification prompting can mutate constitutional files without a visible proposal, deterministic validation, attribution, and explicit acceptance path.
  - A Build action constructs an opaque shell command in the view or bypasses a typed admitted product carrier.
  - odd_manager chooses graph traversal, continuation, retry policy, evidence admission, or runtime closure on ABG's behalf.
  - Gate completion is inferred from UI state, process exit, or log text without evidence-backed gate and asset carriers.
  - AI Workspace or Run Inspector remains the primary destination and artifact inspection is presented as completion of the developer's interaction goal.
  - React implementation begins without ratified product, requirement, scenario, command-carrier, and STDO-UX design authority.
---

# T-032: Multi-Project Developer Build Control

## Current Product Definition Governance Re-entry — 2026-08-28

Current work resolves the complete immutable method basis, constitutional
routes, and collective reference frame through `stdo_odd_manager.json`. This
governance-only re-entry conserves the accepted historical prerequisite and
its exact evidence; it neither reopens that work nor grants capability growth.
The external Build/Assure steel thread and exact ABIogenesis 4.6 RC3
observation evidence remain unchanged. ABIogenesis 5.0 development requires
the separately admitted G-009 compatibility reprice.

## Historical STDO 2.2 Trace And STDO-UX Repair Admission

The Product-owner instruction on 2026-07-26 admits one bounded prerequisite to
the existing G-006 outcome:

> Make the current `odd_manager` source boundary reconstructable from Goals
> through Intent, Product, live requirements, accepted design, shipping code,
> written testcase authority, and executable proof under STDO `v2.2.1` and its
> adopted STDO-UX extension.

The prerequisite owns only:

- correcting reversed or circular authority links;
- declaring the Product operational-lifecycle posture or exact named gaps;
- separating stable Product meaning from mutable evidence and dependency
  projections;
- grounding every live requirement family and active design record through an
  explicit `Implements:` relation;
- mapping every live requirement to written testcase authority or honest
  deferment;
- mapping shipping source and executable proof carriers to requirement and
  design authority;
- reconciling the existing capability boundary with STDO-UX `State`, `Msg`,
  pure `Update`, `Cmd`, `Sub`, ingress, effect-carrier, replay, and
  accessibility law; and
- adding deterministic conformance proof that rejects missing, contradictory,
  stale, or orphaned links.

It does not authorize a new Product outcome, Requirements View realization,
external `odd_glc` carrier work, capability growth, general cleanup, or closure
of the existing live-product residual.

The prerequisite is exhausted by direct acceptance of one exact candidate
whose trace and conformance claims pass, or earlier by rejection, withdrawal,
supersession, repricing, or falsification. Its registry, tests, and retained
code are evidence only and cannot select follow-on work.

## Historical STDO 2.2 Review Freeze 2026-07-26

As of 2026-07-26, T-032 remains open only for operator review and direct
disposition of its existing claim. The implemented manager slices, plans,
matrices, tests, and retained external-dependency evidence do not authorize
continued realization. The missing odd_glc carriers and ABIogenesis promotion
remain external closure dependencies; they are not an admitted odd_manager
prerequisite, experiment, or downstream-work grant. A review finding may enter
repair only through an explicitly admitted basis in this existing owner. The
trace and STDO-UX prerequisite above was the sole repair admission at that
freeze. Any other material continuation required a newly selected unresolved
Product outcome or another named bounded prerequisite or experiment under
`specification/GOALS.md`.

## Superseding STDO-UX And Design-Method Disposition 2026-07-26

Acceptance is withheld. This disposition supersedes every 2026-07-11 statement
below that calls the manager-owned MVP implemented, accepted, closed, or
automation-verified. The older execution notes and test counts remain
historical evidence for functional slices; they are not current promotion,
closure, or continuation authority.

The bounded host cut now provisionally realizes one
`DeveloperControlAggregateState` and `updateDeveloperControlAggregate`
boundary, aggregate command lifecycle, and centrally derived Build/Portfolio
subscriptions interpreted by thin React lifecycle adapters. That removes the
former multiple-controller and directly installed polling claims. It does not
accept the host or the wider product boundary.

The remaining exact odd_manager-local gaps are:

1. The shared `commandEnvelopeSchema` and `commandResultSchema` remain
   declaration carriers with no runtime consumer. The aggregate runtime
   delegates typed internal commands to capability-specific interpreters, so
   the accepted schema-validated shared envelope/result boundary is not live.
2. Subscription values are centrally derived and interpreted, but lifecycle
   adapter installation and event-source failures have no typed subscription
   failure message or replay path.
3. `SidecarPanel.tsx` retains meaningful view-local state and direct HTTP,
   storage, timer, WebSocket, and navigation effects, including continuation
   and effect-handler controller responsibility. Selected reducer replay tests
   do not establish that all meaningful next state is event-derived.
4. `App.tsx` still owns selected Project bootstrap, registry/deep-link
   admission, URL projection, persisted workspace, and theme continuation in
   React state and conditional effects rather than a declared replayable
   State/Msg/Update/Cmd/Sub shell boundary.
5. Accessibility proof covers primary host/workbench tab behavior and selected
   resize/navigation lanes only. Capability-internal controls, focus handoff
   and recovery, live status, annotations, measured contrast, terminal and
   forensic detail, and complete responsive placements remain open without
   exemption.
6. The materially changed boundary has no accepted Ontology,
   Ontology-derived Irreducible Architectural Carrier Set, complete
   `classDiagram`/`sequenceDiagram`/`stateDiagram-v2` view set, cross-view axiom
   evaluation matrix, or accepted DESIGN_MODULE_METHOD verdict.
7. The installed-development script proves an isolated candidate can install,
   run the trace and runtime suites, build, serve, and execute the admitted
   accessibility scenario. It does not provide decisive installed proof for
   every operator-capability and significant-path claim in
   `REQ-OM-VER-003`.
8. The non-test `odd_glc` carriers and ABIogenesis promotion remain a separate
   external dependency after the odd_manager-local gaps are repaired.

The accepted design records remain future intent; their `Implements` maps,
STDO-UX bindings, code entrypoints, and proof selectors are provisional
evidence only. This review disposition authorizes no capability growth. Work
remains bounded to the already admitted trace, STDO-UX, and design-method
repair.

## Historical STDO 2.2.1 Closure And Exact 4.6 Qualification Admission 2026-07-27

The Product-owner instruction on 2026-07-27 updates the selected method to the
released STDO `v2.2.1` basis already named in this ticket and directs closure
of the admitted local trace, STDO-UX, and design-method prerequisite after its
deterministic gates pass.

The same instruction admits one bounded compatibility-evidence operation:

```text
subject:
  odd_glc 0.1.0 on ABIogenesis 4.6.0-rc.3
operation:
  exact immutable read-only observation qualification
terminal condition:
  exact release identities and proof digests verified;
  server and client observation admission pass;
  Build remains explicitly unavailable without a published descriptor
```

This operation may copy the immutable proof and release manifest into a
self-contained qualification fixture. It may not add an odd_glc or
ABIogenesis runtime dependency, publish a synthetic Build carrier, generalize
the compatibility range, or close any Build/Assure scenario.

ABIogenesis 5 is explicitly unselected until a released version exists and the
Product owner admits a new basis. Neither the 4.6 qualification nor retained
5.0 planning evidence selects that later work.

The local prerequisite closes only on one exact candidate that demonstrates:

1. exact 41-member STDO `v2.2.1` installation and aggregate;
2. deterministic Product-to-requirement-to-design-to-code-and-proof
   traceability;
3. schema-consumed command envelope/result and replayable subscription
   failures;
4. replayable application-shell and Sidecar product-meaningful continuation
   with validated ingress and declared effect edges;
5. accepted decision-complete Ontology, whole-family Prime contraction, IACS,
   class/sequence/state views, cross-view axiom evaluation, and module mapping;
6. public accessibility proof for keyboard, focus, status, representative
   WCAG AA contrast, terminal/forensic controls, and narrow layout;
7. source and isolated installed-development runtime, build, and declared
   operator significant-path proof; and
8. exact `odd_glc` `0.1.0` / ABIogenesis `4.6.0-rc.3` read-only observation
   admission with Build unavailable.

When these gates pass and the Product-owner acceptance condition is applied,
the admitted local prerequisite is `accepted` and its growth authority is
exhausted. T-032 itself remains open only for its external live Build/Assure
steel thread and the still-explicit functional scenario gaps. The earlier
eight-gap list remains the discovery record for this repair; this section owns
its final disposition.

## Historical Local STDO 2.2.1 Acceptance And Authority Exhaustion 2026-07-27

The Product-owner instruction to update, close, validate, and commit this
bounded 4.6-aligned version supplies direct acceptance of the exact local
conformance subject after its declared gates passed. The admitted prerequisite
is `accepted_and_exhausted`. Its retained design, source, tests, qualification
fixtures, and proof may prevent regression; none may select more work.

Exact acceptance evidence:

- the installed standards projection contains exactly the 41 byte-identical
  STDO `v2.2.1` members at release commit
  `8ad868eb0c9a3bdd075ff17ec4f7923d5ceec1cf` and recomputes aggregate
  `df1064dea1e1926436a3123280071a5082c5dc03b8418d07e46e839cbed20aed`;
- deterministic traceability passes 30/30 over 7 Product outcomes, 15
  requirement families, 138 requirements, 16 active designs, 18 scenarios, 39
  source carriers, 76 proof carriers, 41 standards members, 54 explicit
  scenario proof gaps, and 856 edges;
- source runtime passes 451/451, the exact 4.6 qualification passes 1/1,
  TypeScript and contract compilation pass, the production build passes, and
  10/10 Mermaid diagrams in active design carriers parse;
- the complete browser matrix passes 48/48, including the bounded keyboard,
  focus, status, representative WCAG AA contrast, terminal, forensic, and
  narrow-layout proof;
- a source-blind 665-member development candidate installs from its exact
  dependency lock, repeats traceability and all runtime tests, builds, serves,
  and passes all 17 declared operator-significant browser paths; and
- independent release and compatibility audits confirm the exact STDO
  projection and immutable `odd_glc` `0.1.0` / ABIogenesis `4.6.0-rc.3`
  observation subject, including 602 proof-declared events, 152 bounded event
  rows, 8 closed vectors, 47 catalog entries, and zero diagnostics.

Final disposition of the 2026-07-26 eight-gap discovery record:

1. The shared command envelope and result schemas are consumed at the
   aggregate effect membrane and their correlated ingress is replay-tested.
2. Subscription installation and event-source failures enter typed,
   replayable failure messages and cannot be caller-spoofed.
3. Sidecar product-meaningful storage, Project activation, continuation,
   surface/folder loading, and tail-follow state are reducer-owned; React
   retains projection ephemera only.
4. Project/bootstrap, deep-link, URL, workspace, and theme continuation are
   governed by the replayable application-shell State/Msg/Update/Cmd boundary.
5. The admitted public accessibility scope has executable keyboard, focus,
   status, contrast, terminal/forensic, and 390px proof. This is not a claim of
   unbounded whole-product WCAG certification.
6. The changed boundary has an accepted Ontology, whole-family Prime
   contraction, IACS, class/sequence/state views, axiom evaluation, and module
   projection under DESIGN_MODULE_METHOD.
7. Installed-development proof now covers 17 declared significant operator
   paths in addition to traceability, runtime, build, and serving.
8. The non-test odd_glc Build Carrier Descriptor, adapter, Assurance Catalog,
   evidence bundle, and resulting live steel thread remain external and open.

T-032 therefore stays `active` only as the review owner for that external
Build/Assure steel thread and the 54 explicit functional scenario gaps. Those
gaps are not a remaining-row sweep and convey no odd_manager-local growth
authority. Build remains unavailable for the exact 4.6 subject because its
published package has no build descriptor. ABIogenesis 5 remains unselected
until an immutable release exists and a new Product-owner admission names its
basis.

All execution notes below this disposition are retained historical evidence.
Any present-tense acceptance or local-gap wording in those notes is superseded
by this exact disposition; their external dependency facts remain live where
they agree with current Product and Goals.

## Triage

Smallest lawful re-entry point: product definition.

The current intent already calls `odd_manager` an operator-facing control plane
and requires governed, auditable, and operable systems. Current realization is
strongest at retrospective Project and run observation. It does not yet define
the first persona's complete goal or the manager's lawful command authority for
moving a Project into a build. That missing product shape must be resolved
before adding controls or another entry lens.

## Persona

The first primary persona is a developer who:

- manages multiple software Projects governed by Spec Method and ODD;
- uses `odd_glc` or another admitted domain package to build software;
- reviews a Project's specification and delivery posture;
- tunes specification through contextual, attributable prompting;
- executes multiple Project builds concurrently;
- supervises live builds and intervenes when authority or repair is required;
- verifies that all required gates, proof, and material assets are delivered.

The persona is shorthand for one interaction goal, not a demographic profile.

## Primary Interaction Goal

Move one or more governed Project revisions from current specification intent
to evidence-backed, gate-complete build outcomes while preserving authority,
runtime ownership, and the ability to re-enter at the correct constitutional
layer when a build exposes a gap.

The developer's loop is:

```text
portfolio attention
  -> review Project
  -> tune specification through proposal
  -> validate and accept the proposal
  -> submit admitted build
  -> supervise concurrent execution
  -> inspect required gates and assets
  -> converge, repair, or lawfully re-enter
```

## Observation, Interaction, And Reaction

| Level | Developer question | Required observation | Primary interaction | Product reaction |
| --- | --- | --- | --- | --- |
| Portfolio | Which Projects need attention? | Project identity, source/spec revision, readiness, active builds, gate posture, blockers, participants, freshness | Select, filter, queue, prioritize, pause, cancel | Keep state live, rank explicit attention conditions, preserve per-Project context |
| Project | Is this Project ready to build? | Specification delta, requirements, design/proof coverage, tickets, latest and active runs | Review authority, attach context, open a tuning interaction | Preserve framing and show the impact of proposed or accepted change |
| Tune | What must change before building? | Exact authority source, affected downstream surfaces, validation result, proposal lineage | Prompt, inspect diff, refine, accept, reject | Apply only admitted changes and expose resulting readiness delta |
| Build | Is execution progressing lawfully? | Queue state, admitted command, revision identity, run identity, current graph/runtime posture, heartbeat | Submit, attach, approve human gate, cancel, retry through admitted policy | Correlate command and run events without choosing ABG continuation |
| Assure | Did the build deliver everything required? | Required and delivered gates/assets, evidence, provenance, freshness, failures and residuals | Drill into evidence, compare runs, request repair, accept outcome | Converge only from admitted evidence or route an explicit re-entry |
| Forensic | Why did this fail or diverge? | Graph, traversal, events, diagnostics, transcripts, artifacts, proof digests | Inspect source truth and open contextual repair work | Retain Run Inspector as deep evidence, not the top-level user goal |

## Product Boundary To Ratify

`odd_manager` may:

- admit a typed build request against a published semantic carrier;
- schedule many admitted requests subject to explicit resource policy;
- start, attach to, cancel, and report external process lifecycle;
- collect and project command, run, gate, asset, and attention state;
- submit explicit human decisions and policy-authorized retry requests;
- route the developer into specification, requirement, design, or realization
  re-entry.

`odd_manager` must not:

- invent a build program when no published carrier exists;
- encode the build as view-owned shell text;
- choose GTL traversal or ABG continuation;
- manufacture evidence, gate satisfaction, or closure;
- allow an agent proposal to become constitutional truth through prompting
  alone.

## Required Product Surfaces

1. **Build Portfolio** - dense cross-Project readiness, queue, run, gate, asset,
   and attention posture.
2. **Project Workbench** - one `Review -> Tune -> Build -> Assure` surface and
   the default destination for a Project deep link.
3. **Specification Proposal Workspace** - contextual prompting, authority
   attachments, proposed diff, validation, attribution, and accept/reject.
4. **Build Submission And Supervision** - typed request, concurrency posture,
   live lifecycle, participant visibility, and bounded commands.
5. **Gate And Asset Assurance Matrix** - required-versus-delivered state with
   source evidence and explicit residuals.
6. **Attention Queue** - failures, human decisions, stale state, proof mismatch,
   specification drift, and lawful re-entry actions.
7. **Run Inspector** - deep runtime and proof investigation reached from the
   Project/build context.

## First Steel Thread

Use the `odd_glc` data-mapper Project as the first full interaction proof:

```text
deep-link Project
  -> review specification and readiness
  -> prompt one scoped proposal
  -> inspect validation and accept the diff
  -> submit the published data-mapper build carrier
  -> observe its live ABG run
  -> verify every required gate and asset
  -> converge or create a traceable re-entry action
```

The steel thread must prove the generic product contracts. It must not create an
`odd_glc`-specific manager runtime or duplicate ABG policy in the UI.

## Sequencing

1. Ratify persona, interaction goal, product command boundary, and terminology.
2. Reprice goals, domain model, requirements, and scenarios.
3. Publish the typed build-request and build-portfolio contracts upstream of UX.
4. Ratify STDO-UX design modules and Msg/Cmd interaction families.
5. Issue tenant-local realization tickets for the React carrier.
6. Prove the data-mapper steel thread, including concurrent execution and
   negative authority tests.

## Excluded From This Ticket

- implementing Build controls in React;
- inventing a generic scheduler before its product contract is ratified;
- modifying `odd_glc`, ABG, or GTL source authority;
- claiming implementation closure from the existing read-only Run Inspector.

## Execution Status 2026-07-11

Functional product and manager slices exist through W22 as provisional
evidence. The capability host renders Portfolio, Project Workbench,
Specification Proposal, Build Control, Assurance and Attention, and supporting
Run Observation around shared Project/revision Context and correlated
capability messages. The 2026-07-11 automation exercised the generic Review ->
Tune -> Build -> Assure journey, concurrent real-process supervision, selected
negative authority paths, replay, runtime, desktop, and mobile behavior. It did
not establish the aggregate host, shared command runtime, Sidecar controller,
accessibility, or design-method closure required by the superseding disposition
above.

Production adapter installation is now an explicit manager-local,
digest-pinned authority surface rather than an unimplemented constructor
parameter. Product descriptors can name installed identities only; they cannot
install modules or provide process plans.

The final 2026-07-11 scenario audit supplies evidence for stale proposal
regeneration, exact attention-source routing, context-preserving forensic
drilldown, and stale/disconnected external execution recovery; it does not
close the current acceptance gaps. Approval, retry, repair, and human decisions
remain product-carrier-owned reactions; odd_manager exposes them only when an
admitted catalog publishes the command.

T-032 remains open with acceptance withheld for the bounded local repair and
the named external odd_glc dependency. odd_glc has not published its
non-test Build Carrier Descriptor,
execution adapter, Assurance Catalog, or build evidence bundle, and the
upstream ABIogenesis candidate still requires F_H promotion. The manager fails
closed at that boundary and does not substitute fixture or shell execution for
product truth.

## Prime Active Role 2026-07-11

T-032 is the retained review and closure owner for the developer-control
product and its external steel-thread claim. It does not own further
realization without a new admission under the review freeze above. T-034 and
T-035 and the manager-owned portions of T-036 through T-039 retain their
historical completion records, but those records do not supply current
implementation acceptance. Their evidence and repeated live-product residual
are compressed here rather than copied across four active tickets.

The remaining closure facts include both local method gaps and external
carrier dependencies:

- odd_manager must satisfy the aggregate-host, shared-runtime, subscription,
  Sidecar-controller, accessibility, and DESIGN_MODULE_METHOD gaps in the
  superseding disposition above;
- odd_glc must publish a non-test Build Carrier Descriptor;
- odd_glc must publish a digest-pinned execution adapter module;
- odd_glc must publish an Assurance Catalog and matching build evidence bundle;
- the upstream ABIogenesis candidate still requires F_H promotion;
- the resulting live data-mapper journey must satisfy the T-032 and sprint
  closure laws without fixture or shell substitution.

## External Carrier Dependency Audit 2026-07-11

The live external residual is sequenced by ABIogenesis `GOAL-035` and is
independent of the odd_manager-local implementation and method gaps recorded
above. Its current dependency order is:

```text
DS-1  ABIogenesis T-223
  -> DS-1F T-225
  -> DS-2 T-226/T-179 design and T-227/T-228 realization
  -> DS-3 operator product
  -> DS-4/DS-4Q conformance and qualification
  -> DS-5 T-234 installed self-hosted R5/I1
  -> DS-6 odd_glc T-033 design and T-038 realization/campaign
  -> manager-callable odd_glc carrier and live T-032 steel thread
```

T-223 is the current executable leaf. odd_glc T-033 is explicitly queued
behind ABIogenesis T-226 and T-179 design. odd_glc T-038 requires T-033 plus
ABIogenesis T-223, T-227, T-228, and T-234. Its manager-callable carrier ticket
T-034 also waits for T-033. odd_manager therefore must remain fail closed and
must not bypass the phase order with a shell plan, fixture carrier, or local
substitute descriptor.

## Prime-Set Workbench UX Iteration 2026-07-11

The 2026-07-11 product posture distinguished the functional manager slices from
the external steel-thread residual. The Project Workbench identity strip no
longer projects an ambiguous global `READY`; admitted capability contributions
remain the one availability truth and are now projected through phase controls
and active module detail. This keeps Project identity, capability admission,
build lifecycle, and assurance truth on separate clean boundaries.

Historical automation evidence for this iteration, retained without acceptance
authority:

- `npm run test:runtime:node`: 266 tests, 262 passed, 4 environment-dependent
  screen tests skipped, 0 failed;
- `npx tsc --noEmit`: passed;
- `npm run build`: passed with the existing Vite large-chunk warning;
- `npx playwright test`: 44/44 passed in 4.4 minutes;
- `git diff --check`: passed.

## Project Workbench Phase Availability Compression 2026-07-11

REQ-OM-DEV-001 requires the developer to determine current phase, outstanding
obligation, and next lawful interaction without reconstructing unrelated
screens. The integrated review found that the four phase controls, a separate
six-row status sidebar, and each active capability header repeated related
posture while the sidebar reduced the primary workspace by roughly one quarter.

The Workbench now uses one admitted contribution path in two lawful skins:

- compact `available`, `unavailable`, stale, unsupported, or error state in the
  corresponding Review, Tune, Build, or Assure phase control;
- full capability state, reason, and source references in the active module.

Run Observation retains its supporting contribution status. Project Workbench
does not copy capability state, infer phase completion, or add any command. The
separate sidebar is removed and the active capability receives the full canvas
width. Desktop and 390px mobile proof covers all phase states and exact missing
carrier reason projection.

Final proof: host boundary 10/10; focused Workbench browser 2/2; corrected
real-process workflows 2/2; runtime/replay 266/266; TypeScript passed;
production build passed with the existing chunk warning; Playwright 44/44 in
4.5 minutes; live desktop/mobile review had no overflow or console errors; and
`git diff --check` passed.

This iteration changes no external-carrier dependency. The ABIogenesis and
odd_glc DS sequence recorded above remains the live T-032 steel-thread gate.

## Source-Attributed Next Interaction Iteration 2026-07-11

REQ-OM-DEV-001 and REQ-OM-DEV-003 require outstanding obligations to expose a
traceable next lawful interaction. Build Portfolio previously routed attention
correctly but labeled every action `Open source`, forcing the developer to infer
the destination.

One total Build Portfolio selector now owns both command and display truth:

```text
revision | specification        -> specification-proposal -> Open Tune
build-carrier | build-execution -> build-control          -> Open Build
other source kinds              -> assurance-attention    -> Open Assure
```

The reducer uses the selector's capability ID for
`portfolio.open-attention`; the view uses its action label. The fallback is
Assure because unknown evidence must remain inspectable and cannot be promoted
to closure. No new state, command kind, capability import, or route table was
introduced.

The focused TypeScript replay harness was extended to resolve local runtime
imports recursively as compiled data URLs. This preserves the prime selector
module instead of forcing reducer-local duplication for test convenience.

Final proof: focused host/selector 11/11; focused three-route browser 1/1;
runtime/replay 267/267; TypeScript passed; production build passed with the
existing chunk warning; Playwright 45/45 in 4.9 minutes; desktop/mobile live
review had no overflow or console errors; and `git diff --check` passed.

The external odd_glc carrier sequence remains unchanged.

## Review-To-Tune Context Continuity 2026-07-12

REQ-OM-DEV-003 and REQ-OM-SPC-002 require an attention transition to retain the
source that justifies it. `Open Tune` previously changed phase but left the
proposal composer with no attached attention context.

The host now forwards the admitted attention `sourceRef` only after the target
Project Context matches. It uses the existing `proposal/context-attached` Msg
with an optional direct `sourceRef`; manual Attach continues to consume the
visible draft through the same reducer branch. Both paths share the 12-ref
bound, deduplication, removal, and proposal-generation payload. The handoff
cannot inject prompt text, patch content, proposal status, or constitutional
mutation.

Project Context change now clears all candidate drafts and attachments before
new history admission. Same-Project revision refresh retains explicit context.
Replay proves both sides of that boundary, and browser proof verifies the exact
`git://` attention source is visible in Tune before generation.

Final proof: focused proposal replay 6/6; focused three-route browser 1/1;
runtime/replay 268/268; TypeScript passed; production build passed with the
existing chunk warning; Playwright 45/45 in 4.6 minutes; desktop/mobile live
review had no overflow or console errors; and `git diff --check` passed.

The external odd_glc carrier sequence remains unchanged.
